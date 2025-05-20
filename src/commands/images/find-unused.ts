import path from "node:path";
import chalk from "chalk";
import fs from "fs-extra";
import { extractFrontmatter } from "../../utils/frontmatter";
import { logger } from "../../utils/logger";
import { getProjectPaths } from "../../utils/project";

export interface FindUnusedImagesOptions {
	verbose?: boolean;
	directory?: string;
	delete?: boolean;
}

export async function findUnusedImages(opts: FindUnusedImagesOptions) {
	const spinner = logger.spinner("Finding unused images");

	// Get project paths
	let imagesDir: string;
	let articlesDir: string;

	try {
		const paths = await getProjectPaths(process.cwd());

		// Use custom directory if provided, or default to public/images
		if (opts.directory) {
			imagesDir = path.isAbsolute(opts.directory)
				? opts.directory
				: path.join(paths.root, opts.directory);
		} else {
			imagesDir = path.join(paths.public, "images");
		}

		articlesDir = paths.articles;

		spinner.text = "Checking directories";
	} catch (e) {
		logger.spinnerError(`Project validation failed: ${(e as Error).message}`);
		return;
	}

	// Check if directories exist
	if (!(await fs.pathExists(imagesDir))) {
		logger.spinnerError(`Images directory not found: ${imagesDir}`);
		return;
	}

	if (!(await fs.pathExists(articlesDir))) {
		logger.spinnerError(`Articles directory not found: ${articlesDir}`);
		return;
	}

	// Get all image files
	spinner.text = "Finding all images";
	let imageFiles: string[];

	try {
		imageFiles = (await fs.readdir(imagesDir)).filter((file) =>
			/\.(jpe?g|png|gif|webp|avif|svg)$/i.test(file),
		);
	} catch (error) {
		logger.spinnerError(
			`Failed to read images directory: ${
				error instanceof Error ? error.message : String(error)
			}`,
		);
		return;
	}

	if (!imageFiles.length) {
		logger.spinnerWarn("No images found to check.");
		return;
	}

	// Get all article files
	spinner.text = "Finding all articles";
	let articleFiles: string[];

	try {
		articleFiles = (await fs.readdir(articlesDir)).filter((file) =>
			file.endsWith(".md"),
		);
	} catch (error) {
		logger.spinnerError(
			`Failed to read articles directory: ${
				error instanceof Error ? error.message : String(error)
			}`,
		);
		return;
	}

	if (!articleFiles.length) {
		logger.spinnerWarn("No articles found to check against.");
		return;
	}

	// Track used images
	const usedImages = new Set<string>();

	// Check each article for image references
	spinner.text = "Analyzing image references in articles";

	for (const articleFile of articleFiles) {
		const filePath = path.join(articlesDir, articleFile);

		try {
			const content = await fs.readFile(filePath, "utf-8");
			const { frontmatter } = extractFrontmatter(content);

			// Check featured image in frontmatter
			if (frontmatter.image && typeof frontmatter.image === "string") {
				const imgPath = frontmatter.image;

				// Extract just the filename if it's a path
				if (imgPath.includes("/")) {
					const imgFilename = path.basename(imgPath);
					usedImages.add(imgFilename);
				} else {
					usedImages.add(imgPath);
				}
			}

			// Check inline images in markdown content
			const imageMatches = [...content.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g)];

			for (const match of imageMatches) {
				const imgPath = match[2];

				// Extract just the filename if it's a path
				if (imgPath.includes("/")) {
					const imgFilename = path.basename(imgPath);
					usedImages.add(imgFilename);
				} else {
					usedImages.add(imgPath);
				}
			}

			// Also check for images referenced in HTML
			const htmlImageMatches = [
				...content.matchAll(/<img[^>]*src=["']([^"']+)["'][^>]*>/g),
			];

			for (const match of htmlImageMatches) {
				const imgPath = match[1];

				// Extract just the filename if it's a path
				if (imgPath.includes("/")) {
					const imgFilename = path.basename(imgPath);
					usedImages.add(imgFilename);
				} else {
					usedImages.add(imgPath);
				}
			}
		} catch (error) {
			if (opts.verbose) {
				console.log(
					chalk.yellow(
						`Warning: Could not analyze ${articleFile}: ${
							(error as Error).message
						}`,
					),
				);
			}
		}
	}

	// Find unused images
	const unusedImages = imageFiles.filter((img) => !usedImages.has(img));

	spinner.stop();

	// Display results
	if (unusedImages.length === 0) {
		console.log(
			chalk.green(`\nAll ${imageFiles.length} images are being used! 🎉`),
		);
		return { unused: [], total: imageFiles.length };
	}

	console.log(
		chalk.yellow(
			`\nFound ${unusedImages.length} unused image(s) out of ${imageFiles.length} total:\n`,
		),
	);

	for (const img of unusedImages) {
		// Get file size
		const imgPath = path.join(imagesDir, img);
		let sizeInfo = "";

		try {
			const stats = await fs.stat(imgPath);
			const sizeKB = Math.round(stats.size / 1024);
			sizeInfo = chalk.gray(`(${sizeKB} KB)`);
		} catch (error) {
			// Ignore size errors
		}

		console.log(`${chalk.red("•")} ${img} ${sizeInfo}`);
	}

	// Calculate wasted space
	let totalWastedBytes = 0;

	for (const img of unusedImages) {
		try {
			const stats = await fs.stat(path.join(imagesDir, img));
			totalWastedBytes += stats.size;
		} catch (error) {
			// Ignore errors
		}
	}

	// Display wasted space
	if (totalWastedBytes > 0) {
		let wastedSpace: string;

		if (totalWastedBytes < 1024) {
			wastedSpace = `${totalWastedBytes} bytes`;
		} else if (totalWastedBytes < 1024 * 1024) {
			wastedSpace = `${(totalWastedBytes / 1024).toFixed(2)} KB`;
		} else {
			wastedSpace = `${(totalWastedBytes / (1024 * 1024)).toFixed(2)} MB`;
		}

		console.log(chalk.yellow(`\nTotal wasted space: ${wastedSpace}`));
	}

	// Delete unused images if requested
	if (opts.delete) {
		const spinner2 = logger.spinner("Deleting unused images");

		let deletedCount = 0;
		let errorCount = 0;

		for (const img of unusedImages) {
			const imgPath = path.join(imagesDir, img);

			try {
				await fs.unlink(imgPath);
				deletedCount++;
			} catch (error) {
				errorCount++;

				if (opts.verbose) {
					console.log(
						chalk.red(`Error deleting ${img}: ${(error as Error).message}`),
					);
				}
			}
		}

		if (deletedCount > 0) {
			spinner2.succeed(`Deleted ${deletedCount} unused images`);
		} else {
			spinner2.info("No images were deleted");
		}

		if (errorCount > 0) {
			console.log(chalk.yellow(`\nFailed to delete ${errorCount} image(s).`));
		}
	} else {
		console.log(
			chalk.cyan("\nRun with --delete to remove these unused images."),
		);
	}

	return { unused: unusedImages, total: imageFiles.length };
}
