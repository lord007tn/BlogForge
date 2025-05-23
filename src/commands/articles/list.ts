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

	if (!(await fs.pathExists(articlesDir))) {
		logger.spinnerError("No articles directory found.");
		return;
	}

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
		logger.spinnerWarn("No articles found.");
		return;
	}

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

	spinner.text = "Processing articles";
	for (const file of files) {
		const filePath = path.join(articlesDir, file);
		const content = await fs.readFile(filePath, "utf-8");
		const { frontmatter } = extractFrontmatter(content);

		const status = frontmatter.idDraft
			? chalk.yellow("DRAFT")
			: chalk.green("PUBLISHED");

		const title = getFrontMatterEntry(frontmatter, "title");
		const author = getFrontMatterEntry(frontmatter, "author");
		const publishedAt = frontmatter.publishedAt
			? String(frontmatter.publishedAt)
			: "";

		table.push([
			status,
			chalk.white(title || file),
			author,
			publishedAt,
			chalk.dim(file),
		]);
	}

	spinner.stop();

	console.log(chalk.bold(`\nFound ${files.length} articles:\n`));
	console.log(table.toString());

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
