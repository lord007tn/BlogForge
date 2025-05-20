import path from "node:path";
import fs from "fs-extra";
import { z } from "zod";
import type { BlogForgeConfig } from "../utils/config";
import { logger } from "../utils/logger";

/**
 * Try to extract schemas from content.config.ts
 */
export async function extractUserSchemas(
	projectRoot: string,
): Promise<Record<string, any>> {
	const contentConfigPath = path.join(projectRoot, "content.config.ts");

	if (!(await fs.pathExists(contentConfigPath))) {
		logger.verbose(
			"No content.config.ts found. Using base schemas only.",
			true,
		);
		return {};
	}

	try {
		// Read content.config.ts file
		const content = await fs.readFile(contentConfigPath, "utf-8");

		// Extract schema definitions using regex
		// This is a simple approach - a proper parser would be better but more complex
		const schemas: Record<string, any> = {};

		// Look for defineDocumentType patterns
		const docTypeRegex =
			/defineDocumentType\(\s*\(\s*\)\s*=>\s*\(\s*{\s*name:\s*['"]([^'"]+)['"],[\s\S]*?fields:\s*{([\s\S]*?)}\s*,/g;
		let match: RegExpExecArray | null;
		while (true) {
			match = docTypeRegex.exec(content);
			if (match === null) break;
			const typeName = match[1];
			const fieldsContent = match[2];

			// Extract field definitions
			const fields: Record<string, any> = {};
			const fieldRegex = /([a-zA-Z0-9_]+):\s*{([\s\S]*?)},?/g;
			let fieldMatch: RegExpExecArray | null;
			while (true) {
				fieldMatch = fieldRegex.exec(fieldsContent);
				if (fieldMatch === null) break;
				const fieldName = fieldMatch[1];
				const fieldContent = fieldMatch[2];

				// Determine field type
				let fieldType = "string";
				if (fieldContent.includes('type: "string"')) fieldType = "string";
				else if (fieldContent.includes('type: "date"')) fieldType = "date";
				else if (fieldContent.includes('type: "number"')) fieldType = "number";
				else if (fieldContent.includes('type: "boolean"'))
					fieldType = "boolean";
				else if (fieldContent.includes('type: "json"')) fieldType = "json";
				else if (fieldContent.includes('type: "nested"')) fieldType = "nested";
				else if (fieldContent.includes('type: "list"')) fieldType = "list";
				else if (fieldContent.includes('type: "markdown"'))
					fieldType = "markdown";
				else if (fieldContent.includes('type: "reference"'))
					fieldType = "reference";
				else if (fieldContent.includes('type: "enum"')) fieldType = "enum";

				// Determine if required
				const isRequired = fieldContent.includes("required: true");

				// Determine if multilingual
				const isMultilingual =
					fieldContent.includes("type: 'markdown'") ||
					fieldContent.includes("localized: true");

				fields[fieldName] = {
					type: fieldType,
					required: isRequired,
					multilingual: isMultilingual,
				};
			}

			schemas[typeName] = { fields };
		}

		logger.verbose(
			`Extracted ${Object.keys(schemas).length} schemas from content.config.ts`,
			true,
		);
		return schemas;
	} catch (error) {
		logger.warning(
			`Error parsing content.config.ts: ${(error as Error).message}`,
		);
		return {};
	}
}

/**
 * Create a multilingual schema based on configured languages
 */
export function createMultilingualSchema(config: BlogForgeConfig): z.ZodType {
	if (!config.multilingual) {
		// If multilingual is disabled, just use a string
		return z.string();
	}

	// Build an object with keys for each supported language
	const shape: Record<string, z.ZodType> = {};

	for (const lang of config.languages) {
		shape[lang] = z.string().optional();
	}

	// Create the schema with validation to ensure at least one language is provided
	return z.union([
		z.string(),
		z.object(shape).refine((obj) => Object.keys(obj).length > 0, {
			message: "At least one language must be provided",
		}),
	]);
}

/**
 * Create Zod type from field definition
 */
function createZodTypeForField(field: any, config: BlogForgeConfig): z.ZodType {
	let baseType: z.ZodType;

	switch (field.type) {
		case "string":
			baseType = z.string();
			break;
		case "number":
			baseType = z.number();
			break;
		case "boolean":
			baseType = z.boolean();
			break;
		case "date":
			baseType = z.string(); // Dates are usually stored as strings
			break;
		case "json":
			baseType = z.record(z.any());
			break;
		case "list":
			baseType = z.array(z.any());
			break;
		case "enum":
			baseType = z.string(); // Without values, we default to string
			break;
		case "reference":
			baseType = z.string(); // References are stored as string IDs
			break;
		case "markdown":
		case "nested":
			if (field.multilingual) {
				baseType = createMultilingualSchema(config);
			} else {
				baseType = z.string();
			}
			break;
		default:
			baseType = z.any();
	}

	// Make optional if not required
	if (!field.required) {
		baseType = baseType.optional();
	}

	return baseType;
}

/**
 * Create article schema with configuration applied
 * Merges base schema with user-defined schema from content.config.ts
 */
export function createArticleSchema(
	config: BlogForgeConfig,
	userSchemas: Record<string, any> = {},
): z.ZodType {
	const multilingualText = createMultilingualSchema(config);

	// Start with the base schema (required fields)
	const baseSchema = z.object({
		title: multilingualText,
		description: multilingualText,
		author: z.string(),
		tags: z.array(z.string()).default([]),
		locale: z.string().default(config.defaultLanguage),
		idDraft: z.boolean().default(config.defaultValues.article?.isDraft ?? true),
		slug: z.string(),
	});

	// Add standard optional fields
	const standardExtensions = z.object({
		category: z.string().optional(),
		image: z.string().optional(),
		readingTime: z.number().optional(),
		isFeatured: z.boolean().default(false),
		publishedAt: z.string().optional(),
		updatedAt: z.string().optional(),
		canonicalURL: z.string().optional(),
		keywords: z.string().optional(),
	});

	// Merge with user schema if available
	let mergedSchema = baseSchema.merge(standardExtensions);

	// Check for user-defined article schema from content.config.ts
	const userArticleSchema =
		userSchemas.article || userSchemas.post || userSchemas.blogPost;

	if (userArticleSchema?.fields) {
		const userFields: Record<string, z.ZodType> = {};

		for (const [fieldName, fieldDef] of Object.entries(
			userArticleSchema.fields,
		)) {
			// Skip fields already in base schema to avoid conflicts
			if (
				![
					"title",
					"description",
					"author",
					"tags",
					"locale",
					"idDraft",
					"slug",
					"category",
					"image",
					"readingTime",
					"isFeatured",
					"publishedAt",
					"updatedAt",
					"canonicalURL",
					"keywords",
				].includes(fieldName)
			) {
				userFields[fieldName] = createZodTypeForField(fieldDef, config);
			}
		}

		if (Object.keys(userFields).length > 0) {
			const userExtensions = z.object(userFields);
			mergedSchema = mergedSchema.merge(userExtensions);
		}
	}

	// Merge with config-defined schema extensions if any
	if (
		config.schemaExtensions.article &&
		Object.keys(config.schemaExtensions.article).length > 0
	) {
		const configExtensionsObj: Record<string, z.ZodType> = {};

		// Create Zod types for each extension
		for (const [key, value] of Object.entries(
			config.schemaExtensions.article,
		)) {
			// Simple type mapping
			if (typeof value === "string") {
				configExtensionsObj[key] = z.string().optional();
			} else if (typeof value === "number") {
				configExtensionsObj[key] = z.number().optional();
			} else if (typeof value === "boolean") {
				configExtensionsObj[key] = z.boolean().optional();
			} else if (Array.isArray(value)) {
				configExtensionsObj[key] = z.array(z.any()).optional();
			} else if (value === null) {
				configExtensionsObj[key] = z.null().optional();
			} else {
				configExtensionsObj[key] = z.any().optional();
			}
		}

		const configExtensions = z.object(configExtensionsObj);
		mergedSchema = mergedSchema.merge(configExtensions);
	}

	return mergedSchema;
}

/**
 * Create author schema with configuration applied
 */
export function createAuthorSchema(
	config: BlogForgeConfig,
	userSchemas: Record<string, any> = {},
): z.ZodType {
	const multilingualText = createMultilingualSchema(config);

	// Start with the base schema
	const baseSchema = z.object({
		slug: z.string(),
		name: multilingualText,
		bio: multilingualText,
		avatar: z.string().optional(),
		twitter: z.string().optional(),
		github: z.string().optional(),
		website: z.string().optional(),
		linkedin: z.string().optional(),
		role: multilingualText.optional(),
	});

	// Merge with user schema if available
	let mergedSchema = baseSchema;

	// Check for user-defined author schema
	const userAuthorSchema = userSchemas.author || userSchemas.authors;

	if (userAuthorSchema?.fields) {
		const userFields: Record<string, z.ZodType> = {};

		for (const [fieldName, fieldDef] of Object.entries(
			userAuthorSchema.fields,
		)) {
			// Skip fields already in base schema
			if (
				![
					"slug",
					"name",
					"bio",
					"avatar",
					"twitter",
					"github",
					"website",
					"linkedin",
					"role",
				].includes(fieldName)
			) {
				userFields[fieldName] = createZodTypeForField(fieldDef, config);
			}
		}

		if (Object.keys(userFields).length > 0) {
			const userExtensions = z.object(userFields);
			mergedSchema = mergedSchema.merge(userExtensions);
		}
	}

	// Merge with config extensions
	if (
		config.schemaExtensions.author &&
		Object.keys(config.schemaExtensions.author).length > 0
	) {
		const configExtensionsObj: Record<string, z.ZodType> = {};

		for (const [key, value] of Object.entries(config.schemaExtensions.author)) {
			if (typeof value === "string") {
				configExtensionsObj[key] = z.string().optional();
			} else if (typeof value === "number") {
				configExtensionsObj[key] = z.number().optional();
			} else if (typeof value === "boolean") {
				configExtensionsObj[key] = z.boolean().optional();
			} else if (Array.isArray(value)) {
				configExtensionsObj[key] = z.array(z.any()).optional();
			} else if (value === null) {
				configExtensionsObj[key] = z.null().optional();
			} else {
				configExtensionsObj[key] = z.any().optional();
			}
		}

		const configExtensions = z.object(configExtensionsObj);
		mergedSchema = mergedSchema.merge(configExtensions);
	}

	return mergedSchema;
}

/**
 * Create category schema with configuration applied
 */
export function createCategorySchema(
	config: BlogForgeConfig,
	userSchemas: Record<string, any> = {},
): z.ZodType {
	const multilingualText = createMultilingualSchema(config);

	// Start with the base schema
	const baseSchema = z.object({
		title: multilingualText,
		description: multilingualText,
		slug: z.string(),
		image: z.string().optional(),
		icon: z.string().optional(),
	});

	// Merge with user schema if available
	let mergedSchema = baseSchema;

	// Check for user-defined category schema
	const userCategorySchema =
		userSchemas.category ||
		userSchemas.categories ||
		userSchemas.topic ||
		userSchemas.topics;

	if (userCategorySchema?.fields) {
		const userFields: Record<string, z.ZodType> = {};

		for (const [fieldName, fieldDef] of Object.entries(
			userCategorySchema.fields,
		)) {
			// Skip fields already in base schema
			if (
				!["title", "description", "slug", "image", "icon"].includes(fieldName)
			) {
				userFields[fieldName] = createZodTypeForField(fieldDef, config);
			}
		}

		if (Object.keys(userFields).length > 0) {
			const userExtensions = z.object(userFields);
			mergedSchema = mergedSchema.merge(userExtensions);
		}
	}

	// Merge with config extensions
	if (
		config.schemaExtensions.category &&
		Object.keys(config.schemaExtensions.category).length > 0
	) {
		const configExtensionsObj: Record<string, z.ZodType> = {};

		for (const [key, value] of Object.entries(
			config.schemaExtensions.category,
		)) {
			if (typeof value === "string") {
				configExtensionsObj[key] = z.string().optional();
			} else if (typeof value === "number") {
				configExtensionsObj[key] = z.number().optional();
			} else if (typeof value === "boolean") {
				configExtensionsObj[key] = z.boolean().optional();
			} else if (Array.isArray(value)) {
				configExtensionsObj[key] = z.array(z.any()).optional();
			} else if (value === null) {
				configExtensionsObj[key] = z.null().optional();
			} else {
				configExtensionsObj[key] = z.any().optional();
			}
		}

		const configExtensions = z.object(configExtensionsObj);
		mergedSchema = mergedSchema.merge(configExtensions);
	}

	return mergedSchema;
}

/**
 * Initialize all schemas based on config and user schemas
 */
export async function initializeSchemas(config: BlogForgeConfig): Promise<{
	articleSchema: z.ZodType;
	authorSchema: z.ZodType;
	categorySchema: z.ZodType;
}> {
	// Try to extract user-defined schemas from content.config.ts
	const userSchemas = await extractUserSchemas(config.root || process.cwd());

	const articleSchema = createArticleSchema(config, userSchemas);
	const authorSchema = createAuthorSchema(config, userSchemas);
	const categorySchema = createCategorySchema(config, userSchemas);

	return {
		articleSchema,
		authorSchema,
		categorySchema,
	};
}

// Utility functions for multilingual text handling
/**
 * Normalize text to multilingual format based on configuration
 */
export function normalizeMultilingualText(
	value: any,
	config: BlogForgeConfig,
	locale?: string,
): any {
	const defaultLocale = locale || config.defaultLanguage;

	if (!value) return config.multilingual ? { [defaultLocale]: "" } : "";

	// If not using multilingual or value is already formatted correctly
	if (!config.multilingual) {
		return typeof value === "string"
			? value
			: typeof value === "object"
				? value[defaultLocale] || Object.values(value)[0] || ""
				: String(value);
	}

	// If it's already an object with locales
	if (typeof value === "object" && value !== null) {
		// Check if it has any language keys
		const hasLanguageKeys = config.languages.some((lang) => lang in value);
		if (hasLanguageKeys) {
			return value;
		}
		// Not a multilingual object
		return { [defaultLocale]: String(Object.values(value)[0] || "") };
	}

	// If it's a string, convert to object with default locale
	if (typeof value === "string") {
		return { [defaultLocale]: value };
	}

	return { [defaultLocale]: String(value) };
}

/**
 * Extract text for the specified locale based on configuration
 */
export function getTextForLocale(
	text: any,
	config: BlogForgeConfig,
	locale?: string,
): string {
	const defaultLocale = locale || config.defaultLanguage;

	if (!text) return "";

	// If it's a simple string, just return it
	if (typeof text === "string") {
		return text;
	}

	// If it's a multilingual object
	if (typeof text === "object" && text !== null) {
		// Try requested locale, then default locale, then first value
		return (
			text[defaultLocale] ||
			text[config.defaultLanguage] ||
			(config.languages.find((lang) => text[lang])
				? text[config.languages.find((lang) => text[lang]) as string]
				: "") ||
			Object.values(text)[0] ||
			""
		);
	}

	return String(text);
}
