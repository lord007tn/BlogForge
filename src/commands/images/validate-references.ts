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
		// Get all markdown files, including in subdirectories
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

	// Get available images with recursive scan
	spinner.text = "Indexing available images";
	let availableImagePaths: string[] = [];

	try {
		availableImagePaths = await getAllImagePaths(imagesDir);
		
		if (opts.verbose) {
			logger.info(`Found ${availableImagePaths.length} images in the images directory`);
		}
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
				// Get image from frontmatter, supporting both formats: 
				// image: path.jpg
				// image: "path.jpg"
				// image: 'path.jpg'
				const imageMatch = frontmatter.match(/image:\s*["']?([^"'\s,]+)["']?/);

				if (imageMatch) {
					const image = imageMatch[1];

					// Only check local images, not external URLs
					if (!isExternalUrl(image)) {
						if (!isImageAvailable(image, availableImagePaths, imagesDir)) {
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
					if (!isExternalUrl(image)) {
						if (!isImageAvailable(image, availableImagePaths, imagesDir)) {
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
			result.push(...await getMarkdownFiles(filePath, relativePath));
		} else if (file.endsWith(".md")) {
			result.push(relativePath);
		}
	}

	return result;
}

/**
 * Recursively get all image paths from a directory
 */
async function getAllImagePaths(dir: string, base = ""): Promise<string[]> {
	const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif", ".svg"];
	const files = await fs.readdir(dir);
	const result: string[] = [];

	for (const file of files) {
		const filePath = path.join(dir, file);
		const stat = await fs.stat(filePath);
		const relativePath = base ? path.join(base, file) : file;

		if (stat.isDirectory()) {
			result.push(...await getAllImagePaths(filePath, relativePath));
		} else if (imageExtensions.some(ext => file.toLowerCase().endsWith(ext))) {
			result.push(relativePath);
		}
	}

	return result;
}

/**
 * Check if a URL is external
 */
function isExternalUrl(url: string): boolean {
	return url.startsWith("http:") || url.startsWith("https:") || url.startsWith("//");
}

/**
 * Check if an image is available in the filesystem
 */
function isImageAvailable(imagePath: string, availableImagePaths: string[], baseImageDir: string): boolean {
	// Remove any leading slashes or 'public/'
	const normalizedPath = imagePath
		.replace(/^\/+/, '')
		.replace(/^public\//, '')
		.replace(/^images\//, '');
	
	// Direct match in available paths
	if (availableImagePaths.includes(normalizedPath)) {
		return true;
	}

	// Check if the file exists on disk (for absolute certainty)
	const absolutePath = path.join(baseImageDir, normalizedPath);
	if (fs.existsSync(absolutePath)) {
		return true;
	}

	return false;
}
