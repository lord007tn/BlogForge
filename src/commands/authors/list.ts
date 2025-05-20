import path from "node:path";
import chalk from "chalk";
import Table from "cli-table3";
import fs from "fs-extra";
import {
	extractFrontmatter,
	getFrontMatterEntry,
} from "../../utils/frontmatter";
import { logger } from "../../utils/logger";
import { getProjectPaths } from "../../utils/project";

export async function listAuthors(opts: { verbose?: boolean }) {
	const spinner = logger.spinner("Finding authors");

	// Get project paths
	let authorsDir: string;
	try {
		const paths = await getProjectPaths(process.cwd());
		authorsDir = paths.authors;
		spinner.text = "Checking authors directory";
	} catch (e) {
		logger.spinnerError(`Project validation failed: ${(e as Error).message}`);
		return;
	}

	// Check if authors directory exists
	if (!(await fs.pathExists(authorsDir))) {
		logger.spinnerError("No authors directory found.");
		return;
	}

	// Get author files
	spinner.text = "Reading author files";
	const files = (await fs.readdir(authorsDir)).filter((f) => f.endsWith(".md"));

	if (!files.length) {
		logger.spinnerWarn("No authors found.");
		return;
	}

	// Create table for display
	const table = new Table({
		head: [
			chalk.cyan("ID"),
			chalk.cyan("Name"),
			chalk.cyan("Role"),
			chalk.cyan("Social"),
		],
		style: {
			head: [],
			border: [],
		},
	});

	// Process each author
	spinner.text = "Processing authors";
	for (const file of files) {
		const filePath = path.join(authorsDir, file);
		const content = await fs.readFile(filePath, "utf-8");
		const { frontmatter } = extractFrontmatter(content);

		const id = path.basename(file, ".md");
		const name = getFrontMatterEntry(frontmatter, "name");
		const role = getFrontMatterEntry(frontmatter, "role");

		// Collect social links
		const socialLinks = [];
		if (frontmatter.twitter) socialLinks.push("Twitter");
		if (frontmatter.github) socialLinks.push("GitHub");
		if (frontmatter.linkedin) socialLinks.push("LinkedIn");
		if (frontmatter.website) socialLinks.push("Website");

		table.push([
			chalk.green(id),
			name,
			role || chalk.gray("(not specified)"),
			socialLinks.length ? socialLinks.join(", ") : chalk.gray("(none)"),
		]);
	}

	// Stop spinner and show results
	spinner.stop();

	console.log(chalk.bold(`\nFound ${files.length} authors:\n`));
	console.log(table.toString());
}
