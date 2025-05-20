import path from "node:path";
import chalk from "chalk";
import fs from "fs-extra";
import prompts from "prompts";
import { logger } from "../../utils/logger";
import { getProjectPaths } from "../../utils/project";

export interface DeleteArticleOptions {
	file?: string;
	verbose?: boolean;
	force?: boolean;
}

export async function deleteArticle(opts: DeleteArticleOptions): Promise<void> {
	const spinner = logger.spinner("Initializing delete process");

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
		logger.spinnerError("No articles directory found.");
		return;
	}

	// Get article files
	spinner.text = "Reading article files";
	const files = (await fs.readdir(articlesDir)).filter((f) =>
		f.endsWith(".md"),
	);

	if (!files.length) {
		logger.spinnerWarn("No articles to delete.");
		return;
	}

	// If no file specified, list available articles
	const targetFile = opts.file;
	if (!targetFile) {
		logger.spinnerWarn(
			"Please specify a file to delete using --file <filename>.",
		);

		console.log(chalk.cyan("\nAvailable articles:"));
		for (const f of files) {
			console.log(`- ${f}`);
		}
		return;
	}

	// Verify target file exists
	if (!files.includes(targetFile)) {
		logger.spinnerError(`File '${targetFile}' does not exist.`);
		return;
	}

	spinner.stop();

	// Ask for confirmation if not forced
	if (!opts.force) {
		const confirmation = await prompts({
			type: "confirm",
			name: "value",
			message: `Are you sure you want to delete the article '${targetFile}'? This cannot be undone.`,
			initial: false,
		});

		if (!confirmation.value) {
			logger.warning("Delete cancelled.");
			return;
		}
	}

	// Delete the file
	const spinner2 = logger.spinner("Deleting article");
	const filePath = path.join(articlesDir, targetFile);

	try {
		await fs.unlink(filePath);
		logger.spinnerSuccess(`Deleted article: ${targetFile}`);
	} catch (error) {
		logger.spinnerError(
			`Failed to delete article: ${(error as Error).message}`,
		);
	}
}
