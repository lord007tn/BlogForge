import chalk from "chalk";
import Table from "cli-table3";
import { type Author, getTextForLocale } from "../../schemas";
import { logger } from "../../utils/logger";
import { getAllArticles, getAllAuthors } from "../../utils/project";

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
				chalk.cyan("ID/Slug"),
				chalk.cyan("Article Count"),
				chalk.cyan("Total Words (Approx.)"),
			],
			colWidths: [25, 25, 15, 25],
		});

		for (const author of authors) {
			const authorArticles = articles.filter(
				(article) => String(article.author) === author.id,
			);
			let totalWordsByAuthor = 0;
			for (const article of authorArticles) {
				totalWordsByAuthor += (
					getTextForLocale(article.description, "en") || ""
				)
					.split(/\s+/)
					.filter(Boolean).length;
			}

			const authorName = getTextForLocale(author.name, "en") || author.id;

			table.push([
				authorName,
				author.id,
				authorArticles.length.toString(),
				totalWordsByAuthor.toLocaleString(),
			]);
		}

		console.log(table.toString());

		if (options.verbose) {
			logger.info(
				"Verbose output for author stats could include details like articles per author, etc.",
			);
			// Example: List articles for each author
			for (const author of authors) {
				const authorName = getTextForLocale(author.name, "en") || author.id;
				logger.info(`\nArticles by ${authorName}:`);
				const authorArticles = articles.filter(
					(article) => String(article.author) === author.id,
				);
				if (authorArticles.length > 0) {
					for (const article of authorArticles) {
						logger.log(
							`  - ${getTextForLocale(article.title, "en") || article.slug}`,
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
