import path from "node:path";
import chalk from "chalk";
import fs from "fs-extra";
import prompts from "prompts";
import { logger } from "../../utils/logger";
import { type ProjectPaths, getProjectPaths } from "../../utils/project";

export interface DeleteAuthorOptions {
	verbose?: boolean;
	id?: string;
	force?: boolean;
}

export async function deleteAuthor(opts: DeleteAuthorOptions): Promise<void> {
	const spinner = logger.spinner("Initializing author deletion");

	// Get project paths
	let paths: ProjectPaths;
	try {
		paths = await getProjectPaths(process.cwd());
		spinner.text = "Validating project structure";
	} catch (e) {
		logger.spinnerError(`Project validation failed: ${(e as Error).message}`);
		return;
	}

	// Validate id parameter
	if (!opts.id) {
		spinner.text = "Reading author files";
		const authorFiles = (await fs.readdir(paths.authors)).filter((f) =>
			f.endsWith(".md"),
		);

		if (!authorFiles.length) {
			logger.spinnerWarn("No authors to delete.");
			return;
		}

		spinner.stop();
		const authorOptions = authorFiles.map((file) => ({
			title: file.replace(".md", ""),
			value: file.replace(".md", ""),
		}));

		const response = await prompts({
			type: "select",
			name: "id",
			message: "Select an author to delete:",
			choices: authorOptions,
		});

		opts.id = response.id;

		if (!opts.id) {
			logger.error("No author selected for deletion.");
			return;
		}
		spinner.start("Preparing to delete selected author");
	}

	// Check if author exists
	const authorsDir = paths.authors;
	const filePath = path.join(authorsDir, `${opts.id}.md`);

	if (!(await fs.pathExists(filePath))) {
		logger.spinnerError(`Author '${opts.id}' does not exist.`);
		return;
	}

	// Check if author is referenced in any articles
	spinner.text = "Checking for article references";
	const articlesDir = paths.articles;

	if (await fs.pathExists(articlesDir)) {
		const articleFiles = await fs.readdir(articlesDir);
		const referencingArticles = [];

		for (const file of articleFiles) {
			if (!file.endsWith(".md")) continue;

			const articlePath = path.join(articlesDir, file);
			const content = await fs.readFile(articlePath, "utf-8");

			if (
				content.includes(`author: ${opts.id}`) ||
				content.includes(`author: "${opts.id}"`) ||
				content.includes(`author: '${opts.id}'`)
			) {
				referencingArticles.push(file);
			}
		}

		if (referencingArticles.length > 0) {
			spinner.stop();
			console.log(
				chalk.yellow(
					`⚠️ Author '${opts.id}' is referenced in ${referencingArticles.length} article(s):`,
				),
			);
			for (const file of referencingArticles) {
				console.log(`  - ${file}`);
			}

			// Confirm deletion even if --force was provided
			const confirmation = await prompts({
				type: "confirm",
				name: "value",
				message:
					"Are you sure you want to delete this author? This will invalidate the referencing articles.",
				initial: false,
			});

			if (!confirmation.value) {
				logger.warning("Delete cancelled.");
				return;
			}
		} else if (!opts.force) {
			// If not referenced but --force not provided, still ask for confirmation
			spinner.stop();

			const confirmation = await prompts({
				type: "confirm",
				name: "value",
				message: `Are you sure you want to delete author '${opts.id}'?`,
				initial: false,
			});

			if (!confirmation.value) {
				logger.warning("Delete cancelled.");
				return;
			}
		}
	}

	// Delete the author file
	spinner.text = `Deleting author ${opts.id}.md`;

	try {
		await fs.unlink(filePath);
		logger.spinnerSuccess(`Author '${opts.id}' deleted.`);
	} catch (error) {
		logger.spinnerError(`Failed to delete author: ${(error as Error).message}`);
	}
}
