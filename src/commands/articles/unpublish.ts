import path from "node:path";
import fs from "fs-extra";
import prompts from "prompts";
import { extractFrontmatter, updateFrontmatter } from "../../utils/frontmatter";
import { logger } from "../../utils/logger";
import { getProjectPaths } from "../../utils/project";

export async function unpublishArticle(opts: {
	file?: string;
	verbose?: boolean;
}) {
	const spinner = logger.spinner("Initializing unpublish process");

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
		logger.spinnerError("No articles found.");
		return;
	}

	// Find published articles
	spinner.text = "Finding published articles";
	const publishedFiles = [];

	for (const file of files) {
		const content = await fs.readFile(path.join(articlesDir, file), "utf-8");
		const { frontmatter } = extractFrontmatter(content);

		if (frontmatter.idDraft === false) {
			publishedFiles.push(file);
		}
	}

	if (!publishedFiles.length) {
		logger.spinnerWarn("No published articles to unpublish.");
		return;
	}

	// If no file specified, list available published articles
	let targetFile = opts.file;
	if (!targetFile) {
		spinner.stop(); // Stop spinner before showing prompts
		const response = await prompts({
			type: "select",
			name: "selectedFile",
			message: "Select a published article to unpublish:",
			choices: publishedFiles.map((f) => ({ title: f, value: f })),
		});

		if (!response.selectedFile) {
			logger.info("No article selected. Aborting.");
			return;
		}
		targetFile = response.selectedFile;
		spinner.start("Unpublishing article"); // Restart spinner
	}

	// Verify target file exists and is published
	if (!targetFile || !publishedFiles.includes(targetFile)) {
		logger.spinnerError(
			`File '${targetFile || ""}' is not published or does not exist.`,
		);
		return;
	}

	// Update the file to set draft status
	spinner.text = "Unpublishing article";
	const filePath = path.join(articlesDir, targetFile); // targetFile is now guaranteed to be a string
	const content = await fs.readFile(filePath, "utf-8");
	const { frontmatter, content: _body } = extractFrontmatter(content);

	frontmatter.idDraft = true;

	// Set updatedAt to current date
	const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
	frontmatter.updatedAt = today;

	const newContent = updateFrontmatter(content, frontmatter);

	try {
		await fs.writeFile(filePath, newContent, "utf-8");
		logger.spinnerSuccess(`Unpublished article: ${targetFile}`);
	} catch (error) {
		logger.spinnerError(
			`Failed to unpublish article: ${(error as Error).message}`,
		);
	}
}
