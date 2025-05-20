import path from "node:path";
import chalk from "chalk";
import fs from "fs-extra";
import Fuse from "fuse.js";
import {
	extractFrontmatter,
	getFrontMatterEntry,
} from "../../utils/frontmatter";
import { logger } from "../../utils/logger";
import { getProjectPaths } from "../../utils/project";

export async function searchArticles(opts: {
	query: string;
	inTags?: boolean;
	inContent?: boolean;
	author?: string;
	verbose?: boolean;
}) {
	const spinner = logger.spinner("Initializing search");

	if (!opts.query) {
		logger.spinnerError("Search query is required.");
		return;
	}

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
		logger.spinnerWarn("No articles found to search.");
		return;
	}

	// Collect articles data for search
	const articlesData = [];
	spinner.text = "Processing articles for search";

	for (const file of files) {
		spinner.text = `Indexing article: ${file}`;
		const filePath = path.join(articlesDir, file);
		const fileContent = await fs.readFile(filePath, "utf-8");
		const { frontmatter, content } = extractFrontmatter(fileContent);

		// Skip if author filter is provided and doesn't match
		if (opts.author && String(frontmatter.author) !== opts.author) {
			continue;
		}

		const articleData = {
			file,
			title: getFrontMatterEntry(frontmatter, "title"),
			description: getFrontMatterEntry(frontmatter, "description"),
			author: String(frontmatter.author || ""),
			tags: Array.isArray(frontmatter.tags)
				? frontmatter.tags
				: typeof frontmatter.tags === "string"
					? frontmatter.tags.split(",").map((t) => t.trim())
					: [],
			category: String(frontmatter.category || ""),
			content,
			keywords: String(frontmatter.keywords || ""),
		};

		articlesData.push(articleData);
	}

	// Set up search options based on user preferences
	spinner.text = "Performing search";
	const searchKeys = [];

	if (opts.inTags) {
		searchKeys.push("tags");
	} else if (opts.inContent) {
		searchKeys.push("content");
	} else {
		// Default search in metadata
		searchKeys.push("title", "description", "category", "keywords");
	}

	// Use Fuse.js for fuzzy searching
	const fuse = new Fuse(articlesData, {
		keys: searchKeys,
		includeScore: true,
		threshold: 0.4, // Lower threshold means more strict matching
		useExtendedSearch: true,
	});

	const searchResults = fuse.search(opts.query);

	spinner.stop();

	if (searchResults.length === 0) {
		console.log(
			chalk.yellow("No articles found matching your search criteria."),
		);
		return;
	}

	console.log(
		chalk.bold(`\nFound ${searchResults.length} matching articles:\n`),
	);

	// Display results
	for (const result of searchResults) {
		const article = result.item;
		const score = result.score;
		const relevance = Math.round((1 - (score || 0)) * 100);

		console.log(chalk.green(article.title) + chalk.gray(` (${article.file}) `));
		console.log(chalk.cyan(`Author: ${article.author}`));

		if (article.tags.length) {
			console.log(chalk.magenta(`Tags: ${article.tags.join(", ")}`));
		}

		console.log(chalk.gray(`Relevance: ${relevance}%`));

		// Show matching content excerpt if searching in content
		if (opts.inContent) {
			const contentLower = article.content.toLowerCase();
			const queryLower = opts.query.toLowerCase();
			const index = contentLower.indexOf(queryLower);

			if (index !== -1) {
				// Extract surrounding context
				const start = Math.max(0, index - 50);
				const end = Math.min(
					article.content.length,
					index + opts.query.length + 50,
				);
				let excerpt = article.content.substring(start, end);

				// Add ellipsis if truncated
				if (start > 0) excerpt = `...${excerpt}`;
				if (end < article.content.length) excerpt = `${excerpt}...`;

				// Highlight the matching part
				const highlightedExcerpt = excerpt.replace(
					new RegExp(opts.query, "gi"),
					(match) => chalk.bgYellow.black(match),
				);

				console.log(chalk.yellow("Content match:"), highlightedExcerpt);
			}
		}

		console.log("-".repeat(50));
	}
}
