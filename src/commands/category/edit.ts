import path from "node:path";
import chalk from "chalk";
import fs from "fs-extra";
import prompts, { type Answers } from "prompts"; // Added import for Answers
import {
	type Category,
	categorySchema,
	normalizeMultilingualText,
} from "../../schemas"; // Added Category import
import { defaultConfig } from "../../utils/config"; // Added import
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
	interactive?: boolean; // Added interactive flag
}) {
	const spinner = logger.spinner("Initializing category edit");

	// Sanitize opts.slug if it's the string "undefined"
	if (opts.slug === "undefined") {
		opts.slug = undefined;
	}

	// Normalize opts.slug to be clean (remove .md if present)
	if (opts.slug && typeof opts.slug === "string" && opts.slug.endsWith(".md")) {
		opts.slug = opts.slug.slice(0, -3);
	}

	// Get project paths
	let paths: ProjectPaths;
	try {
		paths = await getProjectPaths(process.cwd());
		spinner.text = "Validating project structure";
	} catch (e) {
		logger.spinnerError(`Project validation failed: ${(e as Error).message}`);
		return;
	}

	const categoriesDir = paths.categories; // Moved categoriesDir up for early access

	// If no slug specified and interactive mode, prompt user to select one
	let targetSlug = opts.slug;
	if (!targetSlug && opts.interactive !== false) {
		spinner.text = "Reading category files";
		let categoryFiles: string[];
		if (categoriesDir) {
			try {
				const allFiles = await fs.readdir(categoriesDir);
				categoryFiles = allFiles.filter((f) => f.endsWith(".md"));
			} catch (e) {
				logger.spinnerError(
					`Failed to read categories directory: ${(e as Error).message}`,
				);
				return;
			}
		} else {
			categoryFiles = [];
		}
		if (!categoryFiles.length) {
			logger.spinnerError("No categories found to edit.");
			return;
		}
		spinner.stop(); // Stop spinner before prompts
		const categoryChoices = categoryFiles.map((f) => ({
			title: f, // Show full filename in prompt
			value: f.replace(/\.md$/, ""), // Return clean slug as value
		}));
		const idResponse = await prompts({
			type: "select",
			name: "selectedSlug",
			message: "Select a category to edit:",
			choices: categoryChoices,
		});
		if (!idResponse.selectedSlug) {
			logger.error("No category selected. Aborting."); // Changed to error
			return;
		}
		targetSlug = idResponse.selectedSlug as string; // Added type assertion
		opts.slug = targetSlug; // Update opts.slug as it's used later
		spinner.start("Loading selected category");
	} else if (!targetSlug) {
		logger.spinnerError(
			"No slug specified. Use --slug=<slug> or run in interactive mode.",
		);
		return;
	}

	// Ensure targetSlug is definitively clean before use
	if (typeof targetSlug === "string" && targetSlug.endsWith(".md")) {
		targetSlug = targetSlug.slice(0, -3);
	}

	if (!categoriesDir) {
		logger.spinnerError("No category directory found.");
		return;
	}

	const filePath = path.join(categoriesDir, `${targetSlug}.md`);

	if (!(await fs.pathExists(filePath))) {
		logger.spinnerError(`Category '${targetSlug}' does not exist.`);
		return;
	}

	// Read existing category data
	spinner.text = "Reading category data";
	const updatedFields: Partial<Category> = {}; // Declare updatedFields with Category type

	try {
		const fileContent = await fs.readFile(filePath, "utf-8");
		const { frontmatter: existingFrontmatter } =
			extractFrontmatter(fileContent);

		// Interactive mode: Show form only if no specific field values are provided via CLI
		if (
			opts.interactive !== false &&
			!opts.title &&
			!opts.description &&
			!opts.image &&
			!opts.icon
		) {
			spinner.stop();
			const currentTitle = getFrontMatterEntry(existingFrontmatter, "title");
			const currentDescription = getFrontMatterEntry(
				existingFrontmatter,
				"description",
			);
			const currentImage = (existingFrontmatter.image as string) || "";
			const currentIcon = (existingFrontmatter.icon as string) || "";

			console.log(
				chalk.cyan(`\nEditing category: ${chalk.bold(targetSlug)}\n`),
			);

			type PromptResponse = {
				title: string;
				description?: string;
				image?: string;
				icon?: string;
			};

			const response: Answers<keyof PromptResponse> = await prompts<
				keyof PromptResponse
			>([
				{
					type: "text",
					name: "title",
					message: `Title${chalk.red("(*)")}:`,
					initial: currentTitle,
					validate: (value) => (value ? true : "Title is required"),
				},
				{
					type: "text",
					name: "description",
					message: "Description:",
					initial: currentDescription,
				},
				{
					type: "text",
					name: "image",
					message: "Image URL:",
					initial: currentImage,
				},
				{
					type: "text",
					name: "icon",
					message: "Icon (e.g., emoji or icon name):",
					initial: currentIcon,
				},
			]);

			if (response.title)
				updatedFields.title = normalizeMultilingualText(
					response.title as string,
					defaultConfig.defaultLanguage,
				);
			if (response.description)
				updatedFields.description = normalizeMultilingualText(
					response.description as string,
					defaultConfig.defaultLanguage,
				);
			else updatedFields.description = undefined;
			if (response.image !== undefined)
				updatedFields.image = (response.image as string) || undefined;
			if (response.icon !== undefined)
				updatedFields.icon = (response.icon as string) || undefined;

			spinner.start("Updating category");
		} else {
			// Non-interactive: Apply command line options directly
			if (opts.title)
				updatedFields.title = normalizeMultilingualText(
					opts.title,
					defaultConfig.defaultLanguage,
				);
			if (opts.description)
				updatedFields.description = normalizeMultilingualText(
					opts.description,
					defaultConfig.defaultLanguage,
				);
			if (opts.image !== undefined)
				updatedFields.image = opts.image || undefined;
			if (opts.icon !== undefined) updatedFields.icon = opts.icon || undefined;
		}

		// Merge with existing frontmatter, updatedFields takes precedence
		const newFrontmatter = { ...existingFrontmatter, ...updatedFields };

		// Validate with schema
		const parseResult = categorySchema.safeParse(newFrontmatter);
		if (!parseResult.success) {
			logger.spinnerError("Validation failed. Category not updated.");
			for (const err of parseResult.error.errors) {
				console.log(chalk.red(`- ${err.path.join(".")} ${err.message}`));
			}
			return;
		}

		// Update frontmatter
		const newContent = updateFrontmatter(fileContent, newFrontmatter);

		// Write file
		spinner.text = `Updating category ${targetSlug}.md`; // Use targetSlug
		await fs.writeFile(filePath, newContent, "utf-8");

		logger.spinnerSuccess(
			`Category updated: ${path.relative(process.cwd(), filePath)}`,
		);

		// Display updated category details
		const displayTitle = getFrontMatterEntry(newFrontmatter, "title"); // Corrected to use newFrontmatter

		console.log(
			logger.box(
				`🏷️ ${chalk.green("Category successfully updated!")}\n        \n${chalk.bold("Slug:")} ${chalk.cyan(targetSlug)}\n${chalk.bold("Title:")} ${chalk.cyan(displayTitle)}`,
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
