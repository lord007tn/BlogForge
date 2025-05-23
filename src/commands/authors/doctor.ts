import path from "node:path";
import chalk from "chalk";
import fs from "fs-extra";
import { createAuthorSchema } from "../../schemas";
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

	// Check if authors directory is valid
	if (!paths.authors) {
		logger.spinnerError(
			"No authors directory path resolved (null). Project may use remote sources or is misconfigured.",
		);
		return;
	}
	const authorsDir = paths.authors;
	if (!(await fs.pathExists(authorsDir))) {
		logger.spinnerError("No authors directory found.");
		return;
	}

	// Get author files
	spinner.text = "Reading author files";
	let files: string[];
	try {
		const allFiles = await fs.readdir(authorsDir);
		files = allFiles.filter((f: string) => f.endsWith(".md"));
	} catch (e) {
		logger.spinnerError(
			`Failed to read authors directory: ${(e as Error).message}`,
		);
		return;
	}

	if (!files.length) {
		if (!files.length) {
			logger.spinnerWarn("No authors found to check.");
			return;
		}

		spinner.text = `Diagnosing ${files.length} authors`;

		let hasError = false;
		let issueCount = 0;
		let fixedCount = 0;
		const issues: { file: string; messages: string[]; fixable: boolean }[] = [];

		// Create a schema with the project's config
		const authorSchema = createAuthorSchema(paths.config);
		const isMultilingual = paths.config.multilingual;
		const supportedLanguages = paths.config.languages || ["en"];

		// Check each author file
		for (const file of files) {
			if (opts.verbose) {
				spinner.text = `Checking ${file}`;
			}

			const filePath = path.join(authorsDir, file);
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

				// Check multilingual fields format based on config
				if (isMultilingual) {
					for (const field of ["name", "bio", "role"]) {
						if (frontmatter[field]) {
							// If multilingual is enabled, fields should be objects
							if (typeof frontmatter[field] !== "object") {
								fileIssues.push(
									`${field} should be a multilingual object but is a string. Config has multilingual=true.`,
								);
							} else if (
								frontmatter[field] &&
								typeof frontmatter[field] === "object"
							) {
								const obj = frontmatter[field] as Record<string, unknown>;

								// Check if any of the supported languages exists
								const hasAnySupportedLanguage = supportedLanguages.some(
									(lang) => lang in obj,
								);

								if (!hasAnySupportedLanguage) {
									fileIssues.push(
										`${field} is multilingual but missing any of the supported languages: ${supportedLanguages.join(", ")}`,
									);
								}
							}
						}
					}
				} else {
					// If multilingual is disabled, text fields should be strings
					for (const field of ["name", "bio", "role"]) {
						if (frontmatter[field] && typeof frontmatter[field] === "object") {
							fileIssues.push(
								`${field} is an object but config has multilingual=false. Should be a string.`,
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

					const filePath = path.join(authorsDir, issue.file);
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
					`\nAll ${files.length} authors passed the doctor check! 🎉`,
				),
			);
		}

		return { issues, hasError, issueCount, fixedCount };
	}
}
