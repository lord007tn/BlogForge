import type { z } from "zod";
import { defaultConfig } from "../utils/config";
import {
	createArticleSchema,
	createAuthorSchema,
	createCategorySchema,
	getTextForLocale as getTextForLocaleDynamic,
	normalizeMultilingualText as normalizeMultilingualTextDynamic,
} from "./dynamic";

// Create schemas with default configuration
const articleSchema = createArticleSchema(defaultConfig);
const authorSchema = createAuthorSchema(defaultConfig);
const categorySchema = createCategorySchema(defaultConfig);

// Keep backward compatibility with existing code
export { articleSchema, authorSchema, categorySchema };

// Export types based on the schemas
export type Article = z.infer<typeof articleSchema>;
export type Author = z.infer<typeof authorSchema>;
export type Category = z.infer<typeof categorySchema>;

// Utility functions with backward compatibility
export function normalizeMultilingualText(
	value: string | Record<string, string>,
	defaultLocale = "en",
): string | Record<string, string> {
	return normalizeMultilingualTextDynamic(value, defaultConfig, defaultLocale);
}

export function getTextForLocale(
	text: string | Record<string, string>,
	locale = "en",
): string {
	return getTextForLocaleDynamic(text, defaultConfig, locale);
}

// For new code, export the dynamic schema creators
export {
	createArticleSchema,
	createAuthorSchema,
	createCategorySchema,
} from "./dynamic";
