import { defineCommand } from "citty";
import { createArticle } from "./create";
import { deleteArticle } from "./delete";
import { editArticle } from "./edit";
import { listArticles } from "./list";
import { publishArticle } from "./publish";
import { searchArticles } from "./search";
import { seoCheck } from "./seo-check";
import { statsArticles } from "./stats";
import { unpublishArticle } from "./unpublish";
import { validateArticles } from "./validate";

export default defineCommand({
	meta: { description: "Article management commands" },
	subCommands: {
		create: defineCommand({
			meta: { description: "Create a new article" },
			args: {
				title: {
					type: "string",
					description: "Article title (required)",
				},
				"title-ar": {
					type: "string",
					description: "Article title in Arabic",
				},
				"title-en": {
					type: "string",
					description: "Article title in English",
				},
				description: {
					type: "string",
					description: "Article description (required)",
				},
				"description-ar": {
					type: "string",
					description: "Article description in Arabic",
				},
				"description-en": {
					type: "string",
					description: "Article description in English",
				},
				author: {
					type: "string",
					description: "Author ID (required)",
				},
				tags: {
					type: "string",
					description: "Comma-separated tags (required)",
				},
				locale: {
					type: "string",
					description: "Locale (required)",
					default: "en",
				},
				isDraft: {
					type: "boolean",
					description: "Create as draft",
					default: true,
				},
				category: {
					type: "string",
					description: "Category slug",
				},
				image: {
					type: "string",
					description: "Image path or URL",
				},
				readingTime: {
					type: "string",
					description: "Reading time in minutes",
				},
				isFeatured: {
					type: "boolean",
					description: "Is featured article",
					default: false,
				},
				publishedAt: {
					type: "string",
					description: "Published date (YYYY-MM-DD)",
				},
				updatedAt: {
					type: "string",
					description: "Updated date (YYYY-MM-DD)",
				},
				canonicalURL: {
					type: "string",
					description: "Canonical URL",
				},
				slug: {
					type: "string",
					description: "Custom slug (defaults to generated from title)",
				},
				filename: {
					type: "string",
					description: "Custom filename (defaults to slug)",
				},
				content: {
					type: "string",
					description: "Initial article content",
				},
				verbose: {
					type: "boolean",
					description: "Enable verbose logging",
					default: false,
				},
			},
			run: async ({ args }) => {
				// Create multilingual object if both variants provided

				const title =
					args["title-ar"] || args["title-en"]
						? {
								ar: args["title-ar"] as string,
								en:
									typeof args["title-en"] === "string"
										? (args["title-en"] as string)
										: typeof args.title === "string"
											? args.title
											: "",
							}
						: typeof args.title === "string"
							? args.title
							: undefined;

				const description =
					args["description-ar"] || args["description-en"]
						? {
								ar: args["description-ar"] as string,
								en:
									typeof args["description-en"] === "string"
										? (args["description-en"] as string)
										: typeof args.description === "string"
											? args.description
											: "",
							}
						: typeof args.description === "string"
							? args.description
							: undefined;

				await createArticle({
					verbose: Boolean(args.verbose),
					title,
					description,
					author: args.author ? String(args.author) : undefined,
					tags: args.tags ? String(args.tags) : undefined,
					locale: args.locale ? String(args.locale) : undefined,
					isDraft: Boolean(args.isDraft),
					category: args.category ? String(args.category) : undefined,
					image: args.image ? String(args.image) : undefined,
					readingTime: args.readingTime ? Number(args.readingTime) : undefined,
					isFeatured: Boolean(args.isFeatured),
					publishedAt: args.publishedAt ? String(args.publishedAt) : undefined,
					updatedAt: args.updatedAt ? String(args.updatedAt) : undefined,
					canonicalURL: args.canonicalURL
						? String(args.canonicalURL)
						: undefined,
					slug: args.slug ? String(args.slug) : undefined,
					filename: args.filename ? String(args.filename) : undefined,
					content: args.content ? String(args.content) : undefined,
				});
			},
		}),

		edit: defineCommand({
			meta: { description: "Edit an existing article" },
			args: {
				file: {
					type: "string",
					description: "Article filename (e.g. my-article.md)",
				},
				title: {
					type: "string",
					description: "New article title",
				},
				"title-ar": {
					type: "string",
					description: "New article title in Arabic",
				},
				"title-en": {
					type: "string",
					description: "New article title in English",
				},
				description: {
					type: "string",
					description: "New article description",
				},
				"description-ar": {
					type: "string",
					description: "New article description in Arabic",
				},
				"description-en": {
					type: "string",
					description: "New article description in English",
				},
				author: {
					type: "string",
					description: "New author ID",
				},
				tags: {
					type: "string",
					description: "New comma-separated tags",
				},
				locale: {
					type: "string",
					description: "New locale",
				},
				isDraft: {
					type: "boolean",
					description: "Set draft status",
				},
				category: {
					type: "string",
					description: "New category slug",
				},
				image: {
					type: "string",
					description: "New image path or URL",
				},
				publishedAt: {
					type: "string",
					description: "New published date (YYYY-MM-DD)",
				},
				updatedAt: {
					type: "string",
					description: "New updated date (YYYY-MM-DD)",
				},
				interactive: {
					type: "boolean",
					description: "Enable interactive mode",
					default: true,
				},
				verbose: {
					type: "boolean",
					description: "Enable verbose logging",
					default: false,
				},
			},
			run: async ({ args }) => {
				// Create multilingual object if both variants provided
				const title =
					args["title-ar"] || args["title-en"]
						? {
								ar: args["title-ar"] as string,
								en: (args["title-en"] as string) || (args.title as string),
							}
						: args.title;

				const description =
					args["description-ar"] || args["description-en"]
						? {
								ar: args["description-ar"] as string,
								en:
									(args["description-en"] as string) ||
									(args.description as string),
							}
						: (args.description as string | undefined);

				await editArticle({
					verbose: Boolean(args.verbose),
					interactive: args.interactive !== false,
					file: args.file ? String(args.file) : undefined,
					title,
					description,
					author: args.author ? String(args.author) : undefined,
					tags: args.tags ? String(args.tags) : undefined,
					locale: args.locale ? String(args.locale) : undefined,
					isDraft: typeof args.isDraft === "boolean" ? args.isDraft : undefined,
					category: args.category ? String(args.category) : undefined,
					image: args.image ? String(args.image) : undefined,
					publishedAt: args.publishedAt ? String(args.publishedAt) : undefined,
					updatedAt: args.updatedAt ? String(args.updatedAt) : undefined,
				});
			},
		}),

		list: defineCommand({
			meta: { description: "List all articles" },
			args: {
				verbose: {
					type: "boolean",
					description: "Enable verbose logging",
					default: false,
				},
			},
			run: async ({ args }) => {
				await listArticles({
					verbose: Boolean(args.verbose),
				});
			},
		}),

		delete: defineCommand({
			meta: { description: "Delete an article" },
			args: {
				file: {
					type: "string",
					description: "Article filename (e.g. my-article.md)",
				},
				force: {
					type: "boolean",
					description: "Skip confirmation prompt",
					default: false,
				},
				verbose: {
					type: "boolean",
					description: "Enable verbose logging",
					default: false,
				},
			},
			run: async ({ args }) => {
				await deleteArticle({
					verbose: Boolean(args.verbose),
					file: args.file ? String(args.file) : undefined,
					force: Boolean(args.force),
				});
			},
		}),

		publish: defineCommand({
			meta: { description: "Publish a draft article" },
			args: {
				file: {
					type: "string",
					description: "Article filename (e.g. my-article.md)",
				},
				verbose: {
					type: "boolean",
					description: "Enable verbose logging",
					default: false,
				},
			},
			run: async ({ args }) => {
				await publishArticle({
					verbose: Boolean(args.verbose),
					file: args.file ? String(args.file) : undefined,
				});
			},
		}),

		unpublish: defineCommand({
			meta: { description: "Unpublish an article (mark as draft)" },
			args: {
				file: {
					type: "string",
					description: "Article filename (e.g. my-article.md)",
				},
				verbose: {
					type: "boolean",
					description: "Enable verbose logging",
					default: false,
				},
			},
			run: async ({ args }) => {
				await unpublishArticle({
					verbose: Boolean(args.verbose),
					file: args.file ? String(args.file) : undefined,
				});
			},
		}),

		search: defineCommand({
			meta: { description: "Search articles by content or metadata" },
			args: {
				query: {
					type: "string",
					description: "Search query (required)",
				},
				inTags: {
					type: "boolean",
					description: "Search in tags",
					default: false,
				},
				inContent: {
					type: "boolean",
					description: "Search in content",
					default: false,
				},
				author: {
					type: "string",
					description: "Filter by author",
				},
				verbose: {
					type: "boolean",
					description: "Enable verbose logging",
					default: false,
				},
			},
			run: async ({ args }) => {
				await searchArticles({
					verbose: Boolean(args.verbose),
					inTags: Boolean(args.inTags),
					inContent: Boolean(args.inContent),
					author: args.author ? String(args.author) : undefined,
				});
			},
		}),

		"seo-check": defineCommand({
			meta: { description: "Check SEO for articles" },
			args: {
				keyword: {
					type: "string",
					description: "Main keyword for SEO analysis",
				},
				file: {
					type: "string",
					description: "Specific article file to check (optional)",
				},
				verbose: {
					type: "boolean",
					description: "Enable verbose logging",
					default: false,
				},
			},
			run: async ({ args }) => {
				await seoCheck({
					verbose: Boolean(args.verbose),
					keyword: args.keyword ? String(args.keyword) : undefined,
					file: args.file ? String(args.file) : undefined,
				});
			},
		}),

		stats: defineCommand({
			meta: { description: "Show article statistics" },
			args: {
				verbose: {
					type: "boolean",
					description: "Enable verbose logging",
					default: false,
				},
			},
			run: async ({ args }) => {
				await statsArticles({
					verbose: Boolean(args.verbose),
				});
			},
		}),

		validate: defineCommand({
			meta: { description: "Validate all articles" },
			args: {
				fix: {
					type: "boolean",
					description: "Attempt to automatically fix common issues",
					default: false,
				},
				verbose: {
					type: "boolean",
					description: "Enable verbose logging",
					default: false,
				},
			},
			run: async ({ args }) => {
				await validateArticles({
					verbose: Boolean(args.verbose),
					fix: Boolean(args.fix),
				});
			},
		}),
	},
	run: () => {},
});
