import chalk from "chalk";
import Table from "cli-table3";
import { type Author, getTextForLocale } from "../../schemas";
import { logger } from "../../utils/logger";
import { getAllArticles, getAllAuthors } from "../../utils/project";
import { defaultConfig } from "../../utils/config";

interface AuthorStatsOptions {
	verbose?: boolean;
}

export async function statsAuthors(options: AuthorStatsOptions) {
	logger.info("Gathering author statistics...");

	try {
		const authors: Author[] = await getAllAuthors();
		const articles = await getAllArticles();

		if (!authors.length) {
			logger.warning("No authors found.");
			return;
		}

		const table = new Table({
			head: [
				chalk.cyan("Author Name"),
				chalk.cyan("Slug"),
				chalk.cyan("Article Count"),
			],
			colWidths: [25, 25, 15],
		});

		for (const author of authors) {
			const authorArticles = articles.filter(
				(article) => String(article.author) === author.slug,
			);

			const authorName =
				getTextForLocale(author.name, defaultConfig.defaultLanguage) || // Corrected: Removed extra defaultConfig
				author.slug;

			table.push([authorName, author.slug, authorArticles.length.toString()]);
		}

		console.log(table.toString());

		if (options.verbose) {
			logger.info(
				"Verbose output for author stats could include details like articles per author, etc.",
			);
			for (const author of authors) {
				const authorName =
					getTextForLocale(author.name, defaultConfig.defaultLanguage) || // Corrected: Removed extra defaultConfig
					author.slug;
				logger.info(`\nArticles by ${authorName}:`);
				const authorArticles = articles.filter(
					(article) => String(article.author) === author.slug,
				);
				if (authorArticles.length > 0) {
					for (const article of authorArticles) {
						logger.log(
							`  - ${
								article.title || article.slug // article.title is now always a string
							}`,
						);
					}
				} else {
					logger.log("  No articles found for this author.");
				}
			}
		}

		logger.success("Author statistics generated successfully.");
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		logger.error(`Error generating author statistics: ${errorMessage}`);
	}
}
