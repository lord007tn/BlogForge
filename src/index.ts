#!/usr/bin/env node
import boxen from "boxen";
import chalk from "chalk";
import { defineCommand, runMain } from "citty";
import Table from "cli-table3";
import Fuse from "fuse.js";
import prompts from "prompts";
import { CLI_NAME, CLI_VERSION } from "./constants"; // Updated import
import { logger } from "./utils/logger";

import articlesCommands from "./commands/articles";
// Import command groups
import authorCommands from "./commands/authors";
import categoryCommands from "./commands/category";
import { globalDoctor } from "./commands/doctor";
import imagesCommands from "./commands/images";
import { initProject } from "./commands/init";
import { getProjectPaths } from "./utils/project";

/**
 * Register global error handler
 */
if (!process.env.BLOG_FORGE_ERROR_HANDLER) {
	process.env.BLOG_FORGE_ERROR_HANDLER = "1";
	process.on("uncaughtException", (error) => {
		logger.error("An unexpected error occurred:");
		logger.error(error.message);

		if (
			process.env.BLOG_FORGE_DEBUG === "1" ||
			process.env.BLOG_FORGE_VERBOSE === "1"
		) {
			console.error(chalk.gray(error.stack));
		}

		process.exit(1);
	});
}

/**
 * Display the welcome banner for BlogForge
 */
function displayWelcomeBanner() {
	// Show fancy BlogForge header
	logger.showHeader("BlogForge");

	// Display version info
	logger.info(
		boxen(
			`${chalk.bold("BlogForge")} ${chalk.gray(`v${CLI_VERSION}`)}
${chalk.dim("A command-line tool for managing Nuxt Content blogs")}

${chalk.bold("Usage:")}
  ${chalk.cyan("npx blogforge")} ${chalk.yellow("<command>")}
  
  Run ${chalk.cyan("npx blogforge --help")} for a list of all commands.`,
			{
				padding: 1,
				margin: 1,
				borderColor: "cyan",
				borderStyle: "round",
			},
		),
	);
}

/**
 * Create a searchable command index for fuzzy search
 */
function createCommandIndex() {
	const commandGroups = [
		{
			name: "articles",
			commands: Object.keys(articlesCommands.subCommands || {}),
		},
		{ name: "author", commands: Object.keys(authorCommands.subCommands || {}) },
		{
			name: "category",
			commands: Object.keys(categoryCommands.subCommands || {}),
		},
		{ name: "images", commands: Object.keys(imagesCommands.subCommands || {}) },
		{ name: "doctor", commands: ["run"] },
	];

	const commandIndex: Array<{
		path: string;
		group: string;
		command: string;
		description: string;
	}> = [];

	for (const group of commandGroups) {
		for (const cmd of group.commands) {
			// Skip internal commands
			if (cmd.startsWith("_")) continue;

			const subCommand =
				group.name === "doctor"
					? { meta: { description: "Run all doctor checks" } }
					: group.name === "articles"
						? (articlesCommands.subCommands as Record<string, any>)?.[cmd]
						: group.name === "author"
							? (authorCommands.subCommands as Record<string, any>)?.[cmd]
							: group.name === "category"
								? (categoryCommands.subCommands as Record<string, any>)?.[cmd]
								: (imagesCommands.subCommands as Record<string, any>)?.[cmd];

			const description = subCommand?.meta?.description || "";

			commandIndex.push({
				path: `${group.name} ${cmd}`,
				group: group.name,
				command: cmd,
				description,
			});
		}
	}

	return commandIndex;
}

/**
 * Search for commands using fuzzy search
 */
function searchCommands(query: string) {
	const commandIndex = createCommandIndex();

	const fuse = new Fuse(commandIndex, {
		keys: ["path", "description"],
		threshold: 0.4,
		includeScore: true,
	});

	return fuse.search(query).map((result) => result.item);
}

/**
 * Display search results
 */
function displaySearchResults(results: ReturnType<typeof searchCommands>) {
	if (results.length === 0) {
		logger.info(chalk.yellow("No commands found matching your search."));
		return;
	}

	const table = new Table({
		head: [chalk.cyan("Command"), chalk.cyan("Description")],
		style: {
			head: [],
			border: [],
		},
	});

	for (const result of results) {
		table.push([
			chalk.green(`${result.group} ${result.command}`),
			result.description,
		]);
	}

	logger.info(table.toString());
}

/**
 * Interactive main menu
 */
async function interactiveMainMenu(): Promise<void> {
	// Display welcome banner
	displayWelcomeBanner();

	try {
		// First, verify the project to ensure we're in a Nuxt Content project
		await getProjectPaths(process.cwd());
	} catch (error) {
		logger.warning(`${(error as Error).message}\n`);

		const confirmation = await prompts({
			type: "confirm",
			name: "continue",
			message: "Do you want to continue anyway?",
			initial: false,
		});

		if (!confirmation.continue) {
			process.exit(0);
		}
	}

	const response = await prompts([
		{
			type: "select",
			name: "action",
			message: chalk.bold("What would you like to do?"),
			choices: [
				{ title: chalk.cyan("Manage Articles"), value: "articles" },
				{ title: chalk.cyan("Manage Authors"), value: "author" },
				{ title: chalk.cyan("Manage Categories"), value: "category" },
				{ title: chalk.cyan("Manage Images"), value: "images" },
				{ title: chalk.yellow("Run Doctor Checks"), value: "doctor" },
				{ title: chalk.magenta("Search Commands"), value: "search" },
				{ title: chalk.red("Exit"), value: "exit" },
			],
			initial: 0,
		},
	]);

	if (response.action === "exit" || !response.action) {
		return;
	}

	if (response.action === "search") {
		const searchQuery = await prompts({
			type: "text",
			name: "query",
			message: "Search for a command:",
		});

		if (searchQuery.query) {
			const results = searchCommands(searchQuery.query);
			displaySearchResults(results);
		}

		// Return to main menu
		return interactiveMainMenu();
	}

	if (response.action === "doctor") {
		logger.info(chalk.yellow("\nRunning doctor checks...\n"));
		await globalDoctor({ verbose: true });

		// Allow user to return to main menu
		const returnToMenu = await prompts({
			type: "confirm",
			name: "return",
			message: "Return to main menu?",
			initial: true,
		});

		if (returnToMenu.return) {
			return interactiveMainMenu();
		}

		return;
	}

	// Get subcommands for the selected action
	let subCommands: { [key: string]: any } = {};
	let commandGroupTitle = "";

	switch (response.action) {
		case "articles":
			subCommands = articlesCommands.subCommands || {};
			commandGroupTitle = "Article Management";
			break;
		case "author":
			subCommands = authorCommands.subCommands || {};
			commandGroupTitle = "Author Management";
			break;
		case "category":
			subCommands = categoryCommands.subCommands || {};
			commandGroupTitle = "Category Management";
			break;
		case "images":
			subCommands = imagesCommands.subCommands || {};
			commandGroupTitle = "Image Management";
			break;
	}

	// Create menu choices from subcommands
	const choices = Object.entries(subCommands).map(([name, cmd]) => ({
		title: chalk.cyan(name),
		value: name,
		description: cmd?.meta?.description || "",
	}));

	// Add back option
	choices.push({
		title: chalk.yellow("Back to Main Menu"),
		value: "back",
		description: "",
	});

	// Show subcommand menu
	logger.info(
		boxen(chalk.bold(commandGroupTitle), {
			padding: 1,
			borderColor: "cyan",
			borderStyle: "round",
			textAlignment: "center",
		}),
	);

	const subCommandResponse = await prompts({
		type: "select",
		name: "command",
		message: `Select a ${response.action} command:`,
		choices,
		initial: 0,
	});

	if (subCommandResponse.command === "back" || !subCommandResponse.command) {
		return interactiveMainMenu();
	}

	// Execute the selected command
	const selectedCommand = subCommands[subCommandResponse.command];
	if (selectedCommand?.run) {
		try {
			await selectedCommand.run({ args: {} });
		} catch (error) {
			logger.error(`Command execution failed: ${(error as Error).message}`);
		}

		// Allow user to return to main menu
		const returnToMenu = await prompts({
			type: "confirm",
			name: "return",
			message: "Return to main menu?",
			initial: true,
		});

		if (returnToMenu.return) {
			return interactiveMainMenu();
		}
	}
}

// Create the main BlogForge command
const cli = defineCommand({
	meta: {
		name: CLI_NAME,
		version: CLI_VERSION,
		description: "BlogForge for managing Nuxt Content v3 blogs",
	},
	subCommands: {
		author: authorCommands,
		category: categoryCommands,
		articles: articlesCommands,
		images: imagesCommands,
		doctor: defineCommand({
			meta: { description: "Run all doctor checks (articles, categories)" },
			args: {
				verbose: {
					type: "boolean",
					description: "Enable verbose logging",
					default: false,
				},
				fix: {
					type: "boolean",
					description: "Attempt to fix common issues automatically",
					default: false,
				},
			},
			run: async ({ args }) => {
				try {
					logger.info(
						boxen(" Running Full Blog Doctor Check ", {
							padding: 1,
							borderColor: "magenta",
							borderStyle: "round",
							textAlignment: "center",
						}),
					);

					const doctorArgs: Record<string, unknown> = {
						verbose: Boolean(args.verbose),
					};

					if ("fix" in args) doctorArgs.fix = Boolean(args.fix);
					return await globalDoctor(doctorArgs);
				} catch (error) {
					logger.error(chalk.red("Error in global doctor:"));
					logger.error(error instanceof Error ? error.message : String(error));
					process.exit(1);
				}
			},
		}),
		init: defineCommand({
			meta: {
				name: "init",
				description: "Initialize a Nuxt Content project for blogforge",
			},
			args: {
				force: {
					type: "boolean",
					description: "Overwrite existing config if present",
					default: false,
				},
				verbose: {
					type: "boolean",
					description: "Enable verbose output",
					default: false,
				},
			},
			run: async ({ args }) => {
				await initProject({
					force: Boolean(args.force),
					verbose: Boolean(args.verbose),
				});
			},
		}),
		search: defineCommand({
			meta: { description: "Search for commands" },
			args: {
				query: {
					type: "string",
					description: "Search query",
				},
			},
			run: ({ args }) => {
				if (args.query) {
					const results = searchCommands(args.query as string);
					displaySearchResults(results);
				} else {
					logger.error("Please provide a search query");
				}
			},
		}),
	},
	run: () => {
		// If run directly with no subcommand, show interactive menu
		interactiveMainMenu().catch((error) => {
			logger.error(`\nAn error occurred: ${error.message}`);
			process.exit(1);
		});
	},
});

// If no command is given or help is requested, show interactive menu
if (
	process.argv.length <= 2 ||
	(process.argv[2] === "--help" && !process.argv[3])
) {
	interactiveMainMenu().catch((error) => {
		logger.error(`\nAn error occurred: ${error.message}`);
		process.exit(1);
	});
} else {
	// Otherwise run the command
	runMain(cli);
}
