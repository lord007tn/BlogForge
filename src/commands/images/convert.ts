import path from "node:path";
import chalk from "chalk";
import fs from "fs-extra";
import sharp from "sharp";
import { logger } from "../../utils/logger";
import { getProjectPaths } from "../../utils/project";

export async function convertImages(opts: {
	to?: string;
	verbose?: boolean;
	directory?: string;
	quality?: number;
}) {
	const spinner = logger.spinner("Initializing image conversion");

	const format = opts.to || "avif";
	const quality = opts.quality || 80;

	// Validate format
	const validFormats = ["avif", "webp", "jpeg", "jpg", "png"];
	if (!validFormats.includes(format)) {
		logger.spinnerError(
			`Invalid output format: ${format}. Valid formats: ${validFormats.join(", ")}`,
		);
		return;
	}

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
		logger.spinnerError(`Images directory not found: ${imagesDir}`);
		return;
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
		logger.spinnerWarn("No images found to convert.");
		return;
	}

	spinner.text = `Found ${files.length} images to process`;

	// Process stats
	let convertedCount = 0;
	let errorCount = 0;
	let savedBytes = 0;

	// Process images
	for (const file of files) {
		const filePath = path.join(imagesDir, file);
		const fileExt = path.extname(file).toLowerCase().slice(1);

		// Skip files already in target format
		if (
			fileExt === format ||
			(format === "jpg" && fileExt === "jpeg") ||
			(format === "jpeg" && fileExt === "jpg")
		) {
			if (opts.verbose) {
				console.log(
					chalk.gray(`Skipping ${file} - already in ${format} format`),
				);
			}
			continue;
		}

		spinner.text = `Converting: ${file} to ${format}`;

		try {
			// Read original file
			const imageBuffer = await fs.readFile(filePath);
			const originalSize = imageBuffer.length;

			// Get base name without extension
			const baseName = path.basename(file, path.extname(file));

			// Prepare output path
			const outputPath = path.join(imagesDir, `${baseName}.${format}`);

			// Convert image
			let outputBuffer: Buffer;
			const sharpInstance = sharp(imageBuffer);

			if (format === "avif") {
				outputBuffer = await sharpInstance.avif({ quality }).toBuffer();
			} else if (format === "webp") {
				outputBuffer = await sharpInstance.webp({ quality }).toBuffer();
			} else if (format === "jpeg" || format === "jpg") {
				outputBuffer = await sharpInstance
					.jpeg({ quality, mozjpeg: true })
					.toBuffer();
			} else if (format === "png") {
				outputBuffer = await sharpInstance
					.png({ quality, compressionLevel: 9 })
					.toBuffer();
			} else {
				throw new Error(`Unsupported output format: ${format}`);
			}

			// Write converted file
			await fs.writeFile(outputPath, outputBuffer);

			// Calculate size difference
			const newSize = outputBuffer.length;
			const saved = originalSize - newSize;
			const percentage = Math.round((saved / originalSize) * 100);

			// Keep track of total savings
			savedBytes += saved;
			convertedCount++;

			if (opts.verbose) {
				console.log(
					`${chalk.green("✓")} ${file} → ${baseName}.${format}: ` +
						`${percentage > 0 ? chalk.green(`${percentage}% smaller`) : chalk.yellow(`${Math.abs(percentage)}% larger`)} ` +
						`(${Math.round(originalSize / 1024)}KB → ${Math.round(newSize / 1024)}KB)`,
				);
			}
		} catch (error) {
			errorCount++;

			if (opts.verbose) {
				console.log(`${chalk.red("✖")} ${file}: ${(error as Error).message}`);
			}
		}
	}

	// Show results
	spinner.succeed(
		`Converted ${convertedCount} of ${files.length} images to ${format} format`,
	);

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
	} else if (savedBytes < 0) {
		// Negative savings (files got larger)
		let increasedSize: string;
		const increasedBytes = Math.abs(savedBytes);

		if (increasedBytes < 1024) {
			increasedSize = `${increasedBytes} bytes`;
		} else if (increasedBytes < 1024 * 1024) {
			increasedSize = `${(increasedBytes / 1024).toFixed(2)} KB`;
		} else {
			increasedSize = `${(increasedBytes / (1024 * 1024)).toFixed(2)} MB`;
		}

		console.log(chalk.yellow(`\nTotal size increased: ${increasedSize}`));
	}

	if (errorCount > 0) {
		console.log(
			chalk.yellow(`\n${errorCount} image(s) could not be converted.`),
		);
	}
}
