import path from "node:path";
import chalk from "chalk";
import fs from "fs-extra";
import {
	type Author,
	authorSchema,
	normalizeMultilingualText,
} from "../../schemas";
import { updateFrontmatter } from "../../utils/frontmatter";
import { logger } from "../../utils/logger";
import { type ProjectPaths, getProjectPaths } from "../../utils/project";

export async function createAuthor(opts: {
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
}) {
	const spinner = logger.spinner("Initializing author creation");

	// Get project paths
	let paths: ProjectPaths;
	try {
		paths = await getProjectPaths(process.cwd());
		spinner.text = "Validating project structure";
	} catch (e) {
		logger.spinnerError(`Project validation failed: ${(e as Error).message}`);
		return;
	}

	// Validate required fields
	if (!opts.id) {
		logger.spinnerError("--id is required");
		return;
	}

	if (!opts.name) {
		logger.spinnerError("--name is required");
		return;
	}

	if (!opts.bio) {
		logger.spinnerError("--bio is required");
		return;
	}

	// Normalize multilingual fields
	const name = normalizeMultilingualText(opts.name);
	const bio = normalizeMultilingualText(opts.bio);
	const role = opts.role ? normalizeMultilingualText(opts.role) : undefined;

	// Check if author already exists
	const authorsDir = paths.authors;
	const filePath = path.join(authorsDir, `${opts.id}.md`);

	if (await fs.pathExists(filePath)) {
		logger.spinnerError(`Author '${opts.id}' already exists.`);
		return;
	}

	// Create author object
	spinner.text = "Creating author data";
	const authorObj: Partial<Author> = {
		slug: opts.id,
		name,
		bio,
		avatar: opts.avatar,
		twitter: opts.twitter,
		github: opts.github,
		website: opts.website,
		linkedin: opts.linkedin,
		role,
	};

	// Validate with schema
	const parseResult = authorSchema.safeParse(authorObj);
	if (!parseResult.success) {
		logger.spinnerError("Validation failed. Author not created.");
		for (const err of parseResult.error.errors) {
			console.log(chalk.red(`- ${err.path.join(".")} ${err.message}`));
		}
		return;
	}

	// Create frontmatter content
	const frontmatter = updateFrontmatter("", authorObj);

	// Write file
	spinner.text = `Writing author to ${opts.id}.md`;

	try {
		await fs.writeFile(filePath, frontmatter, "utf-8");
		logger.spinnerSuccess(
			`Author created: ${path.relative(process.cwd(), filePath)}`,
		);

		// Display author details
		console.log(
			logger.box(
				`👤 ${chalk.green("Author successfully created!")}
        
${chalk.bold("ID:")} ${chalk.cyan(opts.id)}
${chalk.bold("Name:")} ${chalk.cyan(
					typeof name === "string" ? name : JSON.stringify(name),
				)}
${chalk.bold("Bio:")} ${chalk.cyan(
					typeof bio === "string" ? bio : JSON.stringify(bio),
				)}`,
				"Author Details",
				"green",
			),
		);
	} catch (error) {
		logger.spinnerError(`Failed to write author: ${(error as Error).message}`);
	}
}
