import chalk from "chalk";
import Table from "cli-table3";
import type { Category } from "../../schemas"; // Import Category type
import { getTextForLocale } from "../../schemas"; // Corrected import path
import { logger } from "../../utils/logger";
import { getAllArticles, getAllCategories } from "../../utils/project";
import { defaultConfig } from "../../utils/config"; // Corrected import path

interface CategoryStatsOptions {
	verbose?: boolean;
}

export async function statsCategory(options: CategoryStatsOptions) {
	logger.info("Gathering category statistics...");

	try {
		const categories: Category[] = await getAllCategories(); // Add type annotation
		const articles = await getAllArticles();

		if (!categories.length) {
			logger.warning("No categories found."); // Changed from logger.warn
			return;
		}

		const table = new Table({
			head: [
				chalk.cyan("Category Title"),
				chalk.cyan("Slug"),
				chalk.cyan("Article Count"),
			],
			colWidths: [30, 30, 15],
		});

		for (const category of categories) {
			const articlesInCategory = articles.filter((article) => {
				// Ensure article.category and article.categories are treated correctly
				const articleCategories = Array.isArray(article.categories)
					? article.categories
					: typeof article.category === "string"
						? [article.category]
						: [];
				return articleCategories.includes(category.slug);
			});
			table.push([
				// Handle potentially undefined title properties
				getTextForLocale(category.title, defaultConfig.defaultLanguage) ||
					category.slug, // Corrected: Removed extra defaultConfig
				category.slug,
				articlesInCategory.length.toString(),
			]);
		}

		console.log(table.toString());

		if (options.verbose) {
			logger.info("Verbose output enabled for category stats.");
			// Add more detailed stats here if needed in the future
			// For example, list article titles per category
		}

		logger.success("Category statistics generated successfully.");
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		logger.error(`Error generating category statistics: ${errorMessage}`);
	}
}
