import { defineCommand } from "citty";
import { createCategory } from "./create";
import { deleteCategory } from "./delete";
import { doctorCategories } from "./doctor";
import { editCategory } from "./edit";
import { listCategories } from "./list";
import { statsCategory } from "./stats"; // Import the new stats command

export default defineCommand({
	meta: { description: "Category management commands" },
	subCommands: {
		create: defineCommand({
			meta: { description: "Create a new category" },
			args: {
				slug: {
					type: "string",
					description: "Category slug (required)",
				},
				"title-ar": {
					type: "string",
					description: "Category title in Arabic",
				},
				"title-en": {
					type: "string",
					description: "Category title in English",
				},
				"description-ar": {
					type: "string",
					description: "Category description in Arabic",
				},
				"description-en": {
					type: "string",
					description: "Category description in English",
				},
				image: {
					type: "string",
					description: "Image path or URL",
				},
				icon: {
					type: "string",
					description: "Icon path or name",
				},
				verbose: {
					type: "boolean",
					description: "Enable verbose logging",
					default: false,
				},
			},
			run: async ({ args }) => {
				await createCategory({
					verbose: Boolean(args.verbose),
					slug: String(args.slug),
					title: {
						ar: String(args["title-ar"]),
						en: String(args["title-en"]),
					},
					description: {
						ar: String(args["description-ar"]),
						en: String(args["description-en"]),
					},
					image: args.image ? String(args.image) : undefined,
					icon: args.icon ? String(args.icon) : undefined,
				});
			},
		}),

		edit: defineCommand({
			meta: { description: "Edit an existing category" },
			args: {
				slug: {
					type: "string",
					description: "Category slug (required)",
				},
				"title-ar": {
					type: "string",
					description: "Category title in Arabic",
				},
				"title-en": {
					type: "string",
					description: "Category title in English",
				},
				"description-ar": {
					type: "string",
					description: "Category description in Arabic",
				},
				"description-en": {
					type: "string",
					description: "Category description in English",
				},
				image: {
					type: "string",
					description: "Image path or URL",
				},
				icon: {
					type: "string",
					description: "Icon path or name",
				},
				verbose: {
					type: "boolean",
					description: "Enable verbose logging",
					default: false,
				},
			},
			run: async ({ args }) => {
				await editCategory({
					verbose: Boolean(args.verbose),
					slug: String(args.slug),
					title:
						args["title-ar"] || args["title-en"]
							? {
									ar: String(args["title-ar"]),
									en: String(args["title-en"]),
								}
							: undefined,
					description:
						args["description-ar"] || args["description-en"]
							? {
									ar: String(args["description-ar"]),
									en: String(args["description-en"]),
								}
							: undefined,
					image: args.image ? String(args.image) : undefined,
					icon: args.icon ? String(args.icon) : undefined,
				});
			},
		}),

		list: defineCommand({
			meta: { description: "List all categories" },
			args: {
				verbose: {
					type: "boolean",
					description: "Enable verbose logging",
					default: false,
				},
			},
			run: async ({ args }) => {
				await listCategories({
					verbose: Boolean(args.verbose),
				});
			},
		}),

		delete: defineCommand({
			meta: { description: "Delete a category" },
			args: {
				slug: {
					type: "string",
					description: "Category slug (required)",
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
				await deleteCategory({
					verbose: Boolean(args.verbose),
					slug: String(args.slug),
					force: Boolean(args.force),
				});
			},
		}),

		doctor: defineCommand({
			meta: { description: "Check categories for issues" },
			args: {
				verbose: {
					type: "boolean",
					description: "Enable verbose logging",
					default: false,
				},
				fix: {
					type: "boolean",
					description: "Attempt to automatically fix issues",
					default: false,
				},
			},
			run: async ({ args }) => {
				await doctorCategories({
					verbose: Boolean(args.verbose),
					fix: Boolean(args.fix),
				});
			},
		}),
		stats: defineCommand({
			// Add the stats subcommand
			meta: { description: "Show statistics for categories" },
			args: {
				verbose: {
					type: "boolean",
					description: "Enable verbose logging",
					default: false,
				},
			},
			run: async ({ args }) => {
				await statsCategory({ verbose: Boolean(args.verbose) });
			},
		}),
	},
	run: () => {},
});
