import path from "node:path";
import chalk from "chalk";
import fs from "fs-extra";
import { authorSchema, normalizeMultilingualText } from "../../schemas";
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
}) {
	const spinner = logger.spinner("Initializing author edit");

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

	// Check if author exists
	const authorsDir = paths.authors;
	const filePath = path.join(authorsDir, `${opts.id}.md`);

	if (!(await fs.pathExists(filePath))) {
		logger.spinnerError(`Author '${opts.id}' does not exist.`);
		return;
	}

	// Read existing author data
	spinner.text = "Reading author data";

	try {
		const content = await fs.readFile(filePath, "utf-8");
		const { frontmatter } = extractFrontmatter(content);

		// Update fields if provided
		if (opts.name) {
			frontmatter.name = normalizeMultilingualText(opts.name);
		}

		if (opts.bio) {
			frontmatter.bio = normalizeMultilingualText(opts.bio);
		}

		if (opts.role) {
			frontmatter.role = normalizeMultilingualText(opts.role);
		}

		if (opts.avatar !== undefined) {
			frontmatter.avatar = opts.avatar;
		}

		if (opts.twitter !== undefined) {
			frontmatter.twitter = opts.twitter;
		}

		if (opts.github !== undefined) {
			frontmatter.github = opts.github;
		}

		if (opts.website !== undefined) {
			frontmatter.website = opts.website;
		}

		if (opts.linkedin !== undefined) {
			frontmatter.linkedin = opts.linkedin;
		}

		// Validate with schema
		const parseResult = authorSchema.safeParse(frontmatter);
		if (!parseResult.success) {
			logger.spinnerError("Validation failed. Author not updated.");
			for (const err of parseResult.error.errors) {
				console.log(chalk.red(`- ${err.path.join(".")} ${err.message}`));
			}
			return;
		}

		// Update frontmatter
		const newContent = updateFrontmatter(content, frontmatter);

		// Write file
		spinner.text = `Updating author ${opts.id}.md`;
		await fs.writeFile(filePath, newContent, "utf-8");

		logger.spinnerSuccess(
			`Author updated: ${path.relative(process.cwd(), filePath)}`,
		);

		// Display updated author details
		const displayName = getFrontMatterEntry(frontmatter, "name");

		console.log(
			logger.box(
				`👤 ${chalk.green("Author successfully updated!")}
        
${chalk.bold("ID:")} ${chalk.cyan(opts.id)}
${chalk.bold("Name:")} ${chalk.cyan(displayName)}`,
				"Author Updated",
				"green",
			),
		);
	} catch (error) {
		logger.spinnerError(`Failed to update author: ${(error as Error).message}`);
	}
}
