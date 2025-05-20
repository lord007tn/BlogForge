import { defineCommand } from "citty";
import { convertImages } from "./convert";
import { findUnusedImages } from "./find-unused";
import { optimizeImages } from "./optimize";
import { suggestMissingAltText } from "./suggest-alt";
import { validateImageReferences } from "./validate-references";

export default defineCommand({
	meta: {
		name: "images",
		description: "Image management tools for the blog",
	},
	subCommands: {
		optimize: defineCommand({
			meta: {
				description: "Optimize (resize/compress) images",
			},
			args: {
				width: {
					type: "string",
					description: "Maximum width in pixels",
					default: "1200",
				},
				quality: {
					type: "string",
					description: "Image quality (1-100)",
					default: "80",
				},
				directory: {
					type: "string",
					description: "Custom images directory path",
				},
				verbose: {
					type: "boolean",
					description: "Enable verbose logging",
					default: false,
				},
			},
			run: async ({ args }) => {
				try {
					await optimizeImages({
						width: Number(args.width),
						quality: Number(args.quality),
						directory: args.directory ? String(args.directory) : undefined,
						verbose: Boolean(args.verbose),
					});
				} catch (error) {
					// Always stop spinner and show error
				}
			},
		}),

		convert: defineCommand({
			meta: {
				description: "Convert images to a different format",
			},
			args: {
				to: {
					type: "string",
					description: "Target format (avif, webp, jpeg, png)",
					default: "avif",
				},
				quality: {
					type: "string",
					description: "Image quality (1-100)",
					default: "80",
				},
				directory: {
					type: "string",
					description: "Custom images directory path",
				},
				verbose: {
					type: "boolean",
					description: "Enable verbose logging",
					default: false,
				},
			},
			run: async ({ args }) => {
				try {
					await convertImages({
						to: args.to ? String(args.to) : "",
						quality: Number(args.quality),
						directory: args.directory ? String(args.directory) : undefined,
						verbose: Boolean(args.verbose),
					});
				} catch (error) {
					// Always stop spinner and show error
				}
			},
		}),

		"find-unused": defineCommand({
			meta: {
				description: "Find unused images in the images directory",
			},
			args: {
				directory: {
					type: "string",
					description: "Custom images directory path",
				},
				delete: {
					type: "boolean",
					description: "Delete unused images",
					default: false,
				},
				verbose: {
					type: "boolean",
					description: "Enable verbose logging",
					default: false,
				},
			},
			run: async ({ args }) => {
				try {
					await findUnusedImages({
						directory: args.directory ? String(args.directory) : undefined,
						delete: Boolean(args.delete),
						verbose: Boolean(args.verbose),
					});
				} catch (error) {
					// Always stop spinner and show error
				}
			},
		}),

		validate: defineCommand({
			meta: {
				description:
					"Validate image references in articles (checks if referenced images exist)",
			},
			args: {
				verbose: {
					type: "boolean",
					description: "Enable verbose logging",
					default: false,
				},
				fix: {
					type: "boolean",
					description: "Attempt to fix issues",
					default: false,
				},
			},
			run: async ({ args }) => {
				try {
					await validateImageReferences({
						verbose: Boolean(args.verbose),
						fix: Boolean(args.fix),
					});
				} catch (error) {
					// Always stop spinner and show error
				}
			},
		}),

		"alt-text": defineCommand({
			meta: {
				description:
					"Check image alt text quality in articles (missing, empty, or generic)",
			},
			args: {
				verbose: {
					type: "boolean",
					description: "Enable verbose logging",
					default: false,
				},
				fix: {
					type: "boolean",
					description: "Attempt to fix issues",
					default: false,
				},
			},
			run: async ({ args }) => {
				try {
					await suggestMissingAltText({
						verbose: Boolean(args.verbose),
						fix: Boolean(args.fix),
					});
				} catch (error) {
					// Always stop spinner and show error
				}
			},
		}),
	},
});
