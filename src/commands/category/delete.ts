import path from "node:path";
import chalk from "chalk";
import fs from "fs-extra";
import prompts from "prompts";
import { logger } from "../../utils/logger";
import type { ProjectPaths } from "../../utils/project";
import { getProjectPaths } from "../../utils/project";

export interface DeleteCategoryOptions {
	verbose?: boolean;
	slug?: string;
	force?: boolean;
}

export async function deleteCategory(
	opts: DeleteCategoryOptions,
): Promise<void> {
	const spinner = logger.spinner("Initializing category deletion");

	// Get project paths
	let paths: ProjectPaths;
	try {
		paths = await getProjectPaths(process.cwd());
		spinner.text = "Validating project structure";
	} catch (e) {
		logger.spinnerError(`Project validation failed: ${(e as Error).message}`);
		return;
	}

	// Validate slug parameter
	if (!opts.slug) {
		logger.spinnerError("--slug is required");
		return;
	}

	// Check if category exists
	const categoriesDir = paths.categories;
	const filePath = path.join(categoriesDir, `${opts.slug}.md`);

	if (!(await fs.pathExists(filePath))) {
		logger.spinnerError(`Category '${opts.slug}' does not exist.`);
		return;
	}

	// Check if category is referenced in any articles
	spinner.text = "Checking for article references";
	const articlesDir = paths.articles;

	if (await fs.pathExists(articlesDir)) {
		const articleFiles = await fs.readdir(articlesDir);
		const referencingArticles = [];

		for (const file of articleFiles) {
			if (!file.endsWith(".md")) continue;

			const articlePath = path.join(articlesDir, file);
			const content = await fs.readFile(articlePath, "utf-8");

			if (
				content.includes(`category: ${opts.slug}`) ||
				content.includes(`category: "${opts.slug}"`) ||
				content.includes(`category: '${opts.slug}'`)
			) {
				referencingArticles.push(file);
			}
		}

		if (referencingArticles.length > 0) {
			spinner.stop();
			console.log(
				chalk.yellow(
					`⚠️ Category '${opts.slug}' is referenced in ${referencingArticles.length} article(s):`,
				),
			);
			for (const file of referencingArticles) {
				console.log(`  - ${file}`);
			}

			// Confirm deletion even if --force was provided
			const confirmation = await prompts({
				type: "confirm",
				name: "value",
				message:
					"Are you sure you want to delete this category? This will invalidate the referencing articles.",
				initial: false,
			});

			if (!confirmation.value) {
				logger.warning("Delete cancelled.");
				return;
			}
		} else if (!opts.force) {
			// If not referenced but --force not provided, still ask for confirmation
			spinner.stop();

			const confirmation = await prompts({
				type: "confirm",
				name: "value",
				message: `Are you sure you want to delete category '${opts.slug}'?`,
				initial: false,
			});

			if (!confirmation.value) {
				logger.warning("Delete cancelled.");
				return;
			}
		}
	}

	// Delete the category file
	spinner.text = `Deleting category ${opts.slug}.md`;

	try {
		await fs.unlink(filePath);
		logger.spinnerSuccess(`Category '${opts.slug}' deleted.`);
	} catch (error) {
		logger.spinnerError(
			`Failed to delete category: ${(error as Error).message}`,
		);
	}
}
