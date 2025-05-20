import path from "node:path";
import chalk from "chalk";
import fs from "fs-extra";
import Fuse from "fuse.js";
import prompts, { type Choice } from "prompts";
import {
	extractFrontmatter,
	// getFrontMatterEntry, // No longer directly needed for constructing the main object
} from "../../utils/frontmatter";
import { logger } from "../../utils/logger";
import { getProjectPaths } from "../../utils/project";
import {
	type Article as ArticleSchemaType,
	articleSchema,
} from "../../schemas"; // Import Article type and schema

export async function searchArticles(opts: {
	inTags?: boolean;
	inContent?: boolean;
	author?: string;
	verbose?: boolean;
}) {
	// Get project paths first, before any spinner
	let articlesDir: string;
	try {
		const paths = await getProjectPaths(process.cwd());
		articlesDir = paths.articles;
	} catch (e) {
		logger.error(`Project validation failed: ${(e as Error).message}`);
		return;
	}

	// Check if articles directory exists
	if (!(await fs.pathExists(articlesDir))) {
		logger.error("No articles directory found.");
		return;
	}

	const spinner = logger.spinner("Reading article files");
	const files = (await fs.readdir(articlesDir)).filter((f) =>
		f.endsWith(".md"),
	);

	if (!files.length) {
		spinner.stop();
		logger.info("No articles found to search.");
		return;
	}

	// Collect articles data for search
	// Use the imported ArticleSchemaType and extend it with file and content for search purposes
	type ArticleSearchItem = ArticleSchemaType & {
		file: string;
		content: string;
	};
	const articlesData: ArticleSearchItem[] = [];
	spinner.text = "Processing articles for search";

	for (const file of files) {
		if (opts.verbose) {
			spinner.text = `Indexing article: ${file}`;
		}
		const filePath = path.join(articlesDir, file);
		const fileContent = await fs.readFile(filePath, "utf-8");
		const { frontmatter, content } = extractFrontmatter(fileContent);

		// Skip if author filter is provided and doesn't match
		if (opts.author && String(frontmatter.author) !== opts.author) {
			continue;
		}

		let parsedFrontmatter: ArticleSchemaType;
		try {
			// Validate and type the frontmatter using the imported schema
			parsedFrontmatter = articleSchema.parse(frontmatter);
		} catch (e: any) {
			// Changed logger.info to console.log to resolve linting error
			const fieldPath = e.errors?.[0]?.path?.join(".") || "";
			const validationMessage = e.errors?.[0]?.message || e.message;
			const errorMessage = `Skipping file "${file}" due to schema validation error: Field '${fieldPath}' - ${validationMessage}`;
			console.log(chalk.yellow(errorMessage)); // Using chalk for visibility
			continue; // Skip this file if frontmatter is invalid
		}

		const articleEntry: ArticleSearchItem = {
			...parsedFrontmatter,
			// Ensure fields expected by Fuse are present and correctly typed
			title: parsedFrontmatter.title ?? "",
			description: parsedFrontmatter.description ?? "",
			author: String(parsedFrontmatter.author ?? ""),
			tags: parsedFrontmatter.tags ?? [],
			category: String(parsedFrontmatter.category ?? ""),
			// Assuming keywords is string[] in schema based on typical usage. Adjust if it's just a string.
			keywords: parsedFrontmatter.keywords ?? [],
			file, // Add the filename
			content, // Add the markdown content
		};
		articlesData.push(articleEntry);
	}
	spinner.succeed("Articles indexed for search.");

	// Set up search options based on user preferences
	// Explicitly type searchKeys as string[] for Fuse.js compatibility
	const searchKeys: string[] = [];

	if (opts.inTags) {
		searchKeys.push("tags");
	} else if (opts.inContent) {
		searchKeys.push("content");
	} else {
		// Default search in metadata
		searchKeys.push("title", "description", "category", "author", "keywords");
	}

	const fuse = new Fuse(articlesData, {
		keys: searchKeys,
		includeScore: true,
		threshold: 0.4,
	});

	// Interactive search prompt
	const response = await prompts({
		type: "text",
		name: "searchTerm",
		message: "Enter search term (type for suggestions):",
		async suggest(input: string, _choices: Choice[]) {
			if (!input) {
				return articlesData
					.slice(0, 5)
					.map((article) => ({
						title: article.title,
						value: article.title,
						description: article.file,
					}));
			}
			const results = fuse.search(input);
			return results.slice(0, 10).map((result) => ({
				// Use string concatenation for suggestion title to avoid template literal issues
				title: `${result.item.title} (Score: ${result.score?.toFixed(2) || "N/A"})`,
				value: result.item.title,
				description: `File: ${result.item.file}`,
			}));
		},
	});

	if (!response || !response.searchTerm) {
		// Changed logger.info to console.log
		console.log("No search term provided.");
		return;
	}

	const searchTerm = response.searchTerm;
	const searchSpinner = logger.spinner(`Searching for "${searchTerm}"`);
	const searchResults = fuse.search(searchTerm);
	searchSpinner.stop();

	if (searchResults.length === 0) {
		console.log(
			chalk.yellow("No articles found matching your search criteria."),
		);
		return;
	}

	// Use string concatenation for chalk.bold to avoid template literal issues
	console.log(
		chalk.bold(`\\nFound ${searchResults.length} matching articles:\\n`),
	);

	for (const result of searchResults) {
		const article = result.item;
		const score = result.score;
		const relevance = Math.round((1 - (score || 0)) * 100);

		console.log(chalk.green(article.title) + chalk.gray(` (${article.file}) `));
		console.log(chalk.cyan(`Author: ${article.author}`));

		if (article.tags?.length) {
			console.log(chalk.magenta(`Tags: ${article.tags.join(", ")}`));
		}

		console.log(chalk.gray(`Relevance: ${relevance}%`));

		if (opts.inContent && searchTerm) {
			const contentLower = article.content.toLowerCase();
			const queryLower = searchTerm.toLowerCase();
			const index = contentLower.indexOf(queryLower);

			if (index !== -1) {
				const start = Math.max(0, index - 50);
				const end = Math.min(
					article.content.length,
					index + searchTerm.length + 50,
				);
				let excerpt = article.content.substring(start, end);
				if (start > 0) excerpt = `...${excerpt}`;
				if (end < article.content.length) excerpt = `${excerpt}...`;
				const highlightedExcerpt = excerpt.replace(
					new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"),
					(match: string) => chalk.bgYellow.black(match), // Ensured type for match parameter
				);
				console.log(chalk.yellow("Content match:"), highlightedExcerpt);
			}
		}
		console.log("-".repeat(50));
	}
}
