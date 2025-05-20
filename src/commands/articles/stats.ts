import chalk from "chalk";
import Table from "cli-table3";
import { getTextForLocale } from "../../schemas";
import type { Article } from "../../schemas"; // Import Article type
import { logger } from "../../utils/logger";
import {
	getAllArticles,
	getAllAuthors,
	getAllCategories,
} from "../../utils/project"; // Assuming getAllAuthors and getAllCategories are available
import { defaultConfig } from "../../utils/config"; // Corrected import path

export async function statsArticles(opts: { verbose?: boolean }) {
	logger.info("Gathering article statistics...");

	try {
		const articles: Article[] = await getAllArticles();
		const authors = await getAllAuthors(); // Added to fetch authors for name resolution
		const categories = await getAllCategories(); // Added to fetch categories

		if (!articles.length) {
			logger.spinnerWarn("No articles found to analyze.");
			return;
		}

		let totalWords = 0;
		let publishedCount = 0;
		let draftCount = 0;
		const articlesByAuthor: Record<string, number> = {};
		const wordsByAuthor: Record<string, number> = {};
		const articlesByCategory: Record<string, number> = {};
		const articlesByTag: Record<string, number> = {};

		for (const article of articles) {
			const wordCount = (article.description || "") // article.description is now always a string
				.split(/\s+/)
				.filter(Boolean).length;
			totalWords += wordCount;

			if (article.isDraft) {
				draftCount++;
			} else {
				publishedCount++;
			}

			// Author stats
			if (article.author) {
				const authorId = String(article.author);
				articlesByAuthor[authorId] = (articlesByAuthor[authorId] || 0) + 1;
				wordsByAuthor[authorId] = (wordsByAuthor[authorId] || 0) + wordCount;
			}

			// Category stats
			const categorySlug =
				typeof article.category === "string"
					? article.category
					: "uncategorized";
			articlesByCategory[categorySlug] =
				(articlesByCategory[categorySlug] || 0) + 1;

			// Tags stats (assuming tags is an array of strings)
			if (Array.isArray(article.tags)) {
				for (const tag of article.tags) {
					// Added type annotation for tag
					const t = String(tag);
					articlesByTag[t] = (articlesByTag[t] || 0) + 1;
				}
			}
		}

		logger.log(chalk.bold.cyan("\n📊 Article Statistics Summary\n"));

		const summaryTable = new Table();
		summaryTable.push(
			{ "Total Articles": chalk.bold.blue(articles.length.toString()) },
			{ "Published Articles": chalk.green(publishedCount.toString()) },
			{ "Draft Articles": chalk.yellow(draftCount.toString()) },
			{ "Total Words (approx.)": chalk.magenta(totalWords.toLocaleString()) },
			{
				"Average Words/Article (approx.)": chalk.cyan(
					articles.length > 0
						? Math.round(totalWords / articles.length).toLocaleString()
						: "0",
				),
			},
		);
		console.log(summaryTable.toString());

		// Articles per Author
		if (Object.keys(articlesByAuthor).length > 0) {
			logger.log(chalk.bold.cyan("\n👥 Articles & Words by Author (Top 5)\n"));
			const authorTable = new Table({
				head: [
					chalk.cyan("Author Name/ID"),
					chalk.cyan("Articles"),
					chalk.cyan("Words (approx.)"),
				],
			});
			const sortedAuthors = Object.entries(articlesByAuthor)
				.sort(([, countA], [, countB]) => countB - countA)
				.slice(0, 5);
			for (const [authorId, count] of sortedAuthors) {
				const author = authors.find((a) => a.slug === authorId); // Find author by slug
				const authorName = author
					? getTextForLocale(author.name, defaultConfig.defaultLanguage) ||
						authorId // Use defaultConfig
					: authorId;
				authorTable.push([
					authorName,
					count.toString(),
					(wordsByAuthor[authorId] || 0).toLocaleString(),
				]);
			}
			console.log(authorTable.toString());
		}

		// Articles per Category
		if (Object.keys(articlesByCategory).length > 0) {
			logger.log(chalk.bold.cyan("\n📚 Articles by Category (Top 5)\n"));
			const categoryTable = new Table({
				head: [chalk.cyan("Category Name/Slug"), chalk.cyan("Articles")],
			});
			const sortedCategories = Object.entries(articlesByCategory)
				.sort(([, countA], [, countB]) => countB - countA)
				.slice(0, 5);

			for (const [categorySlug, count] of sortedCategories) {
				const category = categories.find((c) => c.slug === categorySlug); // Find category by slug
				const categoryName = category
					? getTextForLocale(category.title, defaultConfig.defaultLanguage) ||
						categorySlug // Use defaultConfig
					: categorySlug;
				categoryTable.push([categoryName, count.toString()]);
			}
			console.log(categoryTable.toString());
		}

		// Articles per Tag
		if (opts.verbose && Object.keys(articlesByTag).length > 0) {
			logger.log(chalk.bold.cyan("\n🏷️ Articles by Tag (Top 10 - Verbose)\n"));
			const tagTable = new Table({
				head: [chalk.cyan("Tag"), chalk.cyan("Articles")],
			});
			const sortedTags = Object.entries(articlesByTag)
				.sort(([, countA], [, countB]) => countB - countA)
				.slice(0, 10);
			for (const [tag, count] of sortedTags) {
				tagTable.push([tag, count.toString()]);
			}
			console.log(tagTable.toString());
		}

		logger.success("\nArticle statistics generated successfully.");
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		logger.error(`Error generating article statistics: ${errorMessage}`);
	}
}
