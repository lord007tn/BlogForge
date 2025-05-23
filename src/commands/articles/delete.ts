import path from "node:path";
import fs from "fs-extra";
import prompts from "prompts";
import { logger } from "../../utils/logger";
import { getProjectPaths } from "../../utils/project";
import {
	extractFrontmatter,
	getFrontMatterEntry,
} from "../../utils/frontmatter";

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
		if (!paths.articles) {
			logger.spinnerError(
				"Articles directory not found in project configuration.",
			);
			return;
		}
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
	let files: string[];
	try {
		const allFiles = await fs.readdir(articlesDir);
		files = allFiles.filter((f) => f.endsWith(".md"));
	} catch (e) {
		logger.spinnerError(
			`Failed to read articles directory: ${(e as Error).message}`,
		);
		return;
	}

	if (!files.length) {
		logger.spinnerWarn("No articles to delete.");
		return;
	}

	// If no file specified, list available articles
	let targetFile = opts.file;
	if (!targetFile) {
		spinner.stop();
		const fileOptions = [];
		for (const file of files) {
			const filePath = path.join(articlesDir, file);
			const content = await fs.readFile(filePath, "utf-8");
			const { frontmatter } = extractFrontmatter(content);
			const title = getFrontMatterEntry(frontmatter, "title");
			fileOptions.push({
				title: `${title || file}`,
				value: file,
			});
		}

		const response = await prompts({
			type: "select",
			name: "file",
			message: "Select an article to delete:",
			choices: fileOptions,
		});

		targetFile = response.file;

		if (!targetFile) {
			logger.error("No article selected for deletion.");
			return;
		}
		spinner.start("Preparing to delete selected article");
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
