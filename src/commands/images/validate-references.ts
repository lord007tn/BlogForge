import path from "node:path";
import chalk from "chalk";
import Table from "cli-table3";
import fs from "fs-extra";
import { logger } from "../../utils/logger";
import { getProjectPaths } from "../../utils/project";

export async function validateImageReferences(opts: {
	verbose?: boolean;
	fix?: boolean;
}) {
	const spinner = logger.spinner("Validating image references");

	// Get project paths
	let articlesDir: string;
	let imagesDir: string;

	try {
		const paths = await getProjectPaths(process.cwd());
		articlesDir = paths.articles;
		imagesDir = path.join(paths.public, "images");

		spinner.text = "Checking directories";
	} catch (e) {
		logger.spinnerError(`Project validation failed: ${(e as Error).message}`);
		return;
	}

	// Check if directories exist
	if (!(await fs.pathExists(articlesDir))) {
		logger.spinnerError(`Articles directory not found: ${articlesDir}`);
		return;
	}

	if (!(await fs.pathExists(imagesDir))) {
		logger.spinnerError(`Images directory not found: ${imagesDir}`);
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

	// Get available images
	spinner.text = "Indexing available images";
	let availableImages: string[];

	try {
		availableImages = await fs.readdir(imagesDir);
	} catch (error) {
		logger.spinnerError(
			`Failed to read images directory: ${(error as Error).message}`,
		);
		return;
	}

	// Track broken references
	const brokenReferences: Array<{
		article: string;
		image: string;
		type: "featured" | "inline";
		line?: number;
	}> = [];

	// Check each article
	spinner.text = "Checking image references in articles";

	for (const articleFile of articleFiles) {
		if (opts.verbose) {
			spinner.text = `Checking ${articleFile}`;
		}

		const filePath = path.join(articlesDir, articleFile);

		try {
			const content = await fs.readFile(filePath, "utf-8");
			const lines = content.split("\n");

			// Check image references in frontmatter
			const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);

			if (frontmatterMatch) {
				const frontmatter = frontmatterMatch[1];
				const imageMatch = frontmatter.match(/image:\s*["']?([^"'\s]+)["']?/);

				if (imageMatch) {
					const image = imageMatch[1];

					// Only check local images, not external URLs
					if (!image.startsWith("http")) {
						const imageName = path.basename(image);

						if (!availableImages.includes(imageName)) {
							brokenReferences.push({
								article: articleFile,
								image,
								type: "featured",
							});
						}
					}
				}
			}

			// Check inline image references
			for (let i = 0; i < lines.length; i++) {
				const line = lines[i];
				const imageMatches = [...line.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g)];

				for (const match of imageMatches) {
					const image = match[2];

					// Only check local images, not external URLs
					if (!image.startsWith("http")) {
						const imageName = path.basename(image);

						if (!availableImages.includes(imageName)) {
							brokenReferences.push({
								article: articleFile,
								image,
								type: "inline",
								line: i + 1,
							});
						}
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
	if (brokenReferences.length === 0) {
		console.log(
			chalk.green(
				`\nAll image references in ${articleFiles.length} articles are valid! 🎉`,
			),
		);
		return { broken: [], total: articleFiles.length };
	}

	console.log(
		chalk.yellow(
			`\nFound ${brokenReferences.length} broken image references:\n`,
		),
	);

	// Create table for display
	const table = new Table({
		head: [
			chalk.cyan("Article"),
			chalk.cyan("Image"),
			chalk.cyan("Type"),
			chalk.cyan("Line"),
		],
		style: {
			head: [],
			border: [],
		},
	});

	for (const ref of brokenReferences) {
		table.push([
			ref.article,
			ref.image,
			ref.type === "featured" ? "Featured" : "Inline",
			ref.line ? String(ref.line) : "Frontmatter",
		]);
	}

	console.log(table.toString());

	// Offer suggestions for fixing
	if (opts.fix) {
		console.log(
			chalk.yellow(
				"\nAutomatic fixing of broken image references is not supported yet.",
			),
		);
	}

	// Suggestions for manual fixes
	console.log(chalk.cyan("\nSuggestions:"));
	console.log("1. Make sure the image files exist in the images directory.");
	console.log("2. Check for typos in image filenames.");
	console.log(
		`3. Use relative paths like 'images/filename.jpg' or '/images/filename.jpg'.`,
	);

	return { broken: brokenReferences, total: articleFiles.length };
}
