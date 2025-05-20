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

export async function listCategories(opts: { verbose?: boolean }) {
	const spinner = logger.spinner("Finding categories");

	// Get project paths
	let categoriesDir: string;
	try {
		const paths = await getProjectPaths(process.cwd());
		categoriesDir = paths.categories;
		spinner.text = "Checking categories directory";
	} catch (e) {
		logger.spinnerError(`Project validation failed: ${(e as Error).message}`);
		return;
	}

	// Check if categories directory exists
	if (!(await fs.pathExists(categoriesDir))) {
		logger.spinnerError("No categories directory found.");
		return;
	}

	// Get category files
	spinner.text = "Reading category files";
	const files = (await fs.readdir(categoriesDir)).filter((f) =>
		f.endsWith(".md"),
	);

	if (!files.length) {
		logger.spinnerWarn("No categories found.");
		return;
	}

	// Create table for display
	const table = new Table({
		head: [
			chalk.cyan("Slug"),
			chalk.cyan("Title"),
			chalk.cyan("Description"),
			chalk.cyan("Has Image"),
			chalk.cyan("Has Icon"),
		],
		style: {
			head: [],
			border: [],
		},
	});

	// Process each category
	spinner.text = "Processing categories";

	// Track article counts by category
	const articleCounts: Record<string, number> = {};

	// Get articles directory to count articles per category
	let articlesDir: string;
	try {
		const paths = await getProjectPaths(process.cwd());
		articlesDir = paths.articles;

		if (await fs.pathExists(articlesDir)) {
			const articleFiles = await fs.readdir(articlesDir);

			// Count articles by category
			for (const file of articleFiles) {
				if (!file.endsWith(".md")) continue;

				const content = await fs.readFile(
					path.join(articlesDir, file),
					"utf-8",
				);
				const { frontmatter } = extractFrontmatter(content);

				if (frontmatter.category) {
					const category = String(frontmatter.category);
					articleCounts[category] = (articleCounts[category] || 0) + 1;
				}
			}
		}
	} catch (error) {
		// Continue even if can't count articles
		if (opts.verbose) {
			console.log(
				chalk.yellow(
					`Warning: Could not count articles: ${(error as Error).message}`,
				),
			);
		}
	}

	for (const file of files) {
		const filePath = path.join(categoriesDir, file);
		const content = await fs.readFile(filePath, "utf-8");
		const { frontmatter } = extractFrontmatter(content);

		const slug = path.basename(file, ".md");
		const title = getFrontMatterEntry(frontmatter, "title");
		const description = getFrontMatterEntry(frontmatter, "description");
		const hasImage = !!frontmatter.image;
		const hasIcon = !!frontmatter.icon;
		const articleCount = articleCounts[slug] || 0;

		table.push([
			chalk.green(slug) +
				(articleCount > 0 ? chalk.gray(` (${articleCount} articles)`) : ""),
			title,
			description.length > 50
				? `${description.substring(0, 47)}...`
				: description,
			hasImage ? chalk.green("✓") : chalk.gray("-"),
			hasIcon ? chalk.green("✓") : chalk.gray("-"),
		]);
	}

	// Stop spinner and show results
	spinner.stop();

	console.log(chalk.bold(`\nFound ${files.length} categories:\n`));
	console.log(table.toString());
}
