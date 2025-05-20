import path from "node:path";
import fs from "fs-extra";
import { z } from "zod";
import { logger } from "./logger";

/**
 * Default BlogForge configuration
 */
export const defaultConfig = {
	// Project root (set at runtime)
	root: "",

	// Content structure
	directories: {
		articles: "articles",
		authors: "authors",
		categories: "categories",
		images: "images",
	},

	// Multilingual support
	multilingual: false,
	languages: ["en"],
	defaultLanguage: "en",

	// Schema settings
	schemaExtensions: {
		article: {},
		author: {},
		category: {},
	},

	// Default values
	defaultValues: {
		article: {
			isDraft: true,
		},
		author: {}, // Added to fix type error
		category: {}, // Added to fix type error
	},
};

/**
 * Configuration schema
 */
export const configSchema = z.object({
	root: z.string().optional(),

	directories: z
		.object({
			articles: z.string().optional(),
			authors: z.string().optional(),
			categories: z.string().optional(),
			images: z.string().optional(),
		})
		.optional(),

	multilingual: z.boolean().optional(),
	languages: z.array(z.string()).optional(),
	defaultLanguage: z.string().optional(),

	schemaExtensions: z
		.object({
			article: z.record(z.any()).optional(),
			author: z.record(z.any()).optional(),
			category: z.record(z.any()).optional(),
		})
		.optional(),

	defaultValues: z
		.object({
			article: z.record(z.any()).optional(),
			author: z.record(z.any()).optional(),
			category: z.record(z.any()).optional(),
		})
		.optional(),
});

export type BlogForgeConfig = typeof defaultConfig;

/**
 * Try to load and parse a JSON configuration file
 */
async function tryLoadJsonConfig(filePath: string, verbose?: boolean) {
	try {
		if (await fs.pathExists(filePath)) {
			const content = await fs.readFile(filePath, "utf-8");
			return JSON.parse(content);
		}
	} catch (error) {
		logger.verbose(
			`Failed to load JSON config at ${filePath}: ${(error as Error).message}`,
			!!verbose,
		);
	}
	return null;
}

/**
 * Try to load a module using dynamic import
 */
async function tryLoadModuleConfig(filePath: string, verbose?: boolean) {
	try {
		if (await fs.pathExists(filePath)) {
			// Use dynamic import which works with ESM and CJS modules
			const imported = await import(`file://${filePath}`);
			return imported.default || imported;
		}
	} catch (error) {
		logger.verbose(
			`Failed to load module config at ${filePath}: ${
				(error as Error).message
			}`,
			!!verbose,
		);
	}
	return null;
}

/**
 * Load configuration from various possible file formats
 */
export async function loadConfig(
	projectRoot: string,
	verbose?: boolean,
): Promise<BlogForgeConfig> {
	const configFiles = [
		// JavaScript/TypeScript module formats
		{
			path: path.join(projectRoot, "blogforge.config.ts"),
			loader: tryLoadModuleConfig,
		},
		{
			path: path.join(projectRoot, "blogforge.config.js"),
			loader: tryLoadModuleConfig,
		},
		{
			path: path.join(projectRoot, "blogforge.config.mjs"),
			loader: tryLoadModuleConfig,
		},
		{
			path: path.join(projectRoot, "blogforge.config.cjs"),
			loader: tryLoadModuleConfig,
		},

		// JSON format
		{
			path: path.join(projectRoot, "blogforge.config.json"),
			loader: tryLoadJsonConfig,
		},

		// Nuxt convention
		{
			path: path.join(projectRoot, "blogforge.config"),
			loader: tryLoadModuleConfig,
		},

		// Package.json blogForge field
		{
			path: path.join(projectRoot, "package.json"),
			loader: async (filePath: string, loaderVerbose?: boolean) => {
				const json = await tryLoadJsonConfig(filePath, loaderVerbose);
				return json?.blogForge || null;
			},
		},
	];

	// Try each config file in order until one works
	for (const configFile of configFiles) {
		const userConfig = await configFile.loader(configFile.path, verbose);
		if (userConfig) {
			logger.verbose(`Loaded configuration from ${configFile.path}`, !!verbose);

			// Validate the config
			const result = configSchema.safeParse(userConfig);

			if (!result.success) {
				logger.warning("Invalid configuration. Using defaults.");
				logger.verbose(result.error.message, !!verbose);
				return { ...defaultConfig, root: projectRoot };
			}

			// Merge with defaults
			return mergeConfig({ ...defaultConfig, root: projectRoot }, userConfig);
		}
	}

	// No config found, use defaults
	logger.verbose("No configuration file found. Using defaults.", !!verbose);
	return { ...defaultConfig, root: projectRoot };
}

/**
 * Deep merge configuration objects
 */
export function mergeConfig(
	defaultConfig: BlogForgeConfig,
	userConfig: Partial<BlogForgeConfig>,
): BlogForgeConfig {
	const result = { ...defaultConfig };

	// Set root if provided
	if (userConfig.root) {
		result.root = userConfig.root;
	}

	// Merge directories
	if (userConfig.directories) {
		result.directories = {
			...defaultConfig.directories,
			...userConfig.directories,
		};
	}

	// Merge multilingual settings
	if (userConfig.multilingual !== undefined) {
		result.multilingual = userConfig.multilingual;
	}

	if (userConfig.languages) {
		result.languages = userConfig.languages;
	}

	if (userConfig.defaultLanguage) {
		result.defaultLanguage = userConfig.defaultLanguage;
	}

	// Merge schema extensions
	if (userConfig.schemaExtensions) {
		result.schemaExtensions = {
			article: {
				...defaultConfig.schemaExtensions.article,
				...userConfig.schemaExtensions.article,
			},
			author: {
				...defaultConfig.schemaExtensions.author,
				...userConfig.schemaExtensions.author,
			},
			category: {
				...defaultConfig.schemaExtensions.category,
				...userConfig.schemaExtensions.category,
			},
		};
	}

	// Merge default values
	if (userConfig.defaultValues) {
		result.defaultValues = {
			article: {
				...defaultConfig.defaultValues.article,
				...userConfig.defaultValues.article,
			},
			author: {
				...defaultConfig.defaultValues.author,
				...userConfig.defaultValues.author,
			},
			category: {
				...defaultConfig.defaultValues.category,
				...userConfig.defaultValues.category,
			},
		};
	}

	return result;
}
