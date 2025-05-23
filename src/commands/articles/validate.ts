import path from "node:path";
import chalk from "chalk";
import fs from "fs-extra";
import { articleSchema } from "../../schemas";
import { extractFrontmatter } from "../../utils/frontmatter";
import { logger } from "../../utils/logger";
import { getProjectPaths } from "../../utils/project";
import type { ProjectPaths } from "../../utils/project";
import {
	isExternalUrl,
	isImageAvailable,
	getAllImagePaths,
} from "../../utils/image";

export interface ValidateArticlesOptions {
	verbose?: boolean;
	fix?: boolean;
}

export async function validateArticles(
	opts: ValidateArticlesOptions,
): Promise<void> {
	const spinner = logger.spinner("Initializing article validation");

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
	if (!paths.articles) {
		logger.spinnerError(
			"Articles directory not found in project configuration.",
		);
		return;
	}
	if (!(await fs.pathExists(paths.articles))) {
		logger.spinnerError("No articles directory found.");
		return;
	}

	// Get article files
	spinner.text = "Finding article files";
	let files: string[];
	try {
		const allFiles = await fs.readdir(paths.articles);
		files = allFiles.filter((f) => f.endsWith(".md"));
	} catch (e) {
		logger.spinnerError(
			`Failed to read articles directory: ${(e as Error).message}`,
		);
		return;
	}

	if (!files.length) {
		logger.spinnerWarn("No articles found to validate.");
		return;
	}

	spinner.text = `Validating ${files.length} articles`;

	let hasError = false;
	let validCount = 0;
	let errorCount = 0;
	const fixedCount = 0;
	const errorsByFile: Record<string, string[]> = {};

	// Validate articles in parallel
	const results = await Promise.all(
		files.map(async (file) => {
			const filePath = path.join(paths.articles ?? "", file);

			// Check if file exists before proceeding
			if (!(await fs.pathExists(filePath))) {
				return { file, errors: [`File does not exist: ${filePath}`] };
			}
			const errors: string[] = [];

			try {
				const content = await fs.readFile(filePath, "utf-8");
				const { frontmatter } = extractFrontmatter(content);

				// Validate with schema
				const parseResult = articleSchema.safeParse(frontmatter);

				if (!parseResult.success) {
					for (const err of parseResult.error.errors) {
						errors.push(`${err.path.join(".")}: ${err.message}`);
					}
				}

				// Check for broken links (basic check)
				const linkMatches = [...content.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)];
				for (const match of linkMatches) {
					const url = match[2];
					if (
						!url.startsWith("http") &&
						!url.startsWith("#") &&
						!url.startsWith("mailto:")
					) {
						const linkedPath = url.startsWith("/")
							? path.join(paths.root, "public", url)
							: path.join(paths.public, url);

						if (!(await fs.pathExists(linkedPath))) {
							errors.push(`Broken link: ${url}`);
						}
					}
				}

				// Check for broken image links
				const imageMatches = [...content.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g)];
				for (const match of imageMatches) {
					const url = match[2];
					const alt = match[1];

					if (!alt || alt.trim() === "") {
						errors.push(`Missing alt text for image: ${url}`);
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
							errors.push(`Broken image link: ${url}`);
						}
					}
				}

				return { file, errors };
			} catch (error) {
				return {
					file,
					errors: [`Failed to read or parse: ${(error as Error).message}`],
				};
			}
		}),
	);

	// Process results
	for (const result of results) {
		if (result.errors.length > 0) {
			hasError = true;
			errorCount++;
			errorsByFile[result.file] = result.errors;
		} else {
			validCount++;
		}
	}

	spinner.stop();

	// Display results
	if (hasError) {
		console.log(chalk.yellow(`\nFound issues in ${errorCount} article(s):\n`));

		for (const [file, errors] of Object.entries(errorsByFile)) {
			console.log(chalk.bold.yellow(`${file}:`));

			for (const error of errors) {
				console.log(`  ${chalk.red("✖")} ${error}`);
			}

			console.log();
		}

		// Offer to fix some common issues if requested
		if (opts.fix) {
			spinner.start("Attempting to fix common issues");

			// Implement fixes for common issues here...
			// For example, you could:
			// - Add missing required fields
			// - Fix taxonomy references
			// - Update dates

			spinner.succeed(
				`Fixed ${fixedCount} issues. Re-run validation to check.`,
			);
		}

		console.log(
			chalk.yellow(`\nSummary: ${validCount} valid, ${errorCount} with issues`),
		);
	} else {
		console.log(
			chalk.green(`\nAll ${validCount} articles passed validation! 🎉`),
		);
	}
}
