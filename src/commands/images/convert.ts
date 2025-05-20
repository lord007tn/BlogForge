import path from "node:path";
import chalk from "chalk";
import Table from "cli-table3";
import fs from "fs-extra";
import sharp from "sharp";
import { logger } from "../../utils/logger";
import { getProjectPaths } from "../../utils/project";
import { defineCommand, runMain } from "citty";
import prompts from "prompts";

// Supported output formats
const validFormats = ["avif", "webp", "jpeg", "png"];

export const command = defineCommand({
	meta: {
		name: "convert",
		description: "Convert images to different formats",
	},
	args: {
		to: {
			type: "string",
			alias: "t",
			description: "Output format (avif, webp, jpeg, png)",
		},
		quality: {
			type: "string", // Changed to string to parse as number later
			alias: "q",
			description: "Output quality (1-100)",
		},
		directory: {
			type: "string",
			alias: "d",
			description: "Directory containing images (defaults to public/images)",
		},
		verbose: {
			type: "boolean",
			alias: "v",
			description: "Enable verbose logging",
		},
		all: {
			type: "boolean",
			alias: "a",
			description: "Convert all images without prompting",
		},
	},
	async run({ args }) {
		await convertImages({
			to: args.to,
			quality: args.quality ? Number.parseInt(args.quality) : undefined,
			verbose: args.verbose,
			directory: args.directory,
			all: args.all,
		});
	},
});

export async function convertImages(opts: {
	to?: string;
	verbose?: boolean;
	directory?: string;
	quality?: number;
	all?: boolean;
}) {
	const spinner = logger.spinner("Initializing image conversion");

	// Get project paths
	let imagesDir: string;
	try {
		const paths = await getProjectPaths(process.cwd());
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

	// logger.info(`[Debug] Attempting to use images directory: ${imagesDir}`); // Removed debug

	if (!(await fs.pathExists(imagesDir))) {
		logger.spinnerError(`Images directory not found: ${imagesDir}`);
		return;
	}

	spinner.text = "Finding images";
	let allImageFiles: string[];
	try {
		const rawFiles = await fs.readdir(imagesDir);
		// logger.info(`[Debug] Raw files found in ${imagesDir}: ${rawFiles.join(", ")}`); // Removed debug
		allImageFiles = rawFiles.filter((file) =>
			/\.(jpe?g|png|gif|webp|avif)$/i.test(file),
		);
		// logger.info(`[Debug] Filtered image files: ${allImageFiles.join(", ")}`); // Removed debug
	} catch (error) {
		logger.spinnerError(
			`Failed to read images directory: ${(error as Error).message}`,
		);
		return;
	}

	if (!allImageFiles.length) {
		logger.spinnerWarn("No images found to convert.");
		return;
	}

	let filesToProcess: string[];
	if (opts.all) {
		filesToProcess = allImageFiles;
		spinner.text = "All images selected for conversion."; // Update spinner text
	} else {
		spinner.stop(); // Stop spinner before prompting
		const imageResponse = await prompts({
			type: "multiselect",
			name: "selectedFiles",
			message: "Select images to convert (space to select, enter to confirm):",
			choices: allImageFiles.map((file) => ({ title: file, value: file })),
			hint: "- Space to select. Return to submit",
			validate: (value: string[]) =>
				value.length > 0 ? true : "Please select at least one image.",
		});
		if (!imageResponse.selectedFiles || imageResponse.selectedFiles.length === 0) {
			logger.spinnerWarn("No images selected for conversion.");
			return;
		}
		filesToProcess = imageResponse.selectedFiles;
		spinner.start("Image selection complete."); // Restart spinner or update text
	}

	if (!filesToProcess.length) { // Should be caught by prompt validation
		logger.spinnerWarn("No images selected for conversion.");
		return;
	}
	
	let format = opts.to;

	// Always prompt if 'to' is not provided or not a valid format initially
	if (!format || !validFormats.includes(format)) { 
		spinner.stop(); // Stop spinner before prompting
		const formatResponse = await prompts({
			type: "select",
			name: "selectedFormat",
			message: "Select the output format:",
			choices: validFormats.map((f) => ({ title: f.toUpperCase(), value: f })),
			initial: 0, // Default to AVIF
		});
		if (!formatResponse.selectedFormat) {
			logger.spinnerWarn("No output format selected.");
			return;
		}
		format = formatResponse.selectedFormat;
		spinner.start(); // Restart spinner
	}

	// This check remains as a safeguard, though the prompt logic above should handle most cases
	if (!format || !validFormats.includes(format)) {
		logger.spinnerError(
			`Invalid output format: ${format}. Valid formats: ${validFormats.join(", ")}`,
		);
		return;
	}

	let conversionQuality = opts.quality || 80; // Default quality from opts or 80

	if (format === "png") {
		spinner.stop(); // Stop spinner before prompting
		const pngQualityResponse = await prompts({
			type: "number",
			name: "pngQuality",
			message: "Enter PNG quality (1-100):",
			initial: conversionQuality, // Use general quality as default
			min: 1,
			max: 100,
			validate: (val: number) =>
				(val >= 1 && val <= 100) || "Quality must be between 1 and 100.",
		});
		if (pngQualityResponse.pngQuality === undefined) { // Handle prompt cancellation
			logger.spinnerWarn("PNG quality selection cancelled. Using default/provided quality.");
		} else {
			conversionQuality = pngQualityResponse.pngQuality;
		}
		spinner.start(); // Restart spinner
	}
	
	spinner.text = `Processing ${filesToProcess.length} images to ${format} format with quality ${conversionQuality}`;



	let convertedCount = 0;
	let errorCount = 0;
	let savedBytes = 0;
	const results: Array<{
		file: string;
		output: string;
		originalSize: number;
		newSize: number;
		percent: number;
		status: string;
		error?: string;
	}> = [];

	for (const file of filesToProcess) {
		const filePath = path.join(imagesDir, file);
		const fileExt = path.extname(file).toLowerCase().slice(1);
		let status = "Success";
		let errorMsg = "";
		let originalSize = 0;
		let newSize = 0;
		let percent = 0;
		let output = "-";

		if (
			fileExt === format ||
			(format === "jpg" && fileExt === "jpeg") ||
			(format === "jpeg" && fileExt === "jpg")
		) {
			status = "Skipped";
			errorMsg = `Already in ${format}`;
			results.push({ file, output: file, originalSize: 0, newSize: 0, percent: 0, status, error: errorMsg });
			continue;
		}

		spinner.text = `Converting: ${file} to ${format}`;

		try {
			const imageBuffer = await fs.readFile(filePath);
			originalSize = imageBuffer.length;
			const baseName = path.basename(file, path.extname(file));
			output = `${baseName}.${format}`;
			const outputPath = path.join(imagesDir, output);

			let outputBuffer: Buffer;
			const sharpInstance = sharp(imageBuffer);

			if (format === "avif") {
				outputBuffer = await sharpInstance.avif({ quality: conversionQuality }).toBuffer();
			} else if (format === "webp") {
				outputBuffer = await sharpInstance.webp({ quality: conversionQuality }).toBuffer();
			} else if (format === "jpeg" || format === "jpg") {
				outputBuffer = await sharpInstance
					.jpeg({ quality: conversionQuality, mozjpeg: true })
					.toBuffer();
			} else if (format === "png") {
				outputBuffer = await sharpInstance
					.png({ quality: conversionQuality, compressionLevel: 9 })
					.toBuffer();
			} else {
				throw new Error(`Unsupported output format: ${format}`);
			}

			await fs.writeFile(outputPath, outputBuffer);
			newSize = outputBuffer.length;
			const saved = originalSize - newSize;
			percent = Math.round((saved / originalSize) * 100);

			savedBytes += saved;
			convertedCount++;
			status = "Converted";
			results.push({ file, output, originalSize, newSize, percent, status });
		} catch (error) {
			errorCount++;
			status = "Error";
			errorMsg = (error as Error).message;
			results.push({ file, output, originalSize, newSize, percent, status, error: errorMsg });
		}
	}


	// Output results as a table
	spinner.stop();
	const table = new Table({
		head: [
			chalk.cyan("Image"),
			chalk.cyan("Output"),
			chalk.cyan("Original Size"),
			chalk.cyan("New Size"),
			chalk.cyan("% Saved"),
			chalk.cyan("Status"),
			chalk.cyan("Error")
		],
		style: { head: [], border: [] },
	});
	for (const r of results) {
		table.push([
			chalk.white(r.file),
			chalk.yellowBright(r.output),
			r.originalSize ? chalk.gray(`${Math.round(r.originalSize / 1024)} KB`) : "-",
			r.newSize ? chalk.gray(`${Math.round(r.newSize / 1024)} KB`) : "-",
			r.originalSize ? (r.percent > 0 ? chalk.green(`${r.percent}%`) : chalk.yellow(`${Math.abs(r.percent)}%`)) : "-",
			r.status === "Converted" ? chalk.green(r.status) : r.status === "Skipped" ? chalk.gray(r.status) : chalk.red(r.status),
			r.error ? chalk.red(r.error) : ""
		]);
	}
	console.log(chalk.bold("\nImage Conversion Results:"));
	console.log(table.toString());

	if (convertedCount > 0) {
		spinner.succeed(
			`Successfully converted ${convertedCount} of ${filesToProcess.length} selected images to ${format} format`,
		);
	} else if (filesToProcess.length > 0 && errorCount === filesToProcess.length) {
		spinner.fail(
			`Failed to convert all ${filesToProcess.length} selected images.`,
		);
	} else if (filesToProcess.length > 0) { // Some errors, some successes (already logged individually)
		spinner.warn(`Completed processing ${filesToProcess.length} images with ${errorCount} error(s).`);
	} else {
		spinner.info("No images were processed."); // Should not happen if selections are made
	}


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
			chalk.yellow(`\\n${errorCount} image(s) could not be converted. Run with --verbose for more details.`),
		);
	}
}

// Add this to allow running the command directly
if (process.argv[1]?.includes("convert")) {
	runMain(command);
}
