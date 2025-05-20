import path from "node:path";
import chalk from "chalk";
import { createPatch } from "diff";
import fs from "fs-extra";
import prompts from "prompts";
import { logger } from "../utils/logger";
import { findProjectRoot } from "../utils/project";
import {
	ConfigTemplate,
	ContentSchemaTemplates,
	SampleContentTemplates,
} from "../utils/templates";

// Helper to read and parse existing config file
async function readExistingConfig(
	projectRoot: string,
	configFiles: string[],
): Promise<any | null> {
	for (const file of configFiles) {
		const filePath = path.join(projectRoot, file);
		if (await fs.pathExists(filePath)) {
			try {
				if (file.endsWith(".json")) {
					return JSON.parse(await fs.readFile(filePath, "utf-8"));
				}
				// For .js/.ts, try to require or eval (best effort, not perfect)
				const content = await fs.readFile(filePath, "utf-8");
				const match = content.match(/export default (.*);/s);
				if (match) {
					return JSON.parse(match[1]);
				}
			} catch (e) {
				// Ignore parse errors, fallback to defaults
			}
		}
	}
	return null;
}

// Helper to validate content.config.ts (basic check for required collections)
function validateContentConfig(content: string): boolean {
	return (
		content.includes("import { defineCollection") &&
		content.includes("export default defineContentConfig") &&
		content.includes("articles: defineCollection(") &&
		content.includes("authors: defineCollection(") &&
		content.includes("categories: defineCollection(")
	);
}
import * as Diff from "diff";

/**
 * Initialize a project with BlogForge configuration
 */
export async function initProject(opts: {
	force?: boolean;
	verbose?: boolean;
}) {
	const spinner = logger.spinner("Initializing BlogForge");

	// Find Nuxt project
	spinner.text = "Checking for Nuxt project";
	const projectRoot = await findProjectRoot(process.cwd());

	if (!projectRoot) {
		logger.spinnerError(
			"Could not find a Nuxt project. Please run this command in a Nuxt project directory.",
		);
		return;
	}

	// Check for existing configuration
	const configFiles = [
		"blogforge.config.js",
		"blogforge.config.ts",
		"blogforge.config.mjs",
		"blogforge.config.cjs",
		"blogforge.config.json",
		"blogforge.config",
	];

	const existingConfig = configFiles.find((file) =>
		fs.existsSync(path.join(projectRoot, file)),
	);

	if (existingConfig && !opts.force) {
		logger.spinnerWarn(
			`Configuration file ${existingConfig} already exists. Use --force to overwrite.`,
		);
		return;
	}

	// Check for content directory
	const contentDir = path.join(projectRoot, "content");
	let createContentDir = false;

	if (!(await fs.pathExists(contentDir))) {
		spinner.stop();

		const contentResponse = await prompts({
			type: "confirm",
			name: "create",
			message: "Content directory does not exist. Create it?",
			initial: true,
		});

		if (!contentResponse.create) {
			logger.error("Content directory is required for BlogForge to work.");
			return;
		}

		createContentDir = true;
		spinner.start("Setting up BlogForge");
	}

	// Ask for configuration options
	spinner.stop();

	// Read existing config if present
	const existingConfigData = await readExistingConfig(projectRoot, configFiles);

	// Ask questions to configure the blog system, using existing config as defaults if available
	const questions = [
		{
			type: "select" as const,
			name: "configFormat",
			message: "What format do you want for your configuration file?",
			choices: [
				{ title: "JavaScript (blogforge.config.js)", value: "js" },
				{ title: "TypeScript (blogforge.config.ts)", value: "ts" },
				{ title: "JSON (blogforge.config.json)", value: "json" },
			],
			initial: 0,
		},
		{
			type: "text" as const,
			name: "articlesDir",
			message: "Directory for articles (relative to content/):",
			initial: existingConfigData?.directories?.articles || "articles",
		},
		{
			type: "text" as const,
			name: "authorsDir",
			message: "Directory for authors (relative to content/):",
			initial: existingConfigData?.directories?.authors || "authors",
		},
		{
			type: "text" as const,
			name: "categoriesDir",
			message: "Directory for categories (relative to content/):",
			initial: existingConfigData?.directories?.categories || "categories",
		},
		{
			type: "text" as const,
			name: "imagesDir",
			message: "Directory for images (relative to public/):",
			initial: existingConfigData?.directories?.images || "images",
		},
		{
			type: "confirm" as const,
			name: "multilingual",
			message: "Enable multilingual support?",
			initial: existingConfigData?.multilingual ?? false,
		},
		{
			type: (prev: any) => (prev ? ("list" as const) : null),
			name: "languages",
			message: "Supported languages (comma-separated):",
			initial: existingConfigData?.languages?.join(",") || "en,fr",
			separator: ",",
		},
		{
			type: (prev: any) =>
				prev && prev.length > 0 ? ("select" as const) : null,
			name: "defaultLanguage",
			message: "Default language:",
			choices: (prev: any, values: any) =>
				values.languages.map((lang: string) => ({
					title: lang,
					value: lang,
				})),
			initial: 0,
		},
		{
			type: "confirm" as const,
			name: "setupContentConfig",
			message: "Create/update content.config.ts with blog schemas?",
			initial: true,
		},
	];

	logger.info(
		chalk.cyan(
			"\nLet's configure your blog (existing values shown, press enter to confirm):\n",
		),
	);

	const answers = await prompts(questions, {
		onCancel: () => {
			logger.error(chalk.red("\nInitialization cancelled."));
			process.exit(0);
		},
	});

	// Create configuration
	spinner.start("Creating configuration");

	const config = {
		directories: {
			articles: answers.articlesDir,
			authors: answers.authorsDir,
			categories: answers.categoriesDir,
			images: answers.imagesDir,
		},
		multilingual: answers.multilingual,
		languages: answers.languages || ["en"],
		defaultLanguage: answers.defaultLanguage || "en",
		schemaExtensions: {
			article: {},
			author: {},
			category: {},
		},
		defaultValues: {
			article: {
				isDraft: true,
			},
			author: {},
			category: {},
		},
	};

	// Write configuration file
	let configFile: string;
	let configContent: string;

	switch (answers.configFormat) {
		case "ts":
			configFile = "blogforge.config.ts";
			configContent = ConfigTemplate(config).ts;
			break;
		case "json":
			configFile = "blogforge.config.json";
			configContent = ConfigTemplate(config).json;
			break;
		default:
			configFile = "blogforge.config.js";
			configContent = ConfigTemplate(config).js;
			break;
	}

	const configPath = path.join(projectRoot, configFile);
	await fs.writeFile(configPath, configContent, "utf-8");

	// Create content directories if needed
	if (createContentDir) {
		await fs.mkdir(contentDir);
	}

	const articlesDirPath = path.join(contentDir, answers.articlesDir);
	const authorsDirPath = path.join(contentDir, answers.authorsDir);
	const categoriesDirPath = path.join(contentDir, answers.categoriesDir);
	const imagesDirPath = path.join(projectRoot, "public", answers.imagesDir);

	for (const dir of [
		articlesDirPath,
		authorsDirPath,
		categoriesDirPath,
		imagesDirPath,
	]) {
		if (!(await fs.pathExists(dir))) {
			await fs.mkdir(dir, { recursive: true });
			logger.verbose(
				`Created directory: ${path.relative(projectRoot, dir)}`,
				opts.verbose || false,
			);
		}
	}

	// Always check and validate content.config.ts
	const contentConfigPath = path.join(projectRoot, "content.config.ts");
	let existingContentConfig = "";
	let hasExistingContentConfig = false;
	let validContentConfig = false;
	if (await fs.pathExists(contentConfigPath)) {
		existingContentConfig = await fs.readFile(contentConfigPath, "utf-8");
		hasExistingContentConfig = true;
		validContentConfig = validateContentConfig(existingContentConfig);
	}

	// Create schema definitions
	const schemaTemplates = ContentSchemaTemplates(
		answers.articlesDir,
		answers.authorsDir,
		answers.categoriesDir,
		answers.multilingual,
		answers.defaultLanguage || "en",
	);

	const articleSchema = schemaTemplates.article;
	const authorSchema = schemaTemplates.author;
	const categorySchema = schemaTemplates.category;
	const imports = schemaTemplates.imports;
	const configTemplate = schemaTemplates.configTemplate;

	let contentConfigContent = "";
	let shouldWriteContentConfig = false;

	// Helper to replace CLI-managed collections in content.config.ts
	function updateCliCollectionsInConfig(
		existingContent: string,
		newCollections: Record<string, string>,
	): string {
		// Regex to match each CLI-managed collection block
		const collectionNames = Object.keys(newCollections);
		let updatedContent = existingContent;
		for (const name of collectionNames) {
			// Match the collection definition (e.g., articles: defineCollection({ ... })[,])
			const regex = new RegExp(
				`${name}:\\s*defineCollection\\([^}}]+\\)\)`,
				"gm",
			);
			updatedContent = updatedContent.replace(regex, newCollections[name]);
		}
		return updatedContent;
	}

	if (!hasExistingContentConfig || !validContentConfig) {
		// If missing or invalid, create/fix it
		contentConfigContent = `${imports}\n\n${configTemplate.replace(
			"$COLLECTIONS",
			`  ${articleSchema},\n  ${authorSchema},\n  ${categorySchema}`,
		)}`;
		shouldWriteContentConfig = true;
		if (hasExistingContentConfig && !validContentConfig) {
			logger.error(
				chalk.red(
					"\nExisting content.config.ts is invalid or missing required collections. Overwriting with a valid template.",
				),
			);
		}
	} else {
		// If valid, update only CLI-managed collections, keep user customizations
		let baseContent = existingContentConfig;
		if (
			!baseContent.includes(
				"import { defineCollection, defineContentConfig, z }",
			)
		) {
			baseContent = `${imports}\n${baseContent}`;
		}
		// Prepare new CLI-managed collections
		const newCollections = {
			articles: articleSchema,
			authors: authorSchema,
			categories: categorySchema,
		};
		// Replace only CLI-managed collections
		const mergedContent = updateCliCollectionsInConfig(
			baseContent,
			newCollections,
		);
		if (baseContent !== mergedContent) {
			const patch = createPatch(
				"content.config.ts",
				baseContent,
				mergedContent,
				"Current",
				"Updated",
			);
			if (opts.verbose) {
				logger.info(
					chalk.yellow(
						"\n--- content.config.ts changes (CLI-managed collections only) ---\n",
					),
				);
				logger.info(patch);
			}
			// Ask user if they want to update
			const updateResponse = await prompts({
				type: "confirm",
				name: "update",
				message:
					"CLI-managed collections in content.config.ts differ from the template. Overwrite only these sections?",
				initial: false,
			});
			if (updateResponse.update) {
				contentConfigContent = mergedContent;
				shouldWriteContentConfig = true;
			}
		}
	}

	if (shouldWriteContentConfig) {
		await fs.writeFile(contentConfigPath, contentConfigContent, "utf-8");
		logger.verbose(
			`Updated content config: ${contentConfigPath}`,
			opts.verbose || false,
		);
	}

	// Create a sample article
	const setupSampleContent = async () => {
		spinner.text = "Creating sample content";

		// Only create samples if directories are empty
		const articleFiles = await fs.readdir(articlesDirPath);
		const authorFiles = await fs.readdir(authorsDirPath);
		const categoryFiles = await fs.readdir(categoriesDirPath);

		if (
			articleFiles.length === 0 &&
			authorFiles.length === 0 &&
			categoryFiles.length === 0
		) {
			// Create sample content
			const templates = SampleContentTemplates(
				answers.languages || ["en"],
				answers.defaultLanguage || "en",
			);

			// Create sample author
			const authorContent = answers.multilingual
				? templates.author.multilingual
				: templates.author.default;

			await fs.writeFile(
				path.join(authorsDirPath, "john-doe.md"),
				authorContent,
				"utf-8",
			);

			// Create sample category
			const categoryContent = answers.multilingual
				? templates.category.multilingual
				: templates.category.default;

			await fs.writeFile(
				path.join(categoriesDirPath, "technology.md"),
				categoryContent,
				"utf-8",
			);

			// Create sample article
			const articleContent = answers.multilingual
				? templates.article.multilingual
				: templates.article.default;

			await fs.writeFile(
				path.join(articlesDirPath, "getting-started-with-blogforge.md"),
				articleContent,
				"utf-8",
			);
		}
	};

	// Ask to setup sample content
	spinner.stop();

	const setupSamplesResponse = await prompts({
		type: "confirm",
		name: "setupSamples",
		message: "Create sample content (author, category, article)?",
		initial: true,
	});

	if (setupSamplesResponse.setupSamples) {
		spinner.start("Creating sample content");
		await setupSampleContent();
	}

	// Complete
	logger.spinnerSuccess(`BlogForge initialized successfully at ${projectRoot}`);

	logger.info(
		chalk.green(`\nConfiguration file created: ${chalk.cyan(configFile)}`),
	);
	logger.info(
		chalk.green(
			`Content directories set up in: ${chalk.cyan(
				path.relative(process.cwd(), contentDir),
			)}`,
		),
	);

	if (answers.setupContentConfig) {
		logger.info(
			chalk.green(
				`Content schemas defined in: ${chalk.cyan("content.config.ts")}`,
			),
		);
	}

	if (setupSamplesResponse.setupSamples) {
		logger.info(chalk.green("Sample content created"));
	}

	logger.info(
		chalk.cyan(`\nTo get started, run: ${chalk.bold("npx blogforge")}`),
	);
}
