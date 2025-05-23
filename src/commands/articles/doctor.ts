import path from "node:path";
import chalk from "chalk";
import fs from "fs-extra";
import { extractFrontmatter } from "../../utils/frontmatter";
import { logger } from "../../utils/logger";
import { getProjectPaths } from "../../utils/project";
import type { ProjectPaths } from "../../utils/project";
import { articleSchema } from "../../schemas"; // Import the schema for validation
import {
	isExternalUrl,
	isImageAvailable,
	getAllImagePaths,
} from "../../utils/image";

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

	// Check if articles directory is valid
	if (!paths.articles) {
		logger.spinnerError(
			"No articles directory path resolved (null). Project may use remote sources or is misconfigured.",
		);
		return;
	}
	const articlesDir = paths.articles;
	if (!(await fs.pathExists(articlesDir))) {
		logger.spinnerError("No articles directory found.");
		return;
	}
	// Get article files
	spinner.text = "Finding article files";
	let files: string[];
	try {
		const allFiles = await fs.readdir(articlesDir);
		files = allFiles.filter((f: string) => f.endsWith(".md"));
	} catch (e) {
		logger.spinnerError(
			`Failed to read articles directory: ${(e as Error).message}`,
		);
		return;
	}

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
	const authorFiles =
		paths.authors && (await fs.pathExists(paths.authors))
			? (await fs.readdir(paths.authors))
					.filter((f: string) => f.endsWith(".md"))
					.map((f: string) => f.replace(/\.md$/, ""))
			: [];

	// Get available categories
	const categoryFiles =
		paths.categories && (await fs.pathExists(paths.categories))
			? (await fs.readdir(paths.categories))
					.filter((f: string) => f.endsWith(".md"))
					.map((f: string) => f.replace(/\.md$/, ""))
			: [];

	for (const file of files) {
		if (opts.verbose) {
			spinner.text = `Checking ${file}`;
		}

		const filePath = path.join(articlesDir, file);
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

		// Validate against schema
		try {
			articleSchema.parse(frontmatter);
		} catch (validationError) {
			// If there are schema validation errors not already caught by our manual checks
			if (
				typeof validationError === "object" &&
				validationError &&
				"errors" in validationError &&
				Array.isArray((validationError as any).errors)
			) {
				for (const error of (validationError as { errors: any[] }).errors) {
					// Only add errors that weren't already caught by our manual check
					if (!missing.includes(error.path[0])) {
						fileIssues.push(
							`Schema validation error: ${error.message} at ${error.path.join(".")}`,
						);
					}
				}
			}
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
			!isExternalUrl(frontmatter.image)
		) {
			// Use getAllImagePaths and isImageAvailable for robust check
			const availableImagePaths = await getAllImagePaths(
				`${paths.public}/images`,
			);
			const availableImageSet = new Set(availableImagePaths);
			if (
				!isImageAvailable(
					frontmatter.image,
					availableImagePaths,
					`${paths.public}/images`,
					availableImageSet,
				)
			) {
				fileIssues.push(`Broken featured image link: ${frontmatter.image}`);
			} else {
				// Check image size
				try {
					const imgPath = frontmatter.image.startsWith("/")
						? path.join(paths.root, "public", frontmatter.image)
						: path.join(paths.public, frontmatter.image);
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
				} catch {
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

			if (!isExternalUrl(url)) {
				// Use getAllImagePaths and isImageAvailable for robust check
				const availableImagePaths = await getAllImagePaths(
					`${paths.public}/images`,
				);
				const availableImageSet = new Set(availableImagePaths);
				if (
					!isImageAvailable(
						url,
						availableImagePaths,
						`${paths.public}/images`,
						availableImageSet,
					)
				) {
					fileIssues.push(`Broken image link in content: ${url}`);
				}
			}
		}

		// Schema validation
		const validationResult = articleSchema.safeParse(frontmatter);
		if (!validationResult.success) {
			fileIssues.push(
				`Schema validation failed: ${validationResult.error.message}`,
			);
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

				const filePath = path.join(articlesDir, issue.file);
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
