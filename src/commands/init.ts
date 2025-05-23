import path from "node:path";
import chalk from "chalk";
import fs from "fs-extra";
import prompts from "prompts";
import { logger } from "../utils/logger";
import { getProjectPaths, type ProjectPaths } from "../utils/project"; // findProjectRoot removed
import {
	ConfigTemplate,
	ContentSchemaTemplates,
	SampleContentTemplates,
} from "../utils/templates";

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

/**
 * Initialize a project with BlogForge configuration
 */
export async function initProject(opts: {
	force?: boolean;
	verbose?: boolean;
}) {
	const spinner = logger.spinner("Initializing BlogForge");

	// Find Nuxt project
	spinner.text = "Verifying Nuxt Content project structure";
	let projectPaths: ProjectPaths;
	try {
		projectPaths = await getProjectPaths(process.cwd());
	} catch (error) {
		logger.spinnerError(
			`Project verification failed: ${(error as Error).message}`,
		);
		logger.info(
			"Ensure you are running this command from within a Nuxt 3 project directory with @nuxt/content installed, or that your content sources are correctly configured.",
		);
		return;
	}
	const projectRoot = projectPaths.root;

	// Mutable config that will be updated by prompts
	const interactiveConfig = JSON.parse(JSON.stringify(projectPaths.config)); // Deep clone

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

	// If forcing or no existing config, prompt for settings
	if (opts.force || !existingConfig) {
		spinner.stop(); // Stop spinner for prompts

		logger.info(chalk.blue("Configuring BlogForge project settings:"));

		const dirResponses = await prompts([
			{
				type: "text",
				name: "articles",
				message: `Articles directory (relative to content, default: ${interactiveConfig.directories.articles})`,
				initial: interactiveConfig.directories.articles,
			},
			{
				type: "text",
				name: "authors",
				message: `Authors directory (relative to content, default: ${interactiveConfig.directories.authors})`,
				initial: interactiveConfig.directories.authors,
			},
			{
				type: "text",
				name: "categories",
				message: `Categories directory (relative to content, default: ${interactiveConfig.directories.categories})`,
				initial: interactiveConfig.directories.categories,
			},
			{
				type: "text",
				name: "images",
				message: `Images directory (in public, default: ${interactiveConfig.directories.images})`,
				initial: interactiveConfig.directories.images,
			},
		]);
		interactiveConfig.directories = {
			...interactiveConfig.directories,
			...dirResponses,
		};

		const langResponse = await prompts({
			type: "confirm",
			name: "multilingual",
			message: "Enable multilingual support?",
			initial: interactiveConfig.multilingual,
		});
		interactiveConfig.multilingual = langResponse.multilingual;

		if (interactiveConfig.multilingual) {
			const languagesResponse = await prompts([
				{
					type: "text",
					name: "languages",
					message: "Enter languages (comma-separated, e.g., en,es):",
					initial: interactiveConfig.languages.join(","),
					validate: (value) =>
						value
							.split(",")
							.map((s: string) => s.trim())
							.filter(Boolean).length > 0
							? true
							: "Please enter at least one language.",
				},
			]);
			interactiveConfig.languages = languagesResponse.languages
				.split(",")
				.map((s: string) => s.trim())
				.filter(Boolean);

			const defaultLanguageResponse = await prompts({
				type: "select", // Changed to select
				name: "defaultLanguage",
				message: "Select default language:",
				choices: interactiveConfig.languages.map((lang: string) => ({
					title: lang,
					value: lang,
				})),
				initial: interactiveConfig.languages.includes(
					interactiveConfig.defaultLanguage,
				)
					? interactiveConfig.languages.indexOf(
							interactiveConfig.defaultLanguage,
						)
					: 0,
				validate: (value) =>
					interactiveConfig.languages.includes(value)
						? true
						: "Invalid selection",
			});
			interactiveConfig.defaultLanguage =
				defaultLanguageResponse.defaultLanguage;
		} else {
			interactiveConfig.languages = ["en"];
			interactiveConfig.defaultLanguage = "en";
		}
		spinner.start(); // Restart spinner
	}

	// Check for content directory and entity directories
	// Only prompt to create local 'content' and subdirectories if no 'fs' source is explicitly defined
	// or if the defined 'fs' source points to the default 'content' location and it doesn't exist.

	let createDefaultContentStructure = false;
	const defaultContentDir = path.join(projectRoot, "content");

	if (
		!projectPaths.hasRemoteSources &&
		(!projectPaths.content || !(await fs.pathExists(projectPaths.content)))
	) {
		// If no remote sources AND (no content path defined OR defined content path doesn't exist)
		// This implies a local-only setup is intended or possible.
		spinner.stop();
		const contentResponse = await prompts({
			type: "confirm",
			name: "value",
			message: `The default 'content' directory does not exist at ${chalk.cyan(path.relative(process.cwd(), defaultContentDir))}. Create it now?`,
			initial: true,
		});

		if (contentResponse.value) {
			createDefaultContentStructure = true;
		} else {
			logger.info(
				"Skipping 'content' directory creation. You may need to configure your content sources manually in nuxt.config.ts or content.config.ts if you intend to use local content.",
			);
		}
		spinner.start();
	} else if (projectPaths.hasRemoteSources && !projectPaths.content) {
		logger.info(
			"Project uses remote content sources. Skipping local 'content' directory check for initialization.",
		);
	}

	// Create blogforge.config.ts
	spinner.text = "Creating BlogForge configuration file";
	const detectedConfigFormat =
		existingConfig?.split(".").pop()?.toLowerCase() || "ts";
	const configFormatToUse = opts.force
		? "ts" // Default to ts if forcing
		: ["ts", "js", "json"].includes(detectedConfigFormat)
			? detectedConfigFormat
			: "ts";
	const configFileName = `blogforge.config.${configFormatToUse}`;
	const configFilePath = path.join(projectRoot, configFileName);

	// Prepare config for blogforge.config.ts with relative root
	const blogForgeFileConfig = JSON.parse(JSON.stringify(interactiveConfig)); // Deep clone
	blogForgeFileConfig.root = "."; // Set root to be relative to project root

	let configContent: string;
	switch (configFormatToUse) {
		case "ts":
			configContent = ConfigTemplate(blogForgeFileConfig).ts;
			break;
		case "json":
			configContent = ConfigTemplate(blogForgeFileConfig).json;
			break;
		// case "js": // Removed redundant case
		default:
			configContent = ConfigTemplate(blogForgeFileConfig).js;
			break;
	}

	await fs.writeFile(configFilePath, configContent);
	logger.info(
		`Created configuration file: ${chalk.cyan(path.relative(process.cwd(), configFilePath))}`,
	);

	// Create content.config.ts if it doesn't exist or is invalid
	spinner.text = "Checking/Creating content.config.ts";
	const contentConfigPath = path.join(projectRoot, "content.config.ts");
	let contentConfigFileContent = "";

	if (await fs.pathExists(contentConfigPath)) {
		contentConfigFileContent = await fs.readFile(contentConfigPath, "utf-8");
	}

	if (!validateContentConfig(contentConfigFileContent) || opts.force) {
		if (opts.force && (await fs.pathExists(contentConfigPath))) {
			logger.info(
				`Overwriting existing ${chalk.cyan("content.config.ts")} due to --force flag.`,
			);
		}
		const templates = ContentSchemaTemplates(
			interactiveConfig.directories.articles,
			interactiveConfig.directories.authors,
			interactiveConfig.directories.categories,
			interactiveConfig.multilingual,
			interactiveConfig.defaultLanguage,
		);

		const collectionsString = [
			templates.article,
			templates.author,
			templates.category,
		].join(",\n    ");

		const finalContentConfig = `${templates.imports}\n${templates.configTemplate.replace("$COLLECTIONS", collectionsString)}`;

		await fs.writeFile(contentConfigPath, finalContentConfig);
		logger.info(`Created/Updated ${chalk.cyan("content.config.ts")}`);
	} else {
		logger.info(
			`${chalk.cyan("content.config.ts")} already exists and seems valid. Skipping.`,
		);
	}

	// Create content schemas
	spinner.text = "Creating content schemas";
	const schemasDir = path.join(projectRoot, "server", "schemas"); // This path might need to be configurable
	if (!(await fs.pathExists(schemasDir))) {
		await fs.mkdirp(schemasDir);
	}

	const articleSchemaPath = path.join(schemasDir, "article.ts");
	const authorSchemaPath = path.join(schemasDir, "author.ts");
	const categorySchemaPath = path.join(schemasDir, "category.ts");

	if (!(await fs.pathExists(articleSchemaPath)) || opts.force) {
		await fs.writeFile(
			articleSchemaPath,
			ContentSchemaTemplates(
				interactiveConfig.directories.articles, // Use interactiveConfig
				interactiveConfig.directories.authors, // Use interactiveConfig
				interactiveConfig.directories.categories, // Use interactiveConfig
				interactiveConfig.multilingual, // Use interactiveConfig
				interactiveConfig.defaultLanguage, // Use interactiveConfig
			).article,
		);
		logger.info(
			`Created schema: ${chalk.cyan(path.relative(process.cwd(), articleSchemaPath))}`,
		);
	}
	if (!(await fs.pathExists(authorSchemaPath)) || opts.force) {
		await fs.writeFile(
			authorSchemaPath,
			ContentSchemaTemplates(
				interactiveConfig.directories.articles, // Use interactiveConfig
				interactiveConfig.directories.authors, // Use interactiveConfig
				interactiveConfig.directories.categories, // Use interactiveConfig
				interactiveConfig.multilingual, // Use interactiveConfig
				interactiveConfig.defaultLanguage, // Use interactiveConfig
			).author,
		);
		logger.info(
			`Created schema: ${chalk.cyan(path.relative(process.cwd(), authorSchemaPath))}`,
		);
	}
	if (!(await fs.pathExists(categorySchemaPath)) || opts.force) {
		await fs.writeFile(
			categorySchemaPath,
			ContentSchemaTemplates(
				interactiveConfig.directories.articles, // Use interactiveConfig
				interactiveConfig.directories.authors, // Use interactiveConfig
				interactiveConfig.directories.categories, // Use interactiveConfig
				interactiveConfig.multilingual, // Use interactiveConfig
				interactiveConfig.defaultLanguage, // Use interactiveConfig
			).category,
		);
		logger.info(
			`Created schema: ${chalk.cyan(path.relative(process.cwd(), categorySchemaPath))}`,
		);
	}

	// Only create default entity directories if we decided to create the default 'content' structure
	// or if specific local fs paths for them are defined and don't exist.
	if (createDefaultContentStructure) {
		spinner.text =
			"Creating default content directories (articles, authors, categories)";
		const articlesDir =
			projectPaths.articles || // This might need to use interactiveConfig if path logic changes
			path.join(defaultContentDir, interactiveConfig.directories.articles); // Use interactiveConfig
		const authorsDir =
			projectPaths.authors || // This might need to use interactiveConfig
			path.join(defaultContentDir, interactiveConfig.directories.authors); // Use interactiveConfig
		const categoriesDir =
			projectPaths.categories || // This might need to use interactiveConfig
			path.join(defaultContentDir, interactiveConfig.directories.categories); // Use interactiveConfig

		for (const dir of [articlesDir, authorsDir, categoriesDir]) {
			if (dir && !(await fs.pathExists(dir))) {
				// Check dir is not null
				await fs.mkdirp(dir);
				logger.info(`Created directory: ${path.relative(process.cwd(), dir)}`);
			}
		}
	} else if (!projectPaths.hasRemoteSources) {
		// If not creating default structure but also not remote, check configured local paths
		for (const dir of [
			projectPaths.articles,
			projectPaths.authors,
			projectPaths.categories,
		]) {
			if (dir && !(await fs.pathExists(dir))) {
				await fs.mkdirp(dir);
				logger.info(
					`Created configured directory: ${path.relative(process.cwd(), dir)}`,
				);
			}
		}
	}

	// Create sample content
	spinner.text = "Creating sample content";
	if (createDefaultContentStructure) {
		// Only create sample content if we created the default structure
		const sampleArticlePath = path.join(
			projectPaths.articles || // This might need to use interactiveConfig
				path.join(defaultContentDir, interactiveConfig.directories.articles), // Use interactiveConfig
			"my-first-post.md",
		);
		const sampleAuthorPath = path.join(
			projectPaths.authors || // This might need to use interactiveConfig
				path.join(defaultContentDir, interactiveConfig.directories.authors), // Use interactiveConfig
			"john-doe.md",
		);
		const sampleCategoryPath = path.join(
			projectPaths.categories || // This might need to use interactiveConfig
				path.join(
					defaultContentDir,
					interactiveConfig.directories.categories, // Use interactiveConfig
				),
			"technology.md",
		);

		if (!(await fs.pathExists(sampleArticlePath))) {
			await fs.writeFile(
				sampleArticlePath,
				SampleContentTemplates(
					interactiveConfig.languages, // Use interactiveConfig
					interactiveConfig.defaultLanguage, // Use interactiveConfig
				).article[interactiveConfig.multilingual ? "multilingual" : "default"],
			);
			logger.info(
				`Created sample article: ${chalk.cyan(path.relative(process.cwd(), sampleArticlePath))}`,
			);
		}
		if (!(await fs.pathExists(sampleAuthorPath))) {
			await fs.writeFile(
				sampleAuthorPath,
				SampleContentTemplates(
					interactiveConfig.languages, // Use interactiveConfig
					interactiveConfig.defaultLanguage, // Use interactiveConfig
				).author[interactiveConfig.multilingual ? "multilingual" : "default"],
			);
			logger.info(
				`Created sample author: ${chalk.cyan(path.relative(process.cwd(), sampleAuthorPath))}`,
			);
		}
		if (!(await fs.pathExists(sampleCategoryPath))) {
			await fs.writeFile(
				sampleCategoryPath,
				SampleContentTemplates(
					interactiveConfig.languages, // Use interactiveConfig
					interactiveConfig.defaultLanguage, // Use interactiveConfig
				).category[interactiveConfig.multilingual ? "multilingual" : "default"],
			);
			logger.info(
				`Created sample category: ${chalk.cyan(path.relative(process.cwd(), sampleCategoryPath))}`,
			);
		}
	} else {
		logger.info(
			"Skipping sample content creation as default content structure was not created or project uses remote sources.",
		);
	}

	// Create .gitignore entries
	spinner.text = "Updating .gitignore";
	const gitignorePath = path.join(projectRoot, ".gitignore");
	const gitignoreEntries = ["# BlogForge", "/blogforge.config.json"]; // Example entries

	try {
		let gitignoreContent = "";
		if (await fs.pathExists(gitignorePath)) {
			gitignoreContent = await fs.readFile(gitignorePath, "utf-8");
		}

		let updatedGitignore = gitignoreContent;
		for (const entry of gitignoreEntries) {
			if (!gitignoreContent.includes(entry)) {
				updatedGitignore += `\\n${entry}`;
			}
		}

		if (updatedGitignore !== gitignoreContent) {
			await fs.writeFile(gitignorePath, `${updatedGitignore.trim()}\\n`); // Use template literal
			logger.info(`Updated ${chalk.cyan(".gitignore")}`);
		}
	} catch (error) {
		logger.error(`Could not update .gitignore: ${(error as Error).message}`); // Changed to logger.error
	}

	spinner.succeed(chalk.green("BlogForge initialized successfully!"));
	logger.info(
		`Configuration file created at ${chalk.cyan(path.relative(process.cwd(), configFilePath))}`,
	);
	if (createDefaultContentStructure) {
		logger.info(
			`Sample content and schemas created in ${chalk.cyan(path.relative(process.cwd(), defaultContentDir))} and ${chalk.cyan(path.relative(process.cwd(), schemasDir))}`,
		);
	} else if (
		!projectPaths.hasRemoteSources &&
		(projectPaths.articles || projectPaths.authors || projectPaths.categories)
	) {
		logger.info("Checked/created configured local content directories.");
	}
	logger.info("You can now start using BlogForge commands.");
}
