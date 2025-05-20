import path from "node:path";
import chalk from "chalk";
import Table from "cli-table3";
import fs from "fs-extra";
import { logger } from "../../utils/logger";
import { getProjectPaths } from "../../utils/project";

export async function suggestMissingAltText(opts: {
	verbose?: boolean;
	fix?: boolean;
	model?: string;
}) {
	const spinner = logger.spinner("Checking for missing alt text");

	// Get project paths
	let articlesDir: string;

	try {
		const paths = await getProjectPaths(process.cwd());
		articlesDir = paths.articles;

		spinner.text = "Checking articles directory";
	} catch (e) {
		logger.spinnerError(`Project validation failed: ${(e as Error).message}`);
		return;
	}

	// Check if articles directory exists
	if (!(await fs.pathExists(articlesDir))) {
		logger.spinnerError(`Articles directory not found: ${articlesDir}`);
		return;
	}

	// Get article files
	spinner.text = "Finding articles";
	let articleFiles: string[];

	try {
		articleFiles = (await fs.readdir(articlesDir)).filter((file) =>
			file.endsWith(".md"),
		);
	} catch (error) {
		logger.spinnerError(
			`Failed to read articles directory: ${(error as Error).message}`,
		);
		return;
	}

	if (!articleFiles.length) {
		logger.spinnerWarn("No articles found to check.");
		return;
	}

	// Track images with missing alt text
	const missingAltText: Array<{
		article: string;
		image: string;
		line: number;
		context: string;
	}> = [];

	// Check each article
	spinner.text = "Analyzing image alt text in articles";

	for (const articleFile of articleFiles) {
		if (opts.verbose) {
			spinner.text = `Checking ${articleFile}`;
		}

		const filePath = path.join(articlesDir, articleFile);

		try {
			const content = await fs.readFile(filePath, "utf-8");
			const lines = content.split("\n");

			// Check inline image references
			for (let i = 0; i < lines.length; i++) {
				const line = lines[i];
				const imageMatches = [...line.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g)];

				for (const match of imageMatches) {
					const alt = match[1];
					const image = match[2];

					// Check for missing or empty alt text
					if (!alt || alt.trim() === "") {
						// Get context (the surrounding text)
						const startLine = Math.max(0, i - 1);
						const endLine = Math.min(lines.length - 1, i + 1);
						const context = lines.slice(startLine, endLine + 1).join("\n");

						missingAltText.push({
							article: articleFile,
							image,
							line: i + 1,
							context,
						});
					}
				}
			}
		} catch (error) {
			if (opts.verbose) {
				console.log(
					chalk.yellow(
						`Warning: Could not check ${articleFile}: ${(error as Error).message}`,
					),
				);
			}
		}
	}

	spinner.stop();

	// Display results
	if (missingAltText.length === 0) {
		console.log(
			chalk.green(
				`\nAll images in ${articleFiles.length} articles have alt text! 🎉`,
			),
		);
		return { missing: [], total: articleFiles.length };
	}

	console.log(
		chalk.yellow(
			`\nFound ${missingAltText.length} images with missing alt text:\n`,
		),
	);

	// Create table for display
	const table = new Table({
		head: [
			chalk.cyan("Article"),
			chalk.cyan("Image"),
			chalk.cyan("Line"),
			chalk.cyan("Context"),
		],
		style: {
			head: [],
			border: [],
		},
		colWidths: [30, 30, 10, 50],
		wordWrap: true,
	});

	for (const item of missingAltText) {
		// Simplify paths for display
		const imageName = path.basename(item.image);

		// Truncate context if it's too long
		let context = item.context;
		if (context.length > 100) {
			context = `${context.substring(0, 97)}...`;
		}

		table.push([item.article, imageName, String(item.line), context]);
	}

	console.log(table.toString());

	// Offer suggestions for fixing
	if (opts.fix) {
		spinner.start("Attempting to fix missing alt text");

		// Auto-fixing not implemented yet
		spinner.info("Automatic fixing of missing alt text is not implemented yet");
	}

	// Suggestions for adding good alt text
	console.log(chalk.cyan("\nGuidelines for writing good alt text:"));
	console.log("1. Be specific and descriptive about the image content.");
	console.log("2. Keep it concise (around 125 characters or less).");
	console.log(`3. Don't start with "Image of" or "Picture of".`);
	console.log(
		"4. Consider the context and purpose of the image in the article.",
	);
	console.log(`5. Include keywords when relevant, but don't keyword stuff.`);

	return { missing: missingAltText, total: articleFiles.length };
}
