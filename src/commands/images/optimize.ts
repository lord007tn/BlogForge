import path from "node:path";
import chalk from "chalk";
import fs from "fs-extra";
import sharp from "sharp";
import { logger } from "../../utils/logger";
import { getProjectPaths } from "../../utils/project";

export interface OptimizeImagesOptions {
	width?: number;
	quality?: number;
	verbose?: boolean;
	directory?: string;
}

export async function optimizeImages(
	opts: OptimizeImagesOptions,
): Promise<void> {
	const spinner = logger.spinner("Initializing image optimization");

	const width = opts.width || 1200;
	const quality = opts.quality || 80;

	// Get project paths
	let imagesDir: string;
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

		spinner.text = "Checking images directory";
	} catch (e) {
		logger.spinnerError(`Project validation failed: ${(e as Error).message}`);
		return;
	}

	// Check if images directory exists
	if (!(await fs.pathExists(imagesDir))) {
		spinner.text = "Creating images directory";
		try {
			await fs.mkdirp(imagesDir);
		} catch (error) {
			logger.spinnerError(
				`Failed to create images directory: ${(error as Error).message}`,
			);
			return;
		}
	}

	// Get image files
	spinner.text = "Finding images";
	let files: string[];

	try {
		files = (await fs.readdir(imagesDir)).filter((file) =>
			/\.(jpe?g|png|gif|webp|avif)$/i.test(file),
		);
	} catch (error) {
		logger.spinnerError(
			`Failed to read images directory: ${(error as Error).message}`,
		);
		return;
	}

	if (!files.length) {
		logger.spinnerWarn("No images found to optimize.");
		return;
	}

	spinner.text = `Found ${files.length} images to optimize`;

	// Process stats
	let successCount = 0;
	let errorCount = 0;
	let savedBytes = 0;

	// Process images
	for (const file of files) {
		const filePath = path.join(imagesDir, file);

		spinner.text = `Optimizing: ${file}`;

		try {
			// Get original file stats
			const originalStats = await fs.stat(filePath);
			const originalSize = originalStats.size;

			// Skip files that are too small to optimize further
			if (originalSize < 10000) {
				// 10KB
				if (opts.verbose) {
					console.log(
						chalk.gray(
							`Skipping ${file} - already small (${Math.round(
								originalSize / 1024,
							)}KB)`,
						),
					);
				}
				continue;
			}

			// Process with Sharp
			const imageBuffer = await fs.readFile(filePath);
			const ext = path.extname(file).toLowerCase();

			let optimizedBuffer: Buffer;

			if (ext === ".jpg" || ext === ".jpeg") {
				optimizedBuffer = await sharp(imageBuffer)
					.resize({ width, withoutEnlargement: true })
					.jpeg({ quality: quality, mozjpeg: true })
					.toBuffer();
			} else if (ext === ".png") {
				optimizedBuffer = await sharp(imageBuffer)
					.resize({ width, withoutEnlargement: true })
					.png({ quality: quality, compressionLevel: 9 })
					.toBuffer();
			} else if (ext === ".webp") {
				optimizedBuffer = await sharp(imageBuffer)
					.resize({ width, withoutEnlargement: true })
					.webp({ quality: quality })
					.toBuffer();
			} else if (ext === ".avif") {
				optimizedBuffer = await sharp(imageBuffer)
					.resize({ width, withoutEnlargement: true })
					.avif({ quality: quality })
					.toBuffer();
			} else if (ext === ".gif") {
				// For GIFs, just resize without reencoding to preserve animation
				optimizedBuffer = await sharp(imageBuffer, { animated: true })
					.resize({ width, withoutEnlargement: true })
					.toBuffer();
			} else {
				continue; // Skip unsupported formats
			}

			// Write optimized file
			await fs.writeFile(filePath, optimizedBuffer);

			// Calculate savings
			const newSize = optimizedBuffer.length;
			const saved = originalSize - newSize;
			const percentage = Math.round((saved / originalSize) * 100);

			if (saved > 0) {
				savedBytes += saved;
				successCount++;

				if (opts.verbose) {
					console.log(
						`${chalk.green("✓")} ${file}: ${chalk.green(
							`${percentage}% smaller`,
						)} ` +
							`(${Math.round(originalSize / 1024)}KB → ${Math.round(
								newSize / 1024,
							)}KB)`,
					);
				}
			} else {
				// No savings, revert to original
				await fs.writeFile(filePath, imageBuffer);

				if (opts.verbose) {
					console.log(
						`${chalk.yellow("⚠")} ${file}: ${chalk.yellow(
							"no improvements",
						)} (kept original)`,
					);
				}
			}
		} catch (error) {
			errorCount++;

			if (opts.verbose) {
				console.log(`${chalk.red("✖")} ${file}: ${(error as Error).message}`);
			}
		}
	}

	// Show results
	spinner.succeed(`Optimized ${successCount} of ${files.length} images`);

	if (savedBytes > 0) {
		// Calculate readable size
		let savedSize: string;
		if (savedBytes < 1024) {
			savedSize = `${savedBytes} bytes`;
		} else if (savedBytes < 1024 * 1024) {
			savedSize = `${(savedBytes / 1024).toFixed(2)} KB`;
		} else {
			savedSize = `${(savedBytes / (1024 * 1024)).toFixed(2)} MB`;
		}

		console.log(chalk.green(`\nTotal space saved: ${savedSize}`));
	}

	if (errorCount > 0) {
		console.log(
			chalk.yellow(`\n${errorCount} image(s) could not be optimized.`),
		);
	}
}
