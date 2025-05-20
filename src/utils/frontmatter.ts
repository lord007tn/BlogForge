import yaml from "js-yaml";
import {
	getTextForLocale,
	normalizeMultilingualText,
} from "../schemas/dynamic";
import { defaultConfig } from "./config";

/**
 * Extracts YAML frontmatter and content from a markdown file string.
 * Returns { frontmatter, content, rawFrontmatter }.
 */
export function extractFrontmatter(md: string) {
	const match = md.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
	if (!match) return { frontmatter: {}, content: md, rawFrontmatter: "" };

	const rawFrontmatter = match[1];
	const content = md.slice(match[0].length);
	let frontmatter: Record<string, unknown> = {};

	try {
		const loaded = yaml.load(rawFrontmatter);
		frontmatter =
			typeof loaded === "object" && loaded !== null
				? (loaded as Record<string, unknown>)
				: {};
	} catch (e) {
		throw new Error(`Invalid YAML frontmatter: ${(e as Error).message}`);
	}

	return { frontmatter, content, rawFrontmatter };
}

/**
 * Updates the frontmatter in a markdown file string.
 * Returns the new markdown string.
 */
export function updateFrontmatter(
	md: string,
	newFrontmatter: Record<string, unknown>,
) {
	// Process multilingual fields based on their structure
	const processedFrontmatter = processFrontmatterFields(newFrontmatter);

	const yamlStr = yaml.dump(processedFrontmatter, {
		lineWidth: 1000,
		quotingType: '"', // Use double quotes for consistency
		forceQuotes: true, // Force quotes for string values to handle special characters
	});

	const match = md.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
	const content = match ? md.slice(match[0].length) : md;

	return `---
${yamlStr}---

${content.trim()}`;
}

/**
 * Checks if a value appears to be a multilingual object
 * (An object with language keys)
 */
function isMultilingualObject(value: unknown): boolean {
	if (typeof value !== "object" || value === null) {
		return false;
	}

	// Check if the object has at least one language key
	const obj = value as Record<string, unknown>;
	const config = defaultConfig;
	const hasLanguageKey = config.languages.some((lang) => lang in obj);

	// Also check if all keys are strings
	const allKeysAreStrings = Object.values(obj).every(
		(v) => typeof v === "string" || v === null || v === undefined,
	);

	return hasLanguageKey && allKeysAreStrings;
}

/**
 * Process frontmatter fields, detecting multilingual fields by structure
 */
function processFrontmatterFields(
	frontmatter: Record<string, unknown>,
): Record<string, unknown> {
	const processed: Record<string, unknown> = {};
	const config = defaultConfig;

	for (const [key, value] of Object.entries(frontmatter)) {
		// Detect if this field is already in multilingual format
		if (isMultilingualObject(value)) {
			// It's already multilingual, keep it as is
			processed[key] = value;
		} else if (config.multilingual) {
			// If the project uses multilingual, normalize the value
			processed[key] = normalizeMultilingualText(value, config);
		} else {
			// Not multilingual, keep as is
			processed[key] = value;
		}
	}

	return processed;
}

/**
 * Get front matter entry, handling both string and object formats
 * Automatically detects multilingual format based on value structure
 */
export function getFrontMatterEntry(
	frontmatter: Record<string, unknown>,
	key: string,
	locale = "en",
): string {
	const value = frontmatter[key];

	// If the value is not found
	if (value === undefined || value === null) {
		return "";
	}

	// If it's a string, return it directly
	if (typeof value === "string") {
		return value;
	}

	// If it looks like a multilingual object, extract the right language
	if (isMultilingualObject(value)) {
		return getTextForLocale(value, defaultConfig, locale);
	}

	// Otherwise, convert to string
	return String(value);
}
