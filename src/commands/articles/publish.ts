import path from "node:path";
import fs from "fs-extra";
import prompts from "prompts"; 
import { extractFrontmatter, updateFrontmatter } from "../../utils/frontmatter";
import { logger } from "../../utils/logger";
import { getProjectPaths } from "../../utils/project";

export async function publishArticle(opts: {
	file?: string;
	verbose?: boolean;
}) {
	const spinner = logger.spinner("Initializing publish process");

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

	// Find draft articles
	spinner.text = "Finding draft articles";
	const draftFiles = [];

	for (const file of files) {
		const content = await fs.readFile(path.join(articlesDir, file), "utf-8");
		const { frontmatter } = extractFrontmatter(content);

		if (frontmatter.idDraft === true) {
			draftFiles.push(file);
		}
	}

	if (!draftFiles.length) {
		logger.spinnerWarn("No draft articles to publish.");
		return;
	}

	// If no file specified, list available drafts
	let targetFile = opts.file; 
	if (!targetFile) {
		spinner.stop(); 
		const response = await prompts({
			type: "select",
			name: "selectedFile",
			message: "Select a draft article to publish:",
			choices: draftFiles.map((f) => ({ title: f, value: f })),
		});

		if (!response.selectedFile) {
			logger.info("No article selected. Aborting.");
			return;
		}
		targetFile = response.selectedFile;
		spinner.start("Publishing article"); 
	}

	// Verify target file exists and is a draft
	if (!targetFile || !draftFiles.includes(targetFile)) { // Added null check for targetFile
		logger.spinnerError(
			`File '${targetFile || ""}' is not a draft or does not exist.`,
		);
		return;
	}

	// Update the file to remove draft status
	spinner.text = "Publishing article";
	const filePath = path.join(articlesDir, targetFile); // targetFile is now guaranteed to be a string
	const content = await fs.readFile(filePath, "utf-8");
	const { frontmatter, content: _body } = extractFrontmatter(content);

	frontmatter.idDraft = false;

	// Set updatedAt to current date if not already set
	if (!frontmatter.updatedAt) {
		const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
		frontmatter.updatedAt = today;
	}

	const newContent = updateFrontmatter(content, frontmatter);

	try {
		await fs.writeFile(filePath, newContent, "utf-8");
		logger.spinnerSuccess(`Published article: ${targetFile}`);
	} catch (error) {
		logger.spinnerError(
			`Failed to publish article: ${(error as Error).message}`,
		);
	}
}
