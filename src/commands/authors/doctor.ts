import path from "node:path";
import chalk from "chalk";
import fs from "fs-extra";
import { authorSchema } from "../../schemas";
import { extractFrontmatter } from "../../utils/frontmatter";
import { logger } from "../../utils/logger";
import { type ProjectPaths, getProjectPaths } from "../../utils/project";

export async function doctorAuthors(opts: {
	verbose?: boolean;
	fix?: boolean;
}) {
	const spinner = logger.spinner("Running author doctor checks");

	// Get project paths
	let paths: ProjectPaths;
	try {
		paths = await getProjectPaths(process.cwd());
		spinner.text = "Checking project structure";
	} catch (e) {
		logger.spinnerError(`Project validation failed: ${(e as Error).message}`);
		return;
	}

	// Check if authors directory exists
	if (!(await fs.pathExists(paths.authors))) {
		logger.spinnerError("No authors directory found.");
		return;
	}

	// Get author files
	spinner.text = "Finding author files";
	const files = (await fs.readdir(paths.authors)).filter((f) =>
		f.endsWith(".md"),
	);

	if (!files.length) {
		logger.spinnerWarn("No authors found to check.");
		return;
	}

	spinner.text = `Diagnosing ${files.length} authors`;

	let hasError = false;
	let issueCount = 0;
	let fixedCount = 0;
	const issues: { file: string; messages: string[]; fixable: boolean }[] = [];

	// Check each author file
	for (const file of files) {
		if (opts.verbose) {
			spinner.text = `Checking ${file}`;
		}

		const filePath = path.join(paths.authors, file);
		const fileIssues: string[] = [];
		let isFixable = false;

		try {
			const content = await fs.readFile(filePath, "utf-8");
			const { frontmatter } = extractFrontmatter(content);

			// Check schema validation
			const parseResult = authorSchema.safeParse(frontmatter);

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

			// Check avatar image if specified
			if (
				frontmatter.avatar &&
				typeof frontmatter.avatar === "string" &&
				!frontmatter.avatar.startsWith("http")
			) {
				const imgPath = frontmatter.avatar.startsWith("/")
					? path.join(paths.root, "public", frontmatter.avatar)
					: path.join(paths.public, frontmatter.avatar);

				if (!(await fs.pathExists(imgPath))) {
					fileIssues.push(`Broken avatar image link: ${frontmatter.avatar}`);
				}
			}

			// Check multilingual fields format
			for (const field of ["name", "bio", "role"]) {
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
				`\nFound ${issueCount} issues in ${issues.length} author(s):\n`,
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

				const filePath = path.join(paths.authors, issue.file);
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
			chalk.green(`\nAll ${files.length} authors passed the doctor check! 🎉`),
		);
	}

	return { issues, hasError, issueCount, fixedCount };
}
