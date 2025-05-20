import path from "node:path";
import chalk from "chalk";
import fs from "fs-extra";
import { articleSchema, normalizeMultilingualText } from "../../schemas";
import { updateFrontmatter } from "../../utils/frontmatter";
import { logger } from "../../utils/logger";
import type { ProjectPaths } from "../../utils/project";
import { getProjectPaths } from "../../utils/project";
import type { Article } from "../../schemas";

export interface CreateArticleOptions
	extends Partial<Omit<Article, "tags" | "title" | "description">> {
	verbose?: boolean;
	title?: string | Record<string, string>;
	description?: string | Record<string, string>;
	tags?: string;
	filename?: string;
	content?: string;
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

	// Validate available categories
	spinner.text = "Checking available categories";
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

	// Validate required fields
	spinner.text = "Validating input parameters";
	if (!opts.title) {
		logger.spinnerError("--title is required");
		return;
	}

	if (!opts.description) {
		logger.spinnerError("--description is required");
		return;
	}

	if (!opts.author) {
		logger.spinnerError("--author is required");
		return;
	}

	if (!opts.tags) {
		logger.spinnerError("--tags is required");
		return;
	}

	if (!opts.locale) {
		logger.spinnerError("--locale is required");
		return;
	}

	// Validate author exists
	if (authorChoices.length > 0 && !authorChoices.includes(opts.author)) {
		logger.spinnerError(
			`Author '${opts.author}' not found. Available: ${authorChoices.join(
				", ",
			)}\n💡 You can list authors with 'badael blog authors list' or create one with 'badael blog authors create ...'.`,
		);
		console.log(
			chalk.cyan(
				"\n💡 Tip: Use 'badael blog authors list' to see available authors, or 'badael blog authors create <id> ...' to add a new one.",
			),
		);
		return;
	}

	// Validate category exists if provided
	if (
		opts.category &&
		categoryChoices.length > 0 &&
		!categoryChoices.includes(opts.category)
	) {
		logger.spinnerError(
			`Category '${opts.category}' not found. Available: ${categoryChoices.join(
				", ",
			)}\n💡 You can list categories with 'badael blog categories list' or create one with 'badael blog categories create ...'.`,
		);
		console.log(
			chalk.cyan(
				"\n💡 Tip: Use 'badael blog categories list' to see available categories, or 'badael blog categories create <slug> ...' to add a new one.",
			),
		);
		return;
	}

	// Process tags
	const tags = (opts.tags || "")
		.split(",")
		.map((t) => t.trim())
		.filter(Boolean);

	// Generate slug if not provided
	const title =
		typeof opts.title === "string"
			? opts.title
			: opts.title.en || opts.title.ar || Object.values(opts.title)[0] || "";

	const slug =
		opts.slug ||
		title
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/(^-|-$)/g, "");

	const filename = opts.filename || slug;

	// Create frontmatter object
	spinner.text = "Creating article frontmatter";
	const frontmatterObj: Partial<Article> = {
		title: normalizeMultilingualText(opts.title, opts.locale),
		description: normalizeMultilingualText(opts.description, opts.locale),
		author: opts.author,
		tags,
		locale: opts.locale,
		isDraft: opts.isDraft === undefined ? true : opts.isDraft, // Default to draft
		category: opts.category || "",
		image: opts.image || "",
		readingTime: opts.readingTime,
		isFeatured: opts.isFeatured === undefined ? false : opts.isFeatured,
		publishedAt: opts.publishedAt,
		updatedAt: opts.updatedAt || "",
		series: opts.series || "",
		seriesIndex: opts.seriesIndex,
	canonicalURL: opts.canonicalURL || "",
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
	const defaultContent = `# ${title}

Write your article here...

## Introduction

Your introduction goes here...

## Main Content

Your main content goes here...

## Conclusion

Your conclusion goes here...
`;

	const frontmatter =
		updateFrontmatter("", frontmatterObj) + (opts.content ?? defaultContent);

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
${chalk.bold("Title:")} ${chalk.cyan(title)}
${chalk.bold("Status:")} ${
					frontmatterObj.isDraft
						? chalk.yellow("Draft")
						: chalk.green("Published")
				}
${chalk.bold("Author:")} ${chalk.cyan(opts.author)}
${chalk.bold("Category:")} ${chalk.cyan(opts.category || "(none)")}
${chalk.bold("Tags:")} ${chalk.cyan(tags.join(", ") || "(none)")}`,
				"Article Details",
				"green",
			),
		);
	} catch (error) {
		logger.spinnerError(`Failed to write article: ${(error as Error).message}`);
	}
}
