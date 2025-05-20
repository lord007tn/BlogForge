import path from "node:path";
import chalk from "chalk";
import fs from "fs-extra";
import semver from "semver";
import { NUXT_CONTENT_MIN_VERSION } from "../constants";
import {
	type Article,
	type Author,
	type Category,
	articleSchema,
	authorSchema,
	categorySchema,
} from "../schemas"; // Added Author and authorSchema
import { type BlogForgeConfig, loadConfig } from "./config";
import { extractFrontmatter } from "./frontmatter";
import { logger } from "./logger";

export interface ProjectPaths {
	root: string;
	content: string;
	articles: string;
	authors: string;
	categories: string;
	public: string;
	assets: string;
	images: string;
	config: BlogForgeConfig;
}

export const NUXT_MIN_VERSION = "^3.0.0"; // Enforce Nuxt v3 or higher

/**
 * Enhanced project detection that supports custom content structures
 * @param startDir Directory to start searching from
 * @returns Project paths and configuration or throws an error
 */
export async function verifyNuxtContentProject(
	startDir: string,
): Promise<ProjectPaths> {
	// Find the project root (where content.config.ts or nuxt.config.ts is located)
	const projectRoot = await findProjectRoot(startDir);

	if (!projectRoot) {
		throw new Error(
			"This does not appear to be a Nuxt project. Could not find nuxt.config.ts or content.config.ts.",
		);
	}

	// Load configuration
	const config = await loadConfig(projectRoot);

	// Check for content/ directory
	const contentDir = path.join(projectRoot, "content");
	if (!(await fs.pathExists(contentDir))) {
		throw new Error(
			"Content directory not found. This doesn't appear to be a Nuxt Content project.",
		);
	}

	// Try to verify Nuxt Content v3 by checking package.json
	try {
		const pkgPath = path.join(projectRoot, "package.json");
		if (await fs.pathExists(pkgPath)) {
			const pkg = await fs.readJson(pkgPath);
			// Nuxt version check
			const nuxtVersion = pkg.dependencies?.nuxt || pkg.devDependencies?.nuxt;
			if (!nuxtVersion) {
				throw new Error(
					"Nuxt is not found in dependencies. Nuxt v3 is required.",
				);
			}
			const minVersion = semver.minVersion(nuxtVersion);
			if (!minVersion || !semver.satisfies(minVersion, NUXT_MIN_VERSION)) {
				throw new Error(
					`Nuxt version ${nuxtVersion} found, but v3.x is required. Please install nuxt@^3.0.0.`,
				);
			}
			// Nuxt Content version check
			const nuxtContentVersion =
				pkg.dependencies?.["@nuxt/content"] ||
				pkg.devDependencies?.["@nuxt/content"];
			if (!nuxtContentVersion) {
				throw new Error(
					"@nuxt/content is not found in dependencies. Nuxt Content v3 is required.",
				);
			}
			const minContentVersion = semver.minVersion(nuxtContentVersion);
			if (
				!minContentVersion ||
				!semver.satisfies(minContentVersion, NUXT_CONTENT_MIN_VERSION)
			) {
				throw new Error(
					`@nuxt/content version ${nuxtContentVersion} found, but v3.x is required. Please install @nuxt/content@^3.0.0.`,
				);
			}
		}
	} catch (error) {
		throw new Error(
			`Could not verify Nuxt or @nuxt/content version in package.json: ${
				(error as Error).message
			}`,
		);
	}

	// Get paths from configuration
	const articlesDir = path.join(contentDir, config.directories.articles);
	const authorsDir = path.join(contentDir, config.directories.authors);
	const categoriesDir = path.join(contentDir, config.directories.categories);
	const imagesDir = path.join(projectRoot, "public", config.directories.images);

	// Create content directories if they don't exist
	for (const dir of [articlesDir, authorsDir, categoriesDir]) {
		if (!(await fs.pathExists(dir))) {
			await fs.mkdirp(dir);
			logger.info(`Created directory: ${path.relative(process.cwd(), dir)}`);
		}
	}

	// For images, ensure path in public exists
	if (!(await fs.pathExists(imagesDir))) {
		await fs.mkdirp(imagesDir);
		logger.info(
			`Created directory: ${path.relative(process.cwd(), imagesDir)}`,
		);
	}

	return {
		root: projectRoot,
		content: contentDir,
		articles: articlesDir,
		authors: authorsDir,
		categories: categoriesDir,
		images: imagesDir,
		public: path.join(projectRoot, "public"),
		assets: path.join(projectRoot, "assets"),
		config,
	};
}

/**
 * Recursively search upwards from startDir to find the Nuxt project root
 * @param startDir Directory to start searching from
 * @returns Project root path or null if not found
 */
export async function findProjectRoot(
	startDir: string,
): Promise<string | null> {
	let dir = startDir;

	// Maximum depth to prevent infinite loops
	const MAX_DEPTH = 10;
	let depth = 0;

	while (depth < MAX_DEPTH) {
		// Check for configuration files in this order:
		// 1. blogforge.config.js (our own config)
		// 2. content.config.ts (Nuxt Content specific config)
		// 3. nuxt.config.ts (General Nuxt config)
		// 4. nuxt.config.js (Alternative format)

		const configFiles = [
			"blogforge.config.js",
			"content.config.ts",
			"nuxt.config.ts",
			"nuxt.config.js",
		];

		for (const configFile of configFiles) {
			const configPath = path.join(dir, configFile);
			if (await fs.pathExists(configPath)) {
				return dir;
			}
		}

		// Move up one directory
		const parentDir = path.dirname(dir);
		if (parentDir === dir) {
			// We've reached the root of the filesystem
			break;
		}

		dir = parentDir;
		depth++;
	}

	return null;
}

/**
 * Get project paths with validation and configuration
 */
export async function getProjectPaths(cwd: string): Promise<ProjectPaths> {
	try {
		return await verifyNuxtContentProject(cwd);
	} catch (error) {
		throw new Error(`Project validation failed: ${(error as Error).message}`);
	}
}

/**
 * Reads all markdown files from a directory, parses their frontmatter,
 * and validates them against a Zod schema.
 * @param dirPath Path to the directory
 * @param schema Zod schema for validation
 * @returns Array of parsed and validated frontmatter objects
 */
async function getAllContent<T>(
	dirPath: string,
	schema: Zod.Schema<T>,
): Promise<T[]> {
	if (!(await fs.pathExists(dirPath))) {
		logger.warning(`Directory not found: ${dirPath}. Returning empty array.`);
		return [];
	}
	const files = await fs.readdir(dirPath);
	const contentItems: T[] = [];

	for (const file of files) {
		if (path.extname(file) === ".md") {
			const filePath = path.join(dirPath, file);
			try {
				const fileContent = await fs.readFile(filePath, "utf-8");
				const { frontmatter } = extractFrontmatter(fileContent);
				const validatedFrontmatter = schema.parse(frontmatter);
				contentItems.push(validatedFrontmatter);
			} catch (err) {
				// Corrected logger call and error handling
				const errorMessage = err instanceof Error ? err.message : String(err);
				logger.error(`Error processing file ${file}: ${errorMessage}`);
			}
		}
	}
	return contentItems;
}

/**
 * Get all categories from the project
 * @returns Array of Category objects
 */
export async function getAllCategories(): Promise<Category[]> {
	const paths = await getProjectPaths(process.cwd());
	return getAllContent<Category>(paths.categories, categorySchema);
}

/**
 * Get all articles from the project
 * @returns Array of Article objects
 */
export async function getAllArticles(): Promise<Article[]> {
	const paths = await getProjectPaths(process.cwd());
	return getAllContent<Article>(paths.articles, articleSchema);
}

/**
 * Get all authors from the project
 * @returns Array of Author objects
 */
export async function getAllAuthors(): Promise<Author[]> {
	const paths = await getProjectPaths(process.cwd());
	return getAllContent<Author>(paths.authors, authorSchema);
}
