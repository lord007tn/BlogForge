import path from "node:path";
import chalk from "chalk";
import fs from "fs-extra";
import { categorySchema } from "../../schemas";
import { extractFrontmatter } from "../../utils/frontmatter";
import { logger } from "../../utils/logger";
import { getProjectPaths } from "../../utils/project";
import type { ProjectPaths } from "../../utils/project";

export async function doctorCategories(opts: {
	verbose?: boolean;
	fix?: boolean;
}) {
	const spinner = logger.spinner("Running category doctor checks");

	// Get project paths
	let paths: ProjectPaths;
	try {
		paths = await getProjectPaths(process.cwd());
		spinner.text = "Checking project structure";
	} catch (e) {
		logger.spinnerError(`Project validation failed: ${(e as Error).message}`);
		return;
	}

	// Check if categories directory exists
	if (!(await fs.pathExists(paths.categories))) {
		logger.spinnerError("No categories directory found.");
		return;
	}

	// Get category files
	spinner.text = "Finding category files";
	const files = (await fs.readdir(paths.categories)).filter((f) =>
		f.endsWith(".md"),
	);

	if (!files.length) {
		logger.spinnerWarn("No categories found to check.");
		return;
	}

	spinner.text = `Diagnosing ${files.length} categories`;

	let hasError = false;
	let issueCount = 0;
	let fixedCount = 0;
	const issues: { file: string; messages: string[]; fixable: boolean }[] = [];

	// Check each category file
	for (const file of files) {
		if (opts.verbose) {
			spinner.text = `Checking ${file}`;
		}

		const filePath = path.join(paths.categories, file);
		const fileIssues: string[] = [];
		let isFixable = false;

		try {
			const content = await fs.readFile(filePath, "utf-8");
			const { frontmatter } = extractFrontmatter(content);

			// Check schema validation
			const parseResult = categorySchema.safeParse(frontmatter);

			if (!parseResult.success) {
				for (const err of parseResult.error.errors) {
					fileIssues.push(`${err.path.join(".")}: ${err.message}`);

					// Check if the issue is fixable
					if (err.path.join(".") === "slug" && file.endsWith(".md")) {
						isFixable = true;
					}
				}
			}

			// Check if slug matches filename
			const filename = path.basename(file, ".md");
			if (frontmatter.slug && frontmatter.slug !== filename) {
				fileIssues.push(
					`Slug (${frontmatter.slug}) doesn't match filename (${filename})`,
				);
				isFixable = true;
			}

			// Check image if specified
			if (
				frontmatter.image &&
				typeof frontmatter.image === "string" &&
				!frontmatter.image.startsWith("http")
			) {
				const imgPath = frontmatter.image.startsWith("/")
					? path.join(paths.root, "public", frontmatter.image)
					: path.join(paths.public, frontmatter.image);

				if (!(await fs.pathExists(imgPath))) {
					fileIssues.push(`Broken image link: ${frontmatter.image}`);
				}
			}

			// Check icon if specified
			if (
				frontmatter.icon &&
				typeof frontmatter.icon === "string" &&
				!frontmatter.icon.startsWith("http")
			) {
				const iconPath = frontmatter.icon.startsWith("/")
					? path.join(paths.root, "public", frontmatter.icon)
					: path.join(paths.public, frontmatter.icon);

				if (!(await fs.pathExists(iconPath))) {
					fileIssues.push(`Broken icon link: ${frontmatter.icon}`);
				}
			}

			// Check multilingual fields format
			for (const field of ["title", "description"]) {
				if (frontmatter[field] && typeof frontmatter[field] === "object") {
					const obj = frontmatter[field] as Record<string, unknown>;

					if (!(obj.en || obj.ar)) {
						fileIssues.push(
							`${field} is multilingual but missing both 'en' and 'ar' translations`,
						);
					}
				}
			}

			// Add issues if any found
			if (fileIssues.length > 0) {
				hasError = true;
				issueCount += fileIssues.length;
				issues.push({ file, messages: fileIssues, fixable: isFixable });
			}
		} catch (error) {
			fileIssues.push(`Failed to read or parse: ${(error as Error).message}`);
			hasError = true;
			issueCount += 1;
			issues.push({ file, messages: fileIssues, fixable: false });
		}
	}

	spinner.stop();

	// Display results
	if (hasError) {
		console.log(
			chalk.yellow(
				`\nFound ${issueCount} issues in ${issues.length} category(ies):\n`,
			),
		);

		for (const issue of issues) {
			console.log(chalk.bold.yellow(`${issue.file}:`));

			for (const message of issue.messages) {
				console.log(`  ${chalk.red("✖")} ${message}`);
			}

			if (issue.fixable && opts.fix) {
				console.log(
					`  ${chalk.cyan("ℹ")} Some issues can be auto-fixed with --fix option`,
				);
			}

			console.log();
		}

		// Fix issues if requested
		if (opts.fix) {
			spinner.start("Attempting to fix common issues");

			for (const issue of issues) {
				if (!issue.fixable) continue;

				const filePath = path.join(paths.categories, issue.file);
				const content = await fs.readFile(filePath, "utf-8");
				const { frontmatter, content: bodyContent } =
					extractFrontmatter(content);

				let modified = false;

				// Fix slug/filename mismatch
				if (
					frontmatter.slug &&
					frontmatter.slug !== path.basename(issue.file, ".md")
				) {
					frontmatter.slug = path.basename(issue.file, ".md");
					modified = true;
					fixedCount++;
				}

				if (modified) {
					// Update file with new frontmatter
					const yaml = require("js-yaml");
					const updatedFrontmatter = `---\n${yaml.dump(frontmatter)}---\n`;
					const updatedContent = updatedFrontmatter + bodyContent;

					await fs.writeFile(filePath, updatedContent, "utf-8");
				}
			}

			if (fixedCount > 0) {
				spinner.succeed(
					`Fixed ${fixedCount} issues. Some issues require manual attention.`,
				);
			} else {
				spinner.info(
					"No issues could be automatically fixed. Manual attention required.",
				);
			}
		} else if (issues.some((i) => i.fixable)) {
			console.log(
				chalk.cyan(
					"\nSome issues can be automatically fixed. Run with --fix to attempt repairs.",
				),
			);
		}
	} else {
		console.log(
			chalk.green(
				`\nAll ${files.length} categories passed the doctor check! 🎉`,
			),
		);
	}

	return { issues, hasError, issueCount, fixedCount };
}
