import path from "node:path";
import chalk from "chalk";
import Table from "cli-table3";
import fs from "fs-extra";
import {
	extractFrontmatter,
	getFrontMatterEntry,
} from "../../utils/frontmatter";
import { logger } from "../../utils/logger";
import { getProjectPaths } from "../../utils/project";

export async function listArticles(opts: { verbose?: boolean }) {
	const spinner = logger.spinner("Finding articles");

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
		logger.spinnerWarn("No articles found.");
		return;
	}

	// Create a table for displaying articles
	const table = new Table({
		head: [
			chalk.cyan("Status"),
			chalk.cyan("Title"),
			chalk.cyan("Author"),
			chalk.cyan("Date"),
			chalk.cyan("File"),
		],
		style: {
			head: [],
			border: [],
		},
	});

	// Process each article
	spinner.text = "Processing articles";
	for (const file of files) {
		const filePath = path.join(articlesDir, file);
		const content = await fs.readFile(filePath, "utf-8");
		const { frontmatter } = extractFrontmatter(content);

		// Extract data for display
		const status = frontmatter.idDraft
			? chalk.yellow("DRAFT")
			: chalk.green("PUBLISHED");

		// Use the utility to get proper value from multilingual field
		const title = getFrontMatterEntry(frontmatter, "title");
		const author = getFrontMatterEntry(frontmatter, "author");
		const publishedAt = frontmatter.publishedAt
			? String(frontmatter.publishedAt)
			: "";

		// Add row to table
		table.push([
			status,
			chalk.white(title || file),
			author,
			publishedAt,
			chalk.dim(file),
		]);
	}

	// Stop spinner and show results
	spinner.stop();

	// Add header with count of articles
	console.log(chalk.bold(`\nFound ${files.length} articles:\n`));
	console.log(table.toString());

	// Show summary
	const draftCount = (table as string[][]).filter((row) =>
		row[0]?.includes("DRAFT"),
	).length;
	const publishedCount = files.length - draftCount;

	console.log(
		`\n${chalk.green(publishedCount)} published, ${chalk.yellow(
			draftCount,
		)} drafts\n`,
	);
}
