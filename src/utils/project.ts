import path from "node:path";
// import chalk from "chalk"; // Removed unused import
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
} from "../schemas";
import { type BlogForgeConfig, loadConfig } from "./config";
import { extractFrontmatter } from "./frontmatter";
import { logger } from "./logger";

// Added to parse TypeScript configuration files
import { parse } from "jsonc-parser";
import { ScriptTarget, transpileModule, ModuleKind } from "typescript";

// Define a more specific type for source entries from config
interface ConfigSourceEntry {
	driver: string;
	basePath?: string;
	name?: string; // Optional name property within the source object itself
	// biome-ignore lint/suspicious/noExplicitAny: Flexible for various driver options
	[key: string]: any;
}

export interface ContentSource {
	name: string;
	driver: string; // e.g., 'fs', 'git', 'http'
	basePath?: string; // For local sources
	// Add other relevant properties for remote sources, e.g., repo, branch, etc.
	// biome-ignore lint/suspicious/noExplicitAny: Flexible for various driver options
	[key: string]: any;
}
export interface ProjectPaths {
	root: string;
	content?: string; // Optional if all sources are remote
	articles: string | null; // Can be null if remote
	authors: string | null; // Can be null if remote
	categories: string | null; // Can be null if remote
	public: string;
	assets: string;
	images: string | null; // Can be null if remote
	config: BlogForgeConfig;
	hasRemoteSources: boolean;
	contentSources: ContentSource[];
}

export const NUXT_MIN_VERSION_CONST = "^3.0.0"; // Renamed to avoid conflict

async function readAndParseTsConfig<T>(filePath: string): Promise<T | null> {
	if (!(await fs.pathExists(filePath))) {
		return null;
	}
	try {
		const fileContent = await fs.readFile(filePath, "utf-8");
		// Basic transpilation to handle ES Modules and TypeScript syntax
		const jsContent = transpileModule(fileContent, {
			compilerOptions: {
				target: ScriptTarget.ESNext,
				module: ModuleKind.ESNext, // Corrected ModuleKind
			},
		}).outputText;

		// Extract the default export object
		let configObjectString: string | undefined;

		// Pattern 1: export default defineNuxtConfig({ ... }) or defineContentConfig({ ... })
		// Regex captures the object literal directly.
		let match =
			/export default (?:defineNuxtConfig|defineContentConfig)\s*\(\s*(\{[\s\S]*?\})\s*\)\s*;?/m.exec(
				jsContent,
			);
		if (match?.[1]) {
			configObjectString = match[1];
		} else {
			// Pattern 2: export default { ... } (direct object export)
			match = /export default\s*(\{[\s\S]*?\})\s*;?/m.exec(jsContent);
			if (match?.[1]) {
				configObjectString = match[1];
			} else {
				// Pattern 3: export default defineNuxtConfig(() => ({ ... })) or defineContentConfig(() => ({ ... }))
				// Captures the object literal returned by the arrow function (immediate return).
				match =
					/export default (?:defineNuxtConfig|defineContentConfig)\s*\(\s*\(\s*\)\s*=>\s*\(?(\{[\s\S]*?\})\)?\s*\)\s*;?/m.exec(
						jsContent,
					);
				if (match?.[1]) {
					configObjectString = match[1];
				} else {
					// Pattern 4: export default () => ({ ... })
					// Captures the object literal returned by the arrow function (immediate return).
					match =
						/export default \s*\(\s*\)\s*=>\s*\(?(\{[\s\S]*?\})\)?\s*;?/m.exec(
							jsContent,
						);
					if (match?.[1]) {
						configObjectString = match[1];
					} else {
						// Fallback to the original more general regex, corrected to use match[1].
						// This might capture function bodies or other non-JSON content,
						// so the parse attempt below needs to be robust.
						match =
							/export default (?:defineNuxtConfig|defineContentConfig)\s*\(([\s\S]*?)\)\s*;?/m.exec(
								jsContent,
							);
						if (match?.[1]) {
							configObjectString = match[1];
						}
					}
				}
			}
		}

		if (configObjectString) {
			try {
				// Attempt to parse. If configObjectString is actually a function string like "() => ({...})",
				// jsonc-parser will fail, which is caught.
				return parse(configObjectString) as T;
			} catch (e) {
				logger.error(
					`Error parsing extracted config string from ${path.basename(filePath)}: ${(e as Error).message}`,
				);
				// Log the string that failed to parse for debugging, truncated if too long
				const problematicString =
					configObjectString.length > 200
						? `${configObjectString.substring(0, 200)}...`
						: configObjectString;
				logger.info(`Problematic string for parsing: ${problematicString}`);
				return null;
			}
		}

		logger.info(
			`Could not parse default export from ${path.basename(filePath)}. Ensure it exports a configuration object directly or using defineNuxtConfig/defineContentConfig, e.g., 'export default { ... }' or 'export default defineNuxtConfig({ ... })'. Arrow function exports like '() => ({...})' are also supported for simple object returns.`,
		);
		return null;
	} catch (error) {
		logger.error(
			`Error reading or parsing ${filePath}: ${(error as Error).message}`,
		);
		return null;
	}
}

/**
 * Recursively search upwards from startDir to find the Nuxt project root
 * @param startDir Directory to start searching from
 * @returns Project root path or null if not found
 */
export async function findProjectRoot(
	startDir: string,
): Promise<string | null> {
	let currentDir = startDir; // Renamed to avoid conflict with global 'dir'

	// Maximum depth to prevent infinite loops
	const MAX_DEPTH = 10;
	let currentDepth = 0; // Renamed to avoid conflict

	while (currentDepth < MAX_DEPTH) {
		// Check for configuration files in this order:
		// 1. blogforge.config.ts (our own config)
		// 2. blogforge.config.js
		// 3. content.config.ts (Nuxt Content specific config)
		// 4. content.config.js
		// 5. nuxt.config.ts (General Nuxt config)
		// 6. nuxt.config.js (Alternative format)

		const configFiles = [
			"blogforge.config.ts",
			"blogforge.config.js",
			"content.config.ts",
			"content.config.js",
			"nuxt.config.ts",
			"nuxt.config.js",
		];

		for (const configFile of configFiles) {
			const configPath = path.join(currentDir, configFile);
			if (await fs.pathExists(configPath)) {
				return currentDir;
			}
		}

		// Move up one directory
		const parentDir = path.dirname(currentDir);
		if (parentDir === currentDir) {
			// We've reached the root of the filesystem
			break;
		}

		currentDir = parentDir;
		currentDepth++;
	}

	return null;
}

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
	let hasRemoteSources = false;
	const contentSources: ContentSource[] = [];

	// 1. Detect content source configuration from nuxt.config.ts and content.config.ts
	const nuxtConfigPath = path.join(projectRoot, "nuxt.config.ts");
	const contentConfigPath = path.join(projectRoot, "content.config.ts");

	// biome-ignore lint/suspicious/noExplicitAny: Parsing unknown config structure
	const nuxtConfig = await readAndParseTsConfig<any>(nuxtConfigPath);
	// biome-ignore lint/suspicious/noExplicitAny: Parsing unknown config structure
	const contentConfig = await readAndParseTsConfig<any>(contentConfigPath);

	const processSources = (
		sourcesObject: Record<string, ConfigSourceEntry | string> | undefined,
		sourceNamePrefix = "",
	) => {
		if (!sourcesObject) return;
		for (const key in sourcesObject) {
			const sourceEntry = sourcesObject[key];
			const name = sourceNamePrefix
				? `${sourceNamePrefix}_${key}`
				: (typeof sourceEntry === "object" && sourceEntry.name) || key;

			if (typeof sourceEntry === "object" && sourceEntry.driver) {
				const {
					name: _name,
					driver,
					basePath,
					...restOfSourceEntry
				} = sourceEntry; // Destructure to separate known and rest
				const newSource: ContentSource = {
					name,
					driver,
					basePath,
					...restOfSourceEntry, // Spread remaining properties
				};
				if (
					!contentSources.find(
						(cs) =>
							cs.name === newSource.name &&
							JSON.stringify(cs) === JSON.stringify(newSource),
					)
				) {
					contentSources.push(newSource);
				}
				if (sourceEntry.driver !== "fs") {
					hasRemoteSources = true;
				}
			} else if (typeof sourceEntry === "string") {
				// e.g., sources: { foo: './some/path' }
				const newSource: ContentSource = {
					name,
					driver: "fs",
					basePath: sourceEntry,
				};
				if (
					!contentSources.find(
						(cs) =>
							cs.name === newSource.name &&
							cs.driver === "fs" &&
							cs.basePath === newSource.basePath,
					)
				) {
					contentSources.push(newSource);
				}
			}
		}
	};

	if (nuxtConfig?.content?.sources) {
		processSources(
			nuxtConfig.content.sources as Record<string, ConfigSourceEntry | string>,
		);
	}
	if (contentConfig?.sources) {
		processSources(
			contentConfig.sources as Record<string, ConfigSourceEntry | string>,
		);
	}
	if (
		contentConfig?.documentDriven?.sources &&
		Array.isArray(contentConfig.documentDriven.sources)
	) {
		contentConfig.documentDriven.sources.forEach(
			(sourceEntry: ConfigSourceEntry | string, index: number) => {
				const name =
					(typeof sourceEntry === "object" && sourceEntry.name) ||
					`documentDriven_${index}`;

				if (typeof sourceEntry === "object" && sourceEntry.driver) {
					const {
						name: _name,
						driver,
						basePath,
						...restOfSourceEntry
					} = sourceEntry; // Destructure
					const newSource: ContentSource = {
						name,
						driver,
						basePath,
						...restOfSourceEntry, // Spread remaining properties
					};
					if (
						!contentSources.find(
							(cs) =>
								cs.name === newSource.name &&
								JSON.stringify(cs) === JSON.stringify(newSource),
						)
					) {
						contentSources.push(newSource);
					}
					if (sourceEntry.driver !== "fs") {
						hasRemoteSources = true;
					}
				} else if (typeof sourceEntry === "string") {
					// If source is a string path for documentDriven (less common but possible)
					const newSource: ContentSource = {
						name,
						driver: "fs",
						basePath: sourceEntry,
					};
					if (
						!contentSources.find(
							(cs) =>
								cs.name === newSource.name &&
								cs.driver === "fs" &&
								cs.basePath === newSource.basePath,
						)
					) {
						contentSources.push(newSource);
					}
				}
			},
		);
	}

	// Check for local content/ directory if no explicit 'fs' sources are defined or if it's a primary source
	const localContentDir = path.join(projectRoot, "content");
	const localContentDirExists = await fs.pathExists(localContentDir);

	if (
		!contentSources.some(
			(s) =>
				s.driver === "fs" && (s.basePath === "content" || s.basePath === "."),
		) &&
		localContentDirExists
	) {
		contentSources.push({
			name: "defaultLocal",
			driver: "fs",
			basePath: "content",
		});
	}

	if (
		!hasRemoteSources &&
		!localContentDirExists &&
		!contentSources.some((s) => s.driver === "fs")
	) {
		throw new Error(
			"No local 'content' directory found and no file system (fs) content sources defined. This doesn't appear to be a Nuxt Content project or it's misconfigured.",
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
				// Allow if no package.json, but warn if Nuxt not found
				logger.info(
					"Nuxt is not found in dependencies. Nuxt v3 is required for full compatibility.",
				);
			} else {
				const minVersion = semver.minVersion(nuxtVersion);
				if (
					!minVersion ||
					!semver.satisfies(minVersion, NUXT_MIN_VERSION_CONST)
				) {
					// Used renamed constant
					throw new Error(
						`Nuxt version ${nuxtVersion} found, but v3.x is required. Please install nuxt@^3.0.0.`,
					);
				}
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
		} else {
			logger.info(
				"package.json not found. Skipping Nuxt and Nuxt Content version checks.",
			);
		}
	} catch (error) {
		throw new Error(
			`Could not verify Nuxt or @nuxt/content version: ${
				(error as Error).message
			}`,
		);
	}

	// Determine base paths for articles, authors, categories, images
	// This needs to be more intelligent if content can come from multiple sources or a non-'content' fs source
	let articlesDir: string | null = null;
	let authorsDir: string | null = null;
	let categoriesDir: string | null = null;
	const imagesDir: string | null = path.join(
		projectRoot,
		"public",
		config.directories.images,
	); // Default images path

	const primaryFsSource = contentSources.find(
		(s) =>
			s.driver === "fs" &&
			(s.basePath === "content" ||
				s.name === "content" ||
				s.basePath === "" ||
				s.basePath === "/" ||
				s.basePath === "."),
	);

	if (primaryFsSource) {
		const basePath = primaryFsSource.basePath
			? path.join(projectRoot, primaryFsSource.basePath)
			: projectRoot;
		articlesDir = path.join(basePath, config.directories.articles);
		authorsDir = path.join(basePath, config.directories.authors);
		categoriesDir = path.join(basePath, config.directories.categories);
		// Create local content directories if they don't exist and we have a local fs source
		for (const dir of [articlesDir, authorsDir, categoriesDir]) {
			if (dir && !(await fs.pathExists(dir))) {
				await fs.mkdirp(dir);
				logger.info(`Created directory: ${path.relative(process.cwd(), dir)}`);
			}
		}
	} else if (hasRemoteSources) {
		logger.info(
			"Project primarily uses remote content sources. Local directory creation for articles, authors, categories will be skipped for these sources.",
		);
		// For remote sources, these paths might not be applicable locally or might be read-only representations.
		// Setting to null as a placeholder, actual handling will depend on command logic.
		articlesDir = null;
		authorsDir = null;
		categoriesDir = null;
	}

	// For images, ensure path in public exists, assuming images are always local for now
	if (imagesDir && !(await fs.pathExists(imagesDir))) {
		await fs.mkdirp(imagesDir);
		logger.info(
			`Created directory: ${path.relative(process.cwd(), imagesDir)}`,
		);
	}

	return {
		root: projectRoot,
		content: primaryFsSource?.basePath
			? path.join(projectRoot, primaryFsSource.basePath)
			: localContentDirExists
				? localContentDir
				: undefined,
		articles: articlesDir,
		authors: authorsDir,
		categories: categoriesDir,
		images: imagesDir, // Assuming images are still primarily local for now
		public: path.join(projectRoot, "public"),
		assets: path.join(projectRoot, "assets"),
		config,
		hasRemoteSources,
		contentSources,
	};
}

/**
 * Get project paths with validation and configuration
 */
export async function getProjectPaths(cwd: string): Promise<ProjectPaths> {
	try {
		return await verifyNuxtContentProject(cwd);
	} catch (error) {
		logger.error(`Project validation failed: ${(error as Error).message}`);
		// Provide a more user-friendly error or suggestion
		if (
			(error as Error).message.includes(
				"Could not find nuxt.config.ts or content.config.ts",
			)
		) {
			logger.info(
				"Ensure you are running this command from within a Nuxt 3 project directory.",
			);
		} else if (
			(error as Error).message.includes("Content directory not found") ||
			(error as Error).message.includes("No local 'content' directory found")
		) {
			logger.info(
				"If your project uses remote content sources exclusively, some CLI operations requiring local file access might be limited.",
			);
		}
		throw error; // Re-throw the original error after logging
	}
}

async function getAllContentItems<T>(
	directoryPath: string | null,
	// biome-ignore lint/suspicious/noExplicitAny: Generic schema validation
	schema: any,
	itemType: string,
	hasRemoteSources: boolean,
): Promise<T[]> {
	if (!directoryPath) {
		if (hasRemoteSources) {
			logger.info(
				`${itemType} are hosted remotely or the local path is not configured. Listing local ${itemType} will yield no results for these sources.`,
			);
			return [];
		}
		throw new Error(
			`${itemType} directory path is not defined. Check your project configuration.`,
		);
	}
	if (!(await fs.pathExists(directoryPath))) {
		logger.info(
			`${itemType} directory ${directoryPath} does not exist. No ${itemType} loaded.`,
		);
		return [];
	}

	const files = await fs.readdir(directoryPath);
	const contentFiles = files.filter(
		(file) =>
			file.endsWith(".md") ||
			file.endsWith(".json") ||
			file.endsWith(".yaml") ||
			file.endsWith(".yml"),
	);

	const contentItems: T[] = [];
	for (const file of contentFiles) {
		try {
			const filePath = path.join(directoryPath, file);
			const content = await fs.readFile(filePath, "utf-8");
			const frontmatter = extractFrontmatter(content);
			const parsed = schema.safeParse(frontmatter);
			if (parsed.success) {
				contentItems.push(parsed.data as T);
			} else {
				logger.error(
					`Invalid ${itemType} file ${file}: ${parsed.error.message}`,
				);
			}
		} catch (error) {
			logger.error(
				`Error reading ${itemType} file ${file}: ${(error as Error).message}`,
			);
		}
	}
	return contentItems;
}

export async function getAllCategories(): Promise<Category[]> {
	const paths = await getProjectPaths(process.cwd());
	return getAllContentItems<Category>(
		paths.categories,
		categorySchema,
		"Categories",
		paths.hasRemoteSources,
	);
}

export async function getAllArticles(): Promise<Article[]> {
	const paths = await getProjectPaths(process.cwd());
	return getAllContentItems<Article>(
		paths.articles,
		articleSchema,
		"Articles",
		paths.hasRemoteSources,
	);
}

export async function getAllAuthors(): Promise<Author[]> {
	const paths = await getProjectPaths(process.cwd());
	return getAllContentItems<Author>(
		paths.authors,
		authorSchema,
		"Authors",
		paths.hasRemoteSources,
	);
}
