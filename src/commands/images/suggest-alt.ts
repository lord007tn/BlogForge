import path from "node:path";
import chalk from "chalk";
import Table from "cli-table3";
import fs from "fs-extra";
import { logger } from "../../utils/logger";
import { getProjectPaths } from "../../utils/project";

// Interface for alt text issues
interface AltTextIssue {
	article: string;
	image: string;
	line: number;
	context: string;
	issue: "missing" | "empty" | "too_short" | "too_generic";
	alt?: string;
}

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
		// Get files recursively to include subdirectories
		articleFiles = await getMarkdownFiles(articlesDir);
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

	// Track images with alt text issues
	const altTextIssues: AltTextIssue[] = [];

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

					// Get context (the surrounding text)
					const startLine = Math.max(0, i - 2);
					const endLine = Math.min(lines.length - 1, i + 2);
					const context = lines.slice(startLine, endLine + 1).join("\n");

					// Check different alt text issues
					if (!alt) {
						// Missing alt text
						altTextIssues.push({
							article: articleFile,
							image,
							line: i + 1,
							context,
							issue: "missing",
						});
					} else if (alt.trim() === "") {
						// Empty alt text
						altTextIssues.push({
							article: articleFile,
							image,
							line: i + 1,
							context,
							issue: "empty",
						});
					} else if (alt.trim().length < 5) {
						// Too short alt text
						altTextIssues.push({
							article: articleFile,
							image,
							line: i + 1,
							context,
							issue: "too_short",
							alt: alt.trim(),
						});
					} else if (isGenericAltText(alt.trim())) {
						// Generic alt text
						altTextIssues.push({
							article: articleFile,
							image,
							line: i + 1,
							context,
							issue: "too_generic",
							alt: alt.trim(),
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
	if (altTextIssues.length === 0) {
		console.log(
			chalk.green(
				`\nAll images in ${articleFiles.length} articles have good alt text! 🎉`,
			),
		);
		return { missing: [], total: articleFiles.length };
	}

	console.log(
		chalk.yellow(
			`\nFound ${altTextIssues.length} images with alt text issues:\n`,
		),
	);

	// Create table for display
	const table = new Table({
		head: [
			chalk.cyan("Article"),
			chalk.cyan("Issue"),
			chalk.cyan("Current Alt"),
			chalk.cyan("Line"),
		],
		style: {
			head: [],
			border: [],
		},
		colWidths: [30, 20, 30, 10],
		wordWrap: true,
	});

	for (const item of altTextIssues) {
		// Format issue type
		let issueType: string;
		switch (item.issue) {
			case "missing":
				issueType = "Missing";
				break;
			case "empty":
				issueType = "Empty";
				break;
			case "too_short":
				issueType = "Too short";
				break;
			case "too_generic":
				issueType = "Too generic";
				break;
		}

		table.push([
			item.article,
			issueType,
			item.alt || "(none)",
			String(item.line),
		]);
	}

	console.log(table.toString());

	// Offer suggestions for fixing
	if (opts.fix) {
		spinner.start("Attempting to fix alt text issues");

		// Auto-fixing not implemented yet
		spinner.info("Automatic fixing of alt text issues is not implemented yet");
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

	return { missing: altTextIssues, total: articleFiles.length };
}

/**
 * Recursively get all Markdown files from a directory and its subdirectories
 */
async function getMarkdownFiles(dir: string, base = ""): Promise<string[]> {
	const files = await fs.readdir(dir);
	const result: string[] = [];

	for (const file of files) {
		const filePath = path.join(dir, file);
		const stat = await fs.stat(filePath);
		const relativePath = base ? path.join(base, file) : file;

		if (stat.isDirectory()) {
			result.push(...(await getMarkdownFiles(filePath, relativePath)));
		} else if (file.endsWith(".md")) {
			result.push(relativePath);
		}
	}

	return result;
}

/**
 * Check if alt text is too generic
 */
function isGenericAltText(alt: string): boolean {
	const genericPhrases = [
		"image",
		"picture",
		"photo",
		"screenshot",
		"illustration",
		"image of",
		"picture of",
		"photo of",
		"screenshot of",
		"illustration of",
		"thumbnail",
		"icon",
		"logo",
		"banner",
		"graphic",
	];

	const lowercaseAlt = alt.toLowerCase();

	// Check for single-word generic terms
	if (genericPhrases.includes(lowercaseAlt)) {
		return true;
	}

	// Check for phrases that start with generic terms
	for (const phrase of genericPhrases) {
		if (lowercaseAlt.startsWith(`${phrase} `)) {
			return true;
		}
	}

	return false;
}
