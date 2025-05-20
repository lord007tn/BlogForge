import path from "node:path";
import chalk from "chalk";
import fs from "fs-extra";
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
	const targetFile = opts.file;
	if (!targetFile) {
		logger.spinnerWarn(
			"Please specify a draft file to publish using --file <filename>.",
		);

		console.log(chalk.cyan("\nAvailable drafts:"));
		for (const f of draftFiles) {
			console.log(`- ${f}`);
		}
		return;
	}

	// Verify target file exists and is a draft
	if (!draftFiles.includes(targetFile)) {
		logger.spinnerError(
			`File '${targetFile}' is not a draft or does not exist.`,
		);
		return;
	}

	// Update the file to remove draft status
	spinner.text = "Publishing article";
	const filePath = path.join(articlesDir, targetFile);
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
