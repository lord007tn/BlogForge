import path from "node:path";
import chalk from "chalk";
import fs from "fs-extra";
import { categorySchema, normalizeMultilingualText } from "../../schemas";
import {
	extractFrontmatter,
	getFrontMatterEntry,
	updateFrontmatter,
} from "../../utils/frontmatter";
import { logger } from "../../utils/logger";
import { type ProjectPaths, getProjectPaths } from "../../utils/project";

export async function editCategory(opts: {
	verbose?: boolean;
	slug?: string;
	title?: string | { ar?: string; en?: string };
	description?: string | { ar?: string; en?: string };
	image?: string;
	icon?: string;
}) {
	const spinner = logger.spinner("Initializing category edit");

	// Get project paths
	let paths: ProjectPaths;
	try {
		paths = await getProjectPaths(process.cwd());
		spinner.text = "Validating project structure";
	} catch (e) {
		logger.spinnerError(`Project validation failed: ${(e as Error).message}`);
		return;
	}

	// Validate required fields
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

	// Read existing category data
	spinner.text = "Reading category data";

	try {
		const content = await fs.readFile(filePath, "utf-8");
		const { frontmatter } = extractFrontmatter(content);

		// Update fields if provided
		if (opts.title) {
			frontmatter.title = normalizeMultilingualText(opts.title);
		}

		if (opts.description) {
			frontmatter.description = normalizeMultilingualText(opts.description);
		}

		if (opts.image !== undefined) {
			frontmatter.image = opts.image;
		}

		if (opts.icon !== undefined) {
			frontmatter.icon = opts.icon;
		}

		// Validate with schema
		const parseResult = categorySchema.safeParse(frontmatter);
		if (!parseResult.success) {
			logger.spinnerError("Validation failed. Category not updated.");
			for (const err of parseResult.error.errors) {
				console.log(chalk.red(`- ${err.path.join(".")} ${err.message}`));
			}
			return;
		}

		// Update frontmatter
		const newContent = updateFrontmatter(content, frontmatter);

		// Write file
		spinner.text = `Updating category ${opts.slug}.md`;
		await fs.writeFile(filePath, newContent, "utf-8");

		logger.spinnerSuccess(
			`Category updated: ${path.relative(process.cwd(), filePath)}`,
		);

		// Display updated category details
		const displayTitle = getFrontMatterEntry(frontmatter, "title");

		console.log(
			logger.box(
				`🏷️ ${chalk.green("Category successfully updated!")}
        
${chalk.bold("Slug:")} ${chalk.cyan(opts.slug)}
${chalk.bold("Title:")} ${chalk.cyan(displayTitle)}`,
				"Category Updated",
				"green",
			),
		);
	} catch (error) {
		logger.spinnerError(
			`Failed to update category: ${(error as Error).message}`,
		);
	}
}
