import path from "node:path";
import chalk from "chalk";
import fs from "fs-extra";
import prompts, { type Answers } from "prompts"; // Added import for Answers type
import {
	type Author,
	authorSchema,
	normalizeMultilingualText,
} from "../../schemas"; // Added Author import
import { defaultConfig } from "../../utils/config"; // Added import
import {
	extractFrontmatter,
	getFrontMatterEntry,
	updateFrontmatter,
} from "../../utils/frontmatter";
import { logger } from "../../utils/logger";
import { type ProjectPaths, getProjectPaths } from "../../utils/project";

export async function editAuthor(opts: {
	verbose?: boolean;
	id?: string;
	name?: string | { ar?: string; en?: string };
	bio?: string | { ar?: string; en?: string };
	avatar?: string;
	twitter?: string;
	github?: string;
	website?: string;
	linkedin?: string;
	role?: string | { ar?: string; en?: string };
	interactive?: boolean; // Added interactive flag
}) {
	const spinner = logger.spinner("Initializing author edit");

	// Sanitize opts.id if it's the string "undefined"
	if (opts.id === "undefined") {
		opts.id = undefined;
	}

	// Normalize opts.id to be clean (remove .md if present)
	if (opts.id && typeof opts.id === "string" && opts.id.endsWith(".md")) {
		opts.id = opts.id.slice(0, -3);
	}

	// Get project paths
	let paths: ProjectPaths;
	try {
		paths = await getProjectPaths(process.cwd());
		spinner.text = "Validating project structure";
	} catch (e) {
		logger.spinnerError(`Project validation failed: ${(e as Error).message}`);
		return;
	}

	const authorsDir = paths.authors; // Moved authorsDir up for early access

	// If no id specified and interactive mode, prompt user to select one
	let targetId = opts.id;
	if (!targetId && opts.interactive !== false) {
		spinner.text = "Reading author files";
		const authorFiles = (await fs.readdir(authorsDir)).filter((f) =>
			f.endsWith(".md"),
		);
		if (!authorFiles.length) {
			logger.spinnerError("No authors found to edit.");
			return;
		}
		spinner.stop(); // Stop spinner before prompts
		const authorChoices = authorFiles.map((f) => ({
			title: f, // Show full filename in prompt
			value: f.replace(/\\.md$/, ""), // Return clean ID as value
		}));
		const idResponse = await prompts({
			type: "select",
			name: "selectedId",
			message: "Select an author to edit:",
			choices: authorChoices,
		});
		if (!idResponse.selectedId) {
			logger.error("No author selected. Aborting."); // Changed to error
			return;
		}
		targetId = idResponse.selectedId as string; // Added type assertion
		opts.id = targetId; // Update opts.id as it's used later
		spinner.start("Loading selected author");
	} else if (!targetId) {
		logger.spinnerError(
			"No ID specified. Use --id=<id> or run in interactive mode.",
		);
		return;
	}

	// Ensure targetId is definitively clean before use
	if (typeof targetId === "string" && targetId.endsWith(".md")) {
		targetId = targetId.slice(0, -3);
	}

	const filePath = path.join(authorsDir, `${targetId}.md`);

	// Check if author file exists
	if (!(await fs.pathExists(filePath))) {
		logger.spinnerError(`Author '${targetId}' does not exist.`);
		return;
	}

	// Read existing author data
	spinner.text = "Reading author data";
	const updatedFields: Partial<Author> = {}; // Declare updatedFields with Author type

	try {
		const fileContent = await fs.readFile(filePath, "utf-8"); // Renamed to fileContent
		const { frontmatter: existingFrontmatter } =
			extractFrontmatter(fileContent); // Correct destructuring, removed bodyContent

		// Interactive mode: Show form only if no specific field values are provided via CLI
		if (
			opts.interactive !== false &&
			!opts.name &&
			!opts.bio &&
			!opts.avatar &&
			!opts.twitter &&
			!opts.github &&
			!opts.website &&
			!opts.linkedin &&
			!opts.role
		) {
			spinner.stop();
			const currentName = getFrontMatterEntry(existingFrontmatter, "name");
			const currentBio = getFrontMatterEntry(existingFrontmatter, "bio");
			const currentAvatar = (existingFrontmatter.avatar as string) || "";
			const currentTwitter = (existingFrontmatter.twitter as string) || "";
			const currentGithub = (existingFrontmatter.github as string) || "";
			const currentWebsite = (existingFrontmatter.website as string) || "";
			const currentLinkedin = (existingFrontmatter.linkedin as string) || "";
			const currentRole = getFrontMatterEntry(existingFrontmatter, "role");

			console.log(chalk.cyan(`\\nEditing author: ${chalk.bold(targetId)}\\n`));

			// Define the expected structure of the prompts response
			type PromptResponse = {
				name: string;
				bio?: string;
				avatar?: string;
				role?: string;
				twitter?: string;
				github?: string;
				website?: string;
				linkedin?: string;
			};

			const response: Answers<keyof PromptResponse> = await prompts<
				keyof PromptResponse
			>([
				{
					type: "text",
					name: "name",
					message: `Name${chalk.red("(*)")}:`,
					initial: currentName,
					validate: (value) => (value ? true : "Name is required"),
				},
				{
					type: "text",
					name: "bio",
					message: "Bio:",
					initial: currentBio,
				},
				{
					type: "text",
					name: "avatar", // Added avatar prompt
					message: "Avatar URL:",
					initial: currentAvatar,
				},
				{
					type: "text",
					name: "role",
					message: "Role:",
					initial: currentRole,
				},
				{
					type: "text",
					name: "twitter",
					message: "Twitter Handle:",
					initial: currentTwitter,
				},
				{
					type: "text",
					name: "github",
					message: "GitHub Handle:",
					initial: currentGithub,
				},
				{
					type: "text",
					name: "website",
					message: "Website URL:",
					initial: currentWebsite,
				},
				{
					type: "text",
					name: "linkedin",
					message: "LinkedIn Profile URL:",
					initial: currentLinkedin,
				},
			]);

			// Update opts with interactive responses
			if (response.name)
				updatedFields.name = normalizeMultilingualText(
					response.name as string,
					defaultConfig.defaultLanguage,
				);
			if (response.bio)
				updatedFields.bio = normalizeMultilingualText(
					response.bio as string,
					defaultConfig.defaultLanguage,
				);
			else updatedFields.bio = undefined; // Allow clearing bio
			if (response.avatar !== undefined)
				updatedFields.avatar = (response.avatar as string) || undefined;
			if (response.twitter !== undefined)
				updatedFields.twitter = (response.twitter as string) || undefined;
			if (response.github !== undefined)
				updatedFields.github = (response.github as string) || undefined;
			if (response.website !== undefined)
				updatedFields.website = (response.website as string) || undefined;
			if (response.linkedin !== undefined)
				updatedFields.linkedin = (response.linkedin as string) || undefined;
			if (response.role)
				updatedFields.role = normalizeMultilingualText(
					response.role as string,
					defaultConfig.defaultLanguage,
				);
			else updatedFields.role = undefined; // Allow clearing role
		} else {
			// Non-interactive: Apply command line options directly
			if (opts.name)
				updatedFields.name = normalizeMultilingualText(
					opts.name,
					defaultConfig.defaultLanguage,
				);
			if (opts.bio)
				updatedFields.bio = normalizeMultilingualText(
					opts.bio,
					defaultConfig.defaultLanguage,
				);
			if (opts.role)
				updatedFields.role = normalizeMultilingualText(
					opts.role,
					defaultConfig.defaultLanguage,
				);
			if (opts.avatar !== undefined) {
				// Check for undefined to allow clearing the field
				updatedFields.avatar = opts.avatar || undefined;
			}
			if (opts.twitter !== undefined) {
				updatedFields.twitter = opts.twitter || undefined;
			}
			if (opts.github !== undefined) {
				updatedFields.github = opts.github || undefined;
			}
			if (opts.website !== undefined) {
				updatedFields.website = opts.website || undefined;
			}
			if (opts.linkedin !== undefined) {
				updatedFields.linkedin = opts.linkedin || undefined;
			}
		}

		// Merge with existing frontmatter, updatedFields takes precedence
		const newFrontmatter = { ...existingFrontmatter, ...updatedFields };

		// Validate the new frontmatter
		spinner.text = "Validating author data";
		const validationResult = authorSchema.safeParse(newFrontmatter);
		if (!validationResult.success) {
			logger.spinnerError(
				`Validation failed: ${validationResult.error.errors
					.map((e) => e.message)
					.join(", ")}`,
			);
			return;
		}

		// Update the file
		spinner.text = "Updating author file";
		const newFileContent = updateFrontmatter(fileContent, newFrontmatter); // Corrected arguments
		await fs.writeFile(filePath, newFileContent, "utf-8");

		spinner.succeed(
			`Author ${chalk.green(targetId)} updated successfully at ${chalk.blue(
				path.relative(process.cwd(), filePath),
			)}`,
		);
	} catch (e) {
		logger.spinnerError(`Error editing author: ${(e as Error).message}`);
	}
}
