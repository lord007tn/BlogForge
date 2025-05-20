import path from "node:path";
import chalk from "chalk";
import fs from "fs-extra";
import { extractFrontmatter } from "../../utils/frontmatter";
import { logger } from "../../utils/logger";
import { getProjectPaths } from "../../utils/project";
import type { ProjectPaths } from "../../utils/project";

export async function doctorArticles(opts: {
	verbose?: boolean;
	fix?: boolean;
}) {
	const spinner = logger.spinner("Running article doctor checks");

	// Get project paths
	let paths: ProjectPaths;
	try {
		paths = await getProjectPaths(process.cwd());
		spinner.text = "Checking project structure";
	} catch (e) {
		logger.spinnerError(`Project validation failed: ${(e as Error).message}`);
		return;
	}

	// Check if articles directory exists
	if (!(await fs.pathExists(paths.articles))) {
		logger.spinnerError("No articles directory found.");
		return;
	}

	// Get article files
	spinner.text = "Finding article files";
	const files = (await fs.readdir(paths.articles)).filter((f) =>
		f.endsWith(".md"),
	);

	if (!files.length) {
		logger.spinnerWarn("No articles found to check.");
		return;
	}

	spinner.text = `Diagnosing ${files.length} articles`;

	let hasError = false;
	let issueCount = 0;
	let fixedCount = 0;
	const issues: { file: string; messages: string[]; fixable: boolean }[] = [];

	// Check for:
	// 1. Missing required fields
	// 2. Invalid author references
	// 3. Invalid category references
	// 4. Broken image links
	// 5. Missing alt text
	// 6. Large images (>500kb)
	// 7. Inconsistent slug/filename

	// Get available authors
	const authorFiles = (await fs.pathExists(paths.authors))
		? (await fs.readdir(paths.authors))
				.filter((f) => f.endsWith(".md"))
				.map((f) => f.replace(/\.md$/, ""))
		: [];

	// Get available categories
	const categoryFiles = (await fs.pathExists(paths.categories))
		? (await fs.readdir(paths.categories))
				.filter((f) => f.endsWith(".md"))
				.map((f) => f.replace(/\.md$/, ""))
		: [];

	for (const file of files) {
		if (opts.verbose) {
			spinner.text = `Checking ${file}`;
		}

		const filePath = path.join(paths.articles, file);
		const content = await fs.readFile(filePath, "utf-8");
		const { frontmatter } = extractFrontmatter(content);

		const fileIssues: string[] = [];
		let isFixable = false;

		// Check required fields
		const requiredFields = [
			"title",
			"description",
			"author",
			"tags",
			"locale",
			"publishedAt",
		];

		const missing = requiredFields.filter((field) => !frontmatter[field]);
		if (missing.length) {
			fileIssues.push(`Missing required fields: ${missing.join(", ")}`);
			isFixable =
				isFixable || (missing.length === 1 && missing[0] === "locale"); // Only locale is auto-fixable
		}

		// Check author reference
		if (frontmatter.author && authorFiles.length > 0) {
			if (!authorFiles.includes(String(frontmatter.author))) {
				fileIssues.push(
					`Invalid author reference: ${
						frontmatter.author
					}. Available: ${authorFiles.join(", ")}`,
				);
			}
		}

		// Check category reference
		if (frontmatter.category && categoryFiles.length > 0) {
			if (!categoryFiles.includes(String(frontmatter.category))) {
				fileIssues.push(
					`Invalid category reference: ${
						frontmatter.category
					}. Available: ${categoryFiles.join(", ")}`,
				);
			}
		}

		// Check image reference
		if (
			frontmatter.image &&
			typeof frontmatter.image === "string" &&
			!frontmatter.image.startsWith("http")
		) {
			const imgPath = frontmatter.image.startsWith("/")
				? path.join(paths.root, "public", frontmatter.image)
				: path.join(paths.public, frontmatter.image);

			if (!(await fs.pathExists(imgPath))) {
				fileIssues.push(`Broken featured image link: ${frontmatter.image}`);
			} else {
				// Check image size
				try {
					const stats = await fs.stat(imgPath);
					const sizeInKB = stats.size / 1024;

					if (sizeInKB > 500) {
						fileIssues.push(
							`Large featured image (${Math.round(
								sizeInKB,
							)}KB). Consider optimizing.`,
						);
						isFixable = true; // Image optimization is fixable
					}
				} catch (error) {
					// Ignore stat errors
				}
			}
		}

		// Check slug consistency
		const filename = path.basename(file, ".md");
		if (frontmatter.slug && frontmatter.slug !== filename) {
			fileIssues.push(
				`Slug (${frontmatter.slug}) doesn't match filename (${filename})`,
			);
			isFixable = true;
		}

		// Content checks
		// Check for broken image links
		const imageMatches = [...content.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g)];
		for (const match of imageMatches) {
			const url = match[2];
			const alt = match[1];

			if (!alt || alt.trim() === "") {
				fileIssues.push(`Missing alt text for image: ${url}`);
				isFixable = true;
			}

			if (!url.startsWith("http")) {
				const imagePath = url.startsWith("/")
					? path.join(paths.root, "public", url)
					: path.join(paths.public, url);

				if (!(await fs.pathExists(imagePath))) {
					fileIssues.push(`Broken image link in content: ${url}`);
				}
			}
		}

		if (fileIssues.length > 0) {
			hasError = true;
			issueCount += fileIssues.length;
			issues.push({ file, messages: fileIssues, fixable: isFixable });
		}
	}

	spinner.stop();

	// Display results
	if (hasError) {
		console.log(
			chalk.yellow(
				`\nFound ${issueCount} issues in ${issues.length} article(s):\n`,
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

		// Offer to fix some issues if requested
		if (opts.fix) {
			spinner.start("Attempting to fix common issues");

			for (const issue of issues) {
				if (!issue.fixable) continue;

				const filePath = path.join(paths.articles, issue.file);
				const content = await fs.readFile(filePath, "utf-8");
				const { frontmatter, content: bodyContent } =
					extractFrontmatter(content);

				let modified = false;

				// Add missing locale
				if (!frontmatter.locale) {
					frontmatter.locale = "en";
					modified = true;
					fixedCount++;
				}

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
			chalk.green(`\nAll ${files.length} articles passed the doctor check! 🎉`),
		);
	}

	return { issues, hasError, issueCount, fixedCount };
}
