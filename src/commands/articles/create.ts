import path from "node:path";
import chalk from "chalk";
import fs from "fs-extra";
import prompts, { type InitialReturnValue } from "prompts"; // Import InitialReturnValue
import { articleSchema, normalizeMultilingualText } from "../../schemas";
import { updateFrontmatter } from "../../utils/frontmatter";
import { logger } from "../../utils/logger";
import type { ProjectPaths } from "../../utils/project";
import { getProjectPaths } from "../../utils/project";
import type { Article } from "../../schemas";

export interface CreateArticleOptions {
	verbose?: boolean;
	// Most fields will be prompted, so they can be optional here
	title?: string | Record<string, string>;
	description?: string | Record<string, string>;
	author?: string;
	tags?: string; // Will be prompted as a comma-separated string
	locale?: string;
	filename?: string;
	content?: string;
	category?: string;
	isDraft?: boolean;
	image?: string;
	readingTime?: number;
	isFeatured?: boolean;
	publishedAt?: string;
	updatedAt?: string;
	canonicalURL?: string;
	slug?: string;
}

export async function createArticle(opts: CreateArticleOptions) {
	const spinner = logger.spinner("Initializing article creation");

	// Get project paths
	let paths: ProjectPaths;
	try {
		paths = await getProjectPaths(process.cwd());
		spinner.text = "Validating project structure";
	} catch (e) {
		logger.spinnerError(`Project validation failed: ${(e as Error).message}`);
		return;
	}

	// Validate available authors
	spinner.text = "Checking available authors";
	const authorsDir = paths.authors;
	let authorChoices: { title: string; value: string }[] = [];

	try {
		if (await fs.pathExists(authorsDir)) {
			const authorFiles = await fs.readdir(authorsDir);
			authorChoices = authorFiles
				.filter((f) => f.endsWith(".md"))
				.map((f) => ({
					title: f.replace(/\.md$/, ""),
					value: f.replace(/\.md$/, ""),
				}));
		}
	} catch (error) {
		logger.spinnerWarn(
			`Could not read authors directory: ${(error as Error).message}`,
		);
	}

	// Validate available categories
	spinner.text = "Checking available categories";
	const categoriesDir = paths.categories;
	let categoryChoices: { title: string; value: string }[] = [];

	try {
		if (await fs.pathExists(categoriesDir)) {
			const categoryFiles = await fs.readdir(categoriesDir);
			categoryChoices = categoryFiles
				.filter((f) => f.endsWith(".md"))
				.map((f) => ({
					title: f.replace(/\.md$/, ""),
					value: f.replace(/\.md$/, ""),
				}));
		}
	} catch (error) {
		logger.spinnerWarn(
			`Could not read categories directory: ${(error as Error).message}`,
		);
	}
	spinner.stop(); // Stop spinner before prompting

	const responses = await prompts([
		{
			type: "text",
			name: "title",
			message: "Article Title:",
			initial: (opts.title as InitialReturnValue) || "", // Cast to InitialReturnValue
			validate: (value) => (value ? true : "Title is required"),
		},
		{
			type: "text",
			name: "description",
			message: "Article Description:",
			initial: (opts.description as InitialReturnValue) || "", // Cast to InitialReturnValue
			validate: (value) => (value ? true : "Description is required"),
		},
		{
			type: authorChoices.length > 0 ? "select" : "text",
			name: "author",
			message: "Author:",
			choices: authorChoices,
			initial: opts.author,
			validate: (value) => (value ? true : "Author is required"),
		},
		{
			type: "text",
			name: "tags",
			message: "Tags (comma-separated):",
			initial: opts.tags || "",
		},
		{
			type: "text",
			name: "locale",
			message: "Locale (e.g., en, ar):",
			initial: opts.locale || "ar",
			validate: (value) => (value ? true : "Locale is required"),
		},
		{
			type: categoryChoices.length > 0 ? "select" : "text",
			name: "category",
			message: "Category (optional):",
			choices: [{ title: "(none)", value: "" }, ...categoryChoices],
			initial: opts.category || "",
		},
		{
			type: "text",
			name: "slug",
			message:
				"Slug (optional, will be auto-generated from title if left empty):",
			initial: opts.slug || "",
		},
		{
			type: "text",
			name: "filename",
			message:
				"Filename (optional, will be auto-generated from slug or title if left empty):",
			initial: opts.filename || "",
		},
		{
			type: "confirm",
			name: "isDraft",
			message: "Is this a draft?",
			initial: opts.isDraft === undefined ? true : opts.isDraft,
		},
		{
			type: "text",
			name: "image",
			message: "Image path (optional):",
			initial: opts.image || "",
		},
		{
			type: "number",
			name: "readingTime",
			message: "Reading time in minutes (optional):",
			initial: opts.readingTime,
		},
		{
			type: "confirm",
			name: "isFeatured",
			message: "Is this a featured article?",
			initial: opts.isFeatured === undefined ? false : opts.isFeatured,
		},
		{
			type: "text",
			name: "publishedAt",
			message: "Publication date (YYYY-MM-DD, optional):",
			initial: opts.publishedAt || "",
		},
		{
			type: "text",
			name: "canonicalURL",
			message: "Canonical URL (optional):",
			initial: opts.canonicalURL || "",
		},
	]);

	// Combine opts with responses, responses take precedence
	const articleData = { ...opts, ...responses };

	spinner.start("Processing article data");

	// Validate author exists if not selected from a list
	if (
		authorChoices.length === 0 &&
		articleData.author &&
		!(await fs.pathExists(path.join(authorsDir, `${articleData.author}.md`)))
	) {
		logger.spinnerError(
			`Author '${articleData.author}' not found. Please create the author first.`,
		);
		console.log(
			chalk.cyan(
				"\n💡 Tip: Use 'blogforge authors list' to see available authors, or 'blogforge authors create ...' to add a new one.",
			),
		);
		return;
	}
	if (
		authorChoices.length > 0 &&
		articleData.author &&
		!authorChoices.find((choice) => choice.value === articleData.author)
	) {
		logger.spinnerError(
			`Author '${articleData.author}' not found. Available: ${authorChoices
				.map((c) => c.value)
				.join(
					", ",
				)}\n💡 You can list authors with 'blogforge authors list' or create one with 'blogforge authors create ...'.`,
		);
		return;
	}

	// Validate category exists if provided and not selected from a list
	if (
		categoryChoices.length === 0 &&
		articleData.category &&
		!(await fs.pathExists(
			path.join(categoriesDir, `${articleData.category}.md`),
		))
	) {
		logger.spinnerError(
			`Category '${articleData.category}' not found. Please create the category first.`,
		);
		console.log(
			chalk.cyan(
				"\n💡 Tip: Use 'blogforge categories list' to see available categories, or 'blogforge categories create ...' to add a new one.",
			),
		);
		return;
	}
	if (
		categoryChoices.length > 0 &&
		articleData.category &&
		!categoryChoices.find((choice) => choice.value === articleData.category) &&
		articleData.category !== "" // Allow empty category
	) {
		logger.spinnerError(
			`Category '${articleData.category}' not found. Available: ${categoryChoices
				.map((c) => c.value)
				.join(
					", ",
				)}\n💡 You can list categories with 'blogforge categories list' or create one with 'blogforge categories create ...'.`,
		);
		return;
	}

	// Process tags
	const tags = (articleData.tags || "")
		.split(",")
		.map((t: string) => t.trim()) // Add type for t
		.filter(Boolean);

	// Generate slug if not provided
	const titleStr =
		typeof articleData.title === "string"
			? articleData.title
			: articleData.title.en ||
				articleData.title.ar ||
				Object.values(articleData.title)[0] ||
				"";

	const slug =
		articleData.slug ||
		titleStr
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/(^-|-$)/g, "");

	const filename = articleData.filename || slug;

	// Create frontmatter object
	spinner.text = "Creating article frontmatter";
	const frontmatterObj: Partial<Article> = {
		title: normalizeMultilingualText(articleData.title, articleData.locale),
		description: normalizeMultilingualText(
			articleData.description,
			articleData.locale,
		),
		author: articleData.author,
		tags,
		locale: articleData.locale,
		isDraft:
			articleData.isDraft === undefined ? true : Boolean(articleData.isDraft), // Default to draft
		category: articleData.category || "",
		image: articleData.image || "",
		readingTime: articleData.readingTime
			? Number(articleData.readingTime)
			: undefined,
		isFeatured:
			articleData.isFeatured === undefined
				? false
				: Boolean(articleData.isFeatured),
		publishedAt: articleData.publishedAt || undefined, // Keep as undefined if empty
		updatedAt: articleData.updatedAt || "",
		canonicalURL: articleData.canonicalURL || "",
		slug,
	};

	// Validate with Zod schema
	spinner.text = "Validating article schema";
	const parseResult = articleSchema.safeParse(frontmatterObj);
	if (!parseResult.success) {
		logger.spinnerError("Validation failed. Article not created.");
		for (const err of parseResult.error.errors) {
			console.log(chalk.red(`- ${err.path.join(".")} ${err.message}`));
		}
		return;
	}

	// Create content
	const defaultContent = `\\n# ${titleStr}

Write your article here...

## Introduction

Your introduction goes here...

## Main Content

Your main content goes here...

## Conclusion

Your conclusion goes here...
`;

	const frontmatter =
		updateFrontmatter("", frontmatterObj) +
		(articleData.content ?? defaultContent);

	// Write file
	spinner.text = `Writing article to ${filename}.md`;
	const filePath = path.join(paths.articles, `${filename}.md`);

	try {
		await fs.writeFile(filePath, frontmatter, "utf-8");
		logger.spinnerSuccess(
			`Article created: ${path.relative(process.cwd(), filePath)}`,
		);

		console.log(
			logger.box(
				`📝 ${chalk.green("Article successfully created!")}
		
${chalk.bold("File:")} ${chalk.cyan(path.relative(process.cwd(), filePath))}
${chalk.bold("Title:")} ${chalk.cyan(titleStr)}
${chalk.bold("Status:")} ${
					frontmatterObj.isDraft
						? chalk.yellow("Draft")
						: chalk.green("Published")
				}
${chalk.bold("Author:")} ${chalk.cyan(articleData.author)}
${chalk.bold("Category:")} ${chalk.cyan(articleData.category || "(none)")}
${chalk.bold("Tags:")} ${chalk.cyan(tags.join(", ") || "(none)")}`,
				"Article Details",
				"green",
			),
		);
	} catch (error) {
		logger.spinnerError(`Failed to write article: ${(error as Error).message}`);
	}
}
