import { defineCommand } from "citty";
import { createAuthor } from "./create";
import { deleteAuthor } from "./delete";
import { doctorAuthors } from "./doctor";
import { editAuthor } from "./edit";
import { listAuthors } from "./list";
import { statsAuthors } from "./stats"; // Import the new stats command

export default defineCommand({
	meta: { description: "Author management commands" },
	subCommands: {
		create: defineCommand({
			meta: { description: "Create a new author" },
			args: {
				id: {
					type: "string",
					description: "Author ID (required)",
				},
				"name-ar": {
					type: "string",
					description: "Author name in Arabic",
				},
				"name-en": {
					type: "string",
					description: "Author name in English",
				},
				"bio-ar": {
					type: "string",
					description: "Author bio in Arabic",
				},
				"bio-en": {
					type: "string",
					description: "Author bio in English",
				},
				avatar: {
					type: "string",
					description: "Avatar image path or URL",
				},
				twitter: {
					type: "string",
					description: "Twitter username (without @)",
				},
				github: {
					type: "string",
					description: "GitHub username",
				},
				website: {
					type: "string",
					description: "Website URL",
				},
				linkedin: {
					type: "string",
					description: "LinkedIn profile URL or username",
				},
				"role-ar": {
					type: "string",
					description: "Author role in Arabic",
				},
				"role-en": {
					type: "string",
					description: "Author role in English",
				},
				verbose: {
					type: "boolean",
					description: "Enable verbose logging",
					default: false,
				},
			},
			run: async ({ args }) => {
				await createAuthor({
					verbose: Boolean(args.verbose),
					id: String(args.id),
					name: {
						ar: String(args["name-ar"]),
						en: String(args["name-en"]),
					},
					bio: {
						ar: String(args["bio-ar"]),
						en: String(args["bio-en"]),
					},
					avatar: args.avatar ? String(args.avatar) : undefined,
					twitter: args.twitter ? String(args.twitter) : undefined,
					github: args.github ? String(args.github) : undefined,
					website: args.website ? String(args.website) : undefined,
					linkedin: args.linkedin ? String(args.linkedin) : undefined,
					role:
						args["role-ar"] || args["role-en"]
							? {
									ar: String(args["role-ar"]),
									en: String(args["role-en"]),
								}
							: undefined,
				});
			},
		}),

		edit: defineCommand({
			meta: { description: "Edit an existing author" },
			args: {
				id: {
					type: "string",
					description: "Author ID (required)",
				},
				"name-ar": {
					type: "string",
					description: "Author name in Arabic",
				},
				"name-en": {
					type: "string",
					description: "Author name in English",
				},
				"bio-ar": {
					type: "string",
					description: "Author bio in Arabic",
				},
				"bio-en": {
					type: "string",
					description: "Author bio in English",
				},
				avatar: {
					type: "string",
					description: "Avatar image path or URL",
				},
				twitter: {
					type: "string",
					description: "Twitter username (without @)",
				},
				github: {
					type: "string",
					description: "GitHub username",
				},
				website: {
					type: "string",
					description: "Website URL",
				},
				linkedin: {
					type: "string",
					description: "LinkedIn profile URL or username",
				},
				"role-ar": {
					type: "string",
					description: "Author role in Arabic",
				},
				"role-en": {
					type: "string",
					description: "Author role in English",
				},
				verbose: {
					type: "boolean",
					description: "Enable verbose logging",
					default: false,
				},
			},
			run: async ({ args }) => {
				await editAuthor({
					verbose: Boolean(args.verbose),
					id: String(args.id),
					name:
						args["name-ar"] || args["name-en"]
							? {
									ar: String(args["name-ar"]),
									en: String(args["name-en"]),
								}
							: undefined,
					bio:
						args["bio-ar"] || args["bio-en"]
							? {
									ar: String(args["bio-ar"]),
									en: String(args["bio-en"]),
								}
							: undefined,
					avatar: args.avatar ? String(args.avatar) : undefined,
					twitter: args.twitter ? String(args.twitter) : undefined,
					github: args.github ? String(args.github) : undefined,
					website: args.website ? String(args.website) : undefined,
					linkedin: args.linkedin ? String(args.linkedin) : undefined,
					role:
						args["role-ar"] || args["role-en"]
							? {
									ar: String(args["role-ar"]),
									en: String(args["role-en"]),
								}
							: undefined,
				});
			},
		}),

		list: defineCommand({
			meta: { description: "List all authors" },
			args: {
				verbose: {
					type: "boolean",
					description: "Enable verbose logging",
					default: false,
				},
			},
			run: async ({ args }) => {
				await listAuthors({
					verbose: Boolean(args.verbose),
				});
			},
		}),

		delete: defineCommand({
			meta: { description: "Delete an author" },
			args: {
				id: {
					type: "string",
					description: "Author ID (required)",
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
				await deleteAuthor({
					verbose: Boolean(args.verbose),
					id: String(args.id),
					force: Boolean(args.force),
				});
			},
		}),

		doctor: defineCommand({
			meta: { description: "Check authors for issues" },
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
				await doctorAuthors({
					verbose: Boolean(args.verbose),
					fix: Boolean(args.fix),
				});
			},
		}),
		stats: defineCommand({
			// Add the stats subcommand
			meta: { description: "Show statistics for authors" },
			args: {
				verbose: {
					type: "boolean",
					description: "Enable verbose logging",
					default: false,
				},
			},
			run: async ({ args }) => {
				await statsAuthors({ verbose: Boolean(args.verbose) });
			},
		}),
	},
	run: () => {},
});
