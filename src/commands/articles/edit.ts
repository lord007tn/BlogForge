import path from "node:path";
import chalk from "chalk";
import fs from "fs-extra";
import prompts from "prompts";
import {
	type Article,
	articleSchema,
	normalizeMultilingualText,
} from "../../schemas";
import {
	extractFrontmatter,
	getFrontMatterEntry,
	updateFrontmatter,
} from "../../utils/frontmatter";
import { logger } from "../../utils/logger";
import { type ProjectPaths, getProjectPaths } from "../../utils/project";

/**
 * Interactive editor for articles that handles i18n properly
 */
export async function editArticle(opts: {
	file?: string;
	verbose?: boolean;
	interactive?: boolean;
	[key: string]: unknown;
}) {
	const spinner = logger.spinner("Initializing article editor");

	// Get project paths
	let paths: ProjectPaths;
	try {
		paths = await getProjectPaths(process.cwd());
		spinner.text = "Validating project structure";
	} catch (e) {
		logger.spinnerError(`Project validation failed: ${(e as Error).message}`);
		return;
	}

	// Verify articles directory exists
	const articlesDir = paths.articles;
	if (!(await fs.pathExists(articlesDir))) {
		logger.spinnerError("No articles directory found.");
		return;
	}

	// Get list of article files
	spinner.text = "Reading article files";
	const files = (await fs.readdir(articlesDir)).filter((f) =>
		f.endsWith(".md"),
	);

	if (!files.length) {
		logger.spinnerError("No articles found to edit.");
		return;
	}

	// If no file specified, prompt user to select one
	let targetFile = opts.file;

	if (!targetFile && opts.interactive !== false) {
		spinner.stop();

		// Create file selection options
		const fileOptions = [];

		for (const file of files) {
			const filePath = path.join(articlesDir, file);
			const content = await fs.readFile(filePath, "utf-8");
			const { frontmatter } = extractFrontmatter(content);
			const title = getFrontMatterEntry(frontmatter, "title");

			fileOptions.push({
				title: `${title || file}`,
				description: `${getFrontMatterEntry(
					frontmatter,
					"description",
				).substring(0, 50)}...`,
				value: file,
			});
		}

		const response = await prompts({
			type: "select",
			name: "file",
			message: "Select an article to edit:",
			choices: fileOptions,
		});

		targetFile = response.file;

		if (!targetFile) {
			logger.error("No article selected.");
			return;
		}

		spinner.start("Loading selected article");
	} else if (!targetFile) {
		logger.spinnerError(
			"No file specified. Use --file=<filename> or run in interactive mode.",
		);
		return;
	}

	// Verify file exists
	const filePath = path.join(articlesDir, targetFile);
	if (!(await fs.pathExists(filePath))) {
		logger.spinnerError(`File not found: ${targetFile}`);
		return;
	}

	// Read file content
	spinner.text = "Reading article content";
	const content = await fs.readFile(filePath, "utf-8");
	const { frontmatter, content: bodyContent } = extractFrontmatter(content);

	// Get authors list for validation
	spinner.text = "Loading available authors";
	const authorsDir = paths.authors;
	let authorChoices: string[] = [];

	try {
		if (await fs.pathExists(authorsDir)) {
			const authorFiles = await fs.readdir(authorsDir);
			authorChoices = authorFiles
				.filter((f) => f.endsWith(".md"))
				.map((f) => f.replace(/\.md$/, ""));
		}
	} catch (error) {
		logger.spinnerWarn(
			`Could not read authors directory: ${(error as Error).message}`,
		);
	}

	// Get categories for validation
	spinner.text = "Loading available categories";
	const categoriesDir = paths.categories;
	let categoryChoices: string[] = [];

	try {
		if (await fs.pathExists(categoriesDir)) {
			const categoryFiles = await fs.readdir(categoriesDir);
			categoryChoices = categoryFiles
				.filter((f) => f.endsWith(".md"))
				.map((f) => f.replace(/\.md$/, ""));
		}
	} catch (error) {
		logger.spinnerWarn(
			`Could not read categories directory: ${(error as Error).message}`,
		);
	}

	spinner.stop();

	// If interactive mode, show form to edit fields
	if (
		opts.interactive !== false &&
		!Object.keys(opts).some((k) =>
			[
				"title",
				"description",
				"author",
				"tags",
				"category",
				"isDraft",
			].includes(k),
		)
	) {
		// Get existing values
		const currentTitle = getFrontMatterEntry(frontmatter, "title");
		const currentDescription = getFrontMatterEntry(frontmatter, "description");
		const currentAuthor = (frontmatter.author as string) || "";
		const currentTags = Array.isArray(frontmatter.tags)
			? frontmatter.tags.join(", ")
			: typeof frontmatter.tags === "string"
				? frontmatter.tags
				: "";
		const currentCategory = (frontmatter.category as string) || "";
		const currentIsDraft = Boolean(frontmatter.idDraft);

		// Show form to edit article
		console.log(
			chalk.cyan(
				`\nEditing article: ${chalk.bold(currentTitle || targetFile)}\n`,
			),
		);

		const response = await prompts([
			{
				type: "text",
				name: "title",
				message: "Title:",
				initial: currentTitle,
			},
			{
				type: "text",
				name: "description",
				message: "Description:",
				initial: currentDescription,
			},
			{
				type: "select",
				name: "author",
				message: "Author:",
				choices: authorChoices.map((a) => ({ title: a, value: a })),
				initial: authorChoices.indexOf(currentAuthor),
			},
			{
				type: "text",
				name: "tags",
				message: "Tags (comma-separated):",
				initial: currentTags,
			},
			{
				type: "select",
				name: "category",
				message: "Category:",
				choices: [
					{ title: "(none)", value: "" },
					...categoryChoices.map((c) => ({ title: c, value: c })),
				],
				initial: categoryChoices.indexOf(currentCategory) + 1, // +1 for the "none" option
			},
			{
				type: "confirm",
				name: "isDraft",
				message: "Is this a draft?",
				initial: currentIsDraft,
			},
			{
				type: "confirm",
				name: "editContent",
				message: "Would you like to edit the content?",
				initial: false,
			},
		]);

		// Handle cancellation
		if (!response.title) {
			logger.error("Edit cancelled.");
			return;
		}

		// Update opts with user input
		opts.title = response.title;
		opts.description = response.description;
		opts.author = response.author;
		opts.tags = response.tags;
		opts.category = response.category;
		opts.isDraft = response.isDraft;

		// If user wants to edit content, open in their editor
		if (response.editContent) {
			const spawn = require("node:child_process").spawn;
			const editor = process.env.EDITOR || "nano";

			console.log(chalk.yellow(`\nOpening ${targetFile} in ${editor}...\n`));

			// Create temp file with body content
			const tempContentPath = path.join(process.cwd(), ".tmp-content");
			await fs.writeFile(tempContentPath, bodyContent, "utf-8");

			// Open editor
			const editorProcess = spawn(editor, [tempContentPath], {
				stdio: "inherit",
				shell: true,
			});

			// Wait for editor to close
			await new Promise<void>((resolve) => {
				editorProcess.on("exit", () => {
					resolve();
				});
			});

			// Read updated content
			try {
				const newBodyContent = await fs.readFile(tempContentPath, "utf-8");
				opts.bodyContent = newBodyContent;
				await fs.unlink(tempContentPath);
			} catch (error) {
				logger.warning(
					`Could not read edited content: ${(error as Error).message}`,
				);
			}
		}
	}

	// Process updated fields
	// Handle multilingual fields properly
	const updatedFields: Partial<Article> = {};

	// Copy existing frontmatter
	Object.assign(updatedFields, frontmatter);

	// Update with provided options
	if (opts.title) {
		updatedFields.title = normalizeMultilingualText(
			opts.title as string | Record<string, string>,
			(frontmatter.locale as string) || "en",
		);
	}

	if (opts.description) {
		updatedFields.description = normalizeMultilingualText(
			opts.description as string | Record<string, string>,
			(frontmatter.locale as string) || "en",
		);
	}

	if (opts.author) {
		// Validate author exists
		if (
			authorChoices.length > 0 &&
			!authorChoices.includes(opts.author as string)
		) {
			logger.error(
				`Author not found: ${opts.author}. Available: ${authorChoices.join(
					", ",
				)}`,
			);
			return;
		}
		updatedFields.author = opts.author as string;
	}

	if (opts.tags) {
		updatedFields.tags =
			typeof opts.tags === "string"
				? opts.tags
						.split(",")
						.map((t: string) => t.trim())
						.filter(Boolean)
				: opts.tags;
	}

	if (opts.category !== undefined) {
		// Validate category exists
		if (
			opts.category &&
			categoryChoices.length > 0 &&
			!categoryChoices.includes(opts.category as string)
		) {
			logger.error(
				`Category not found: ${
					opts.category
				}. Available: ${categoryChoices.join(", ")}`,
			);
			return;
		}
		updatedFields.category = opts.category as string;
	}

	if (opts.isDraft !== undefined) {
		updatedFields.idDraft = Boolean(opts.isDraft);
	}

	if (opts.publishedAt) {
		updatedFields.publishedAt = opts.publishedAt;
	}

	if (opts.updatedAt) {
		updatedFields.updatedAt = opts.updatedAt;
	}

	// Validate updated frontmatter
	const spinner2 = logger.spinner("Validating updated article");
	const parseResult = articleSchema.safeParse(updatedFields);

	if (!parseResult.success) {
		logger.spinnerError("Validation failed. Article not updated.");
		for (const err of parseResult.error.errors) {
			console.log(chalk.red(`- ${err.path.join(".")} ${err.message}`));
		}
		return;
	}

	// Update frontmatter and content
	let newContent: string;
	if (opts.bodyContent) {
		// Custom body content provided, update both frontmatter and body
		newContent = updateFrontmatter("", updatedFields) + opts.bodyContent;
	} else {
		// Just update frontmatter, keep existing body
		newContent = updateFrontmatter(content, updatedFields);
	}

	// Write updated content to file
	spinner2.text = "Writing updated article";
	try {
		await fs.writeFile(filePath, newContent, "utf-8");
		logger.spinnerSuccess(
			`Article updated: ${path.relative(process.cwd(), filePath)}`,
		);

		// Show summary of changes
		console.log(
			logger.box(
				`📝 ${chalk.green("Article successfully updated!")}
		
${chalk.bold("File:")} ${chalk.cyan(path.relative(process.cwd(), filePath))}
${chalk.bold("Title:")} ${chalk.cyan(
					getFrontMatterEntry(updatedFields, "title"),
				)}
${chalk.bold("Status:")} ${
					updatedFields.idDraft
						? chalk.yellow("Draft")
						: chalk.green("Published")
				}
${chalk.bold("Author:")} ${chalk.cyan((updatedFields.author as string) || "")}
${chalk.bold("Category:")} ${chalk.cyan(
					(updatedFields.category as string) || "(none)",
				)}
${chalk.bold("Tags:")} ${chalk.cyan(
					Array.isArray(updatedFields.tags)
						? updatedFields.tags.join(", ")
						: String(updatedFields.tags || "(none)"),
				)}`,
				"Article Details",
				"green",
			),
		);
	} catch (error) {
		logger.spinnerError(`Failed to write article: ${(error as Error).message}`);
	}
}
