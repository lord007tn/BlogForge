import path from "node:path";
import chalk from "chalk";
import fs from "fs-extra";
import {
	type Category,
	categorySchema,
	normalizeMultilingualText,
} from "../../schemas";
import { updateFrontmatter } from "../../utils/frontmatter";
import { logger } from "../../utils/logger";
import { type ProjectPaths, getProjectPaths } from "../../utils/project";

export async function createCategory(opts: {
	verbose?: boolean;
	slug?: string;
	title?: string | { ar?: string; en?: string };
	description?: string | { ar?: string; en?: string };
	image?: string;
	icon?: string;
}) {
	const spinner = logger.spinner("Initializing category creation");

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

	if (!opts.title) {
		logger.spinnerError("--title is required");
		return;
	}

	if (!opts.description) {
		logger.spinnerError("--description is required");
		return;
	}

	// Normalize multilingual fields
	const title = normalizeMultilingualText(opts.title);
	const description = normalizeMultilingualText(opts.description);

	// Check if category already exists
	const categoriesDir = paths.categories;
	const filePath = path.join(categoriesDir, `${opts.slug}.md`);

	if (await fs.pathExists(filePath)) {
		logger.spinnerError(`Category '${opts.slug}' already exists.`);
		return;
	}

	// Create category object
	spinner.text = "Creating category data";
	const categoryObj: Partial<Category> = {
		slug: opts.slug,
		title,
		description,
		image: opts.image,
		icon: opts.icon,
	};

	// Validate with schema
	const parseResult = categorySchema.safeParse(categoryObj);
	if (!parseResult.success) {
		logger.spinnerError("Validation failed. Category not created.");
		for (const err of parseResult.error.errors) {
			console.log(chalk.red(`- ${err.path.join(".")} ${err.message}`));
		}
		return;
	}

	// Create frontmatter content
	const frontmatter = updateFrontmatter("", categoryObj);

	// Write file
	spinner.text = `Writing category to ${opts.slug}.md`;

	try {
		await fs.ensureDir(categoriesDir);
		await fs.writeFile(filePath, frontmatter, "utf-8");
		logger.spinnerSuccess(
			`Category created: ${path.relative(process.cwd(), filePath)}`,
		);

		// Display category details
		console.log(
			logger.box(
				`🏷️ ${chalk.green("Category successfully created!")}
        
${chalk.bold("Slug:")} ${chalk.cyan(opts.slug)}
${chalk.bold("Title:")} ${chalk.cyan(
					typeof title === "string" ? title : JSON.stringify(title),
				)}
${chalk.bold("Description:")} ${chalk.cyan(
					typeof description === "string"
						? description
						: JSON.stringify(description),
				)}`,
				"Category Details",
				"green",
			),
		);
	} catch (error) {
		logger.spinnerError(
			`Failed to write category: ${(error as Error).message}`,
		);
	}
}
