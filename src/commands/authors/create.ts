import path from "node:path";
import chalk from "chalk";
import fs from "fs-extra";
import prompts, { type InitialReturnValue } from "prompts";
import {
	type Author,
	authorSchema,
	// normalizeMultilingualText, // Will be handled by direct object construction
} from "../../schemas";
import { updateFrontmatter } from "../../utils/frontmatter";
import { logger } from "../../utils/logger";
import { type ProjectPaths, getProjectPaths } from "../../utils/project";

export interface CreateAuthorOptions {
	verbose?: boolean;
	id?: string;
	name?: string | Record<string, string>;
	bio?: string | Record<string, string>;
	avatar?: string;
	twitter?: string;
	github?: string;
	website?: string;
	linkedin?: string;
	role?: string | Record<string, string>;
	locale?: string;
}

// Helper function to prompt for multilingual values
async function promptForMultilingualValue(
	fieldName: string,
	fieldTitle: string,
	initialOptValue: string | Record<string, string> | undefined,
	primaryLocale: string,
	isRequired: boolean,
): Promise<Record<string, string> | undefined> {
	const collectedValues: Record<string, string> = {};
	const initialFieldPrompts: prompts.PromptObject[] = [];
	const languagesToPrompt = new Set<string>();

	// Always consider the primary locale for prompting
	languagesToPrompt.add(primaryLocale);

	if (typeof initialOptValue === "object") {
		// Changed from forEach to for...of
		for (const lang of Object.keys(initialOptValue)) {
			languagesToPrompt.add(lang);
		}
	}

	for (const lang of languagesToPrompt) {
		let currentInitial = "";
		if (typeof initialOptValue === "object") {
			currentInitial = initialOptValue[lang] || "";
		} else if (typeof initialOptValue === "string" && lang === primaryLocale) {
			currentInitial = initialOptValue;
		}

		const isPrimaryAndRequired = lang === primaryLocale && isRequired;

		initialFieldPrompts.push({
			type: "text",
			name: `${fieldName}_${lang}`,
			message: `${fieldTitle} (${lang})${isPrimaryAndRequired ? "*" : ""}:`,
			initial: currentInitial as InitialReturnValue,
			validate: isPrimaryAndRequired
				? (v: string) =>
						v?.trim() ? true : `${fieldTitle} for ${lang} is required.` // Optional chaining
				: undefined,
		});
	}

	if (initialFieldPrompts.length > 0) {
		const currentLangResponses = await prompts(initialFieldPrompts);
		for (const key in currentLangResponses) {
			if (key.startsWith(`${fieldName}_`)) {
				const lang = key.substring(fieldName.length + 1);
				const value = currentLangResponses[key];
				if (typeof value === "string" && value.trim()) {
					collectedValues[lang] = value.trim();
				}
			}
		}
	}

	// If primary locale is required and still missing, re-prompt specifically.
	if (
		isRequired &&
		(!collectedValues[primaryLocale] || !collectedValues[primaryLocale].trim())
	) {
		// logger.warn was changed to logger.info as .warn might not be available
		logger.info(
			`Required field ${fieldTitle} for primary locale '${primaryLocale}' is missing.`,
		);
		const repromptResponse = await prompts({
			type: "text",
			name: `reprompt_${fieldName}_${primaryLocale}`,
			message: `${fieldTitle} (${primaryLocale}) - REQUIRED:`,
			validate: (v: string) =>
				v?.trim() ? true : `${fieldTitle} for ${primaryLocale} is required.`, // Optional chaining
		});
		const repromptedValue =
			repromptResponse[`reprompt_${fieldName}_${primaryLocale}`];
		if (typeof repromptedValue === "string" && repromptedValue.trim()) {
			collectedValues[primaryLocale] = repromptedValue.trim();
		} else {
			logger.error(
				`Author creation cancelled: Required ${fieldTitle} for primary locale '${primaryLocale}' not provided.`,
			);
			return undefined;
		}
	}

	const addMorePrompt = await prompts({
		type: "confirm",
		name: "addMore",
		message: `Add or update ${fieldTitle} in other languages?`,
		initial: false,
	});

	if (addMorePrompt.addMore) {
		// eslint-disable-next-line no-constant-condition
		while (true) {
			const langCodePrompt = await prompts({
				type: "text",
				name: "langCode",
				message: `Language code for ${fieldTitle} (e.g., en, fr), or leave blank to finish:`,
			});
			const langCode =
				typeof langCodePrompt.langCode === "string"
					? langCodePrompt.langCode.trim()
					: "";
			if (!langCode) break;

			const langValuePrompt = await prompts({
				type: "text",
				name: "langValue",
				message: `${fieldTitle} (${langCode}):`,
				initial: (collectedValues[langCode] || "") as InitialReturnValue,
			});
			const langValue =
				typeof langValuePrompt.langValue === "string"
					? langValuePrompt.langValue.trim()
					: "";
			if (langValue) {
				collectedValues[langCode] = langValue;
			} else {
				delete collectedValues[langCode]; // Remove if cleared
			}
		}
	}

	if (isRequired && Object.keys(collectedValues).length === 0) {
		// This should ideally be caught by the primary locale check
		logger.error(
			`${fieldTitle} is required, but no values were provided after prompts.`,
		);
		return undefined;
	}
	if (Object.keys(collectedValues).length === 0 && !isRequired) {
		return undefined; // For optional fields like 'role', return undefined if empty
	}

	return collectedValues;
}

export async function createAuthor(opts: CreateAuthorOptions) {
	const spinner = logger.spinner("Initializing author creation");

	let paths: ProjectPaths;
	try {
		paths = await getProjectPaths(process.cwd());
		spinner.text = "Validating project structure";
	} catch (e) {
		logger.spinnerError(`Project validation failed: ${(e as Error).message}`);
		return;
	}
	spinner.stop(); // Stop spinner before prompting

	const initialPrompts: prompts.PromptObject[] = [
		{
			type: "text",
			name: "id",
			message: "Author ID (slug, e.g., john-doe):",
			initial: (opts.id as InitialReturnValue) || "",
			validate: (value: string) =>
				value?.trim() ? true : "Author ID is required", // Optional chaining
		},
		{
			type: "text",
			name: "locale",
			message: "Primary Locale for Name/Bio/Role (e.g., en, ar):",
			initial: (opts.locale as InitialReturnValue) || "ar",
			validate: (value: string) =>
				value?.trim() ? true : "Primary Locale is required", // Optional chaining
		},
		{
			type: "text",
			name: "avatar",
			message: "Avatar URL (optional):",
			initial: (opts.avatar as InitialReturnValue) || "",
		},
		{
			type: "text",
			name: "twitter",
			message: "Twitter Username (optional, without @):",
			initial: (opts.twitter as InitialReturnValue) || "",
		},
		{
			type: "text",
			name: "github",
			message: "GitHub Username (optional):",
			initial: (opts.github as InitialReturnValue) || "",
		},
		{
			type: "text",
			name: "website",
			message: "Website URL (optional):",
			initial: (opts.website as InitialReturnValue) || "",
		},
		{
			type: "text",
			name: "linkedin",
			message: "LinkedIn Profile URL or Username (optional):",
			initial: (opts.linkedin as InitialReturnValue) || "",
		},
	];

	const baseResponses = await prompts(initialPrompts);

	if (!baseResponses.id || !baseResponses.locale) {
		logger.info("Author creation cancelled.");
		return;
	}

	const authorId = baseResponses.id;
	const primaryLocale = baseResponses.locale;

	const nameObject = await promptForMultilingualValue(
		"name",
		"Author Name",
		opts.name,
		primaryLocale,
		true,
	);
	if (!nameObject) {
		logger.info("Author creation cancelled (name not provided).");
		return;
	}

	const bioObject = await promptForMultilingualValue(
		"bio",
		"Author Bio",
		opts.bio,
		primaryLocale,
		true,
	);
	if (!bioObject) {
		logger.info("Author creation cancelled (bio not provided).");
		return;
	}

	const roleObject = await promptForMultilingualValue(
		"role",
		"Author Role",
		opts.role,
		primaryLocale,
		false, // Role is optional
	);
	// For roleObject, it's okay if it's undefined (if user provided no input for an optional field)

	spinner.start("Processing author data");

	const authorsDir = paths.authors;
	const filePath = path.join(authorsDir, `${authorId}.md`);

	if (await fs.pathExists(filePath)) {
		logger.spinnerError(`Author '${authorId}' already exists at ${filePath}`);
		return;
	}

	const authorObj: Partial<Author> = {
		slug: authorId,
		name: nameObject,
		bio: bioObject,
		avatar: baseResponses.avatar || undefined,
		twitter: baseResponses.twitter || undefined,
		github: baseResponses.github || undefined,
		website: baseResponses.website || undefined,
		linkedin: baseResponses.linkedin || undefined,
	};
	if (roleObject && Object.keys(roleObject).length > 0) {
		authorObj.role = roleObject;
	}

	const parseResult = authorSchema.safeParse(authorObj);
	if (!parseResult.success) {
		logger.spinnerError("Validation failed. Author not created.");
		for (const err of parseResult.error.errors) {
			console.log(chalk.red(`- ${err.path.join(".")} ${err.message}`));
		}
		return;
	}

	const frontmatter = updateFrontmatter("", parseResult.data); // Use validated data

	spinner.text = `Writing author to ${path.relative(process.cwd(), filePath)}`;
	try {
		await fs.ensureDir(authorsDir);
		await fs.writeFile(filePath, frontmatter, "utf-8");
		logger.spinnerSuccess(
			`Author created: ${path.relative(process.cwd(), filePath)}`,
		);

		const nameDisplay =
			typeof nameObject[primaryLocale] === "string"
				? nameObject[primaryLocale]
				: JSON.stringify(nameObject);
		const bioDisplay =
			typeof bioObject[primaryLocale] === "string"
				? bioObject[primaryLocale]
				: JSON.stringify(bioObject);
		let roleDisplay = "";
		if (authorObj.role) {
			roleDisplay =
				typeof authorObj.role[primaryLocale] === "string"
					? authorObj.role[primaryLocale]
					: JSON.stringify(authorObj.role);
		}

		console.log(
			logger.box(
				`👤 ${chalk.green("Author successfully created!")}

${chalk.bold("ID:")} ${chalk.cyan(authorId)}
${chalk.bold(`Name (${primaryLocale}):`)} ${chalk.cyan(nameDisplay)}
${chalk.bold(`Bio (${primaryLocale}):`)} ${chalk.cyan(bioDisplay)}
${authorObj.avatar ? `${chalk.bold("Avatar:")} ${chalk.cyan(authorObj.avatar)}` : ""}
${authorObj.twitter ? `${chalk.bold("Twitter:")} ${chalk.cyan(authorObj.twitter)}` : ""}
${authorObj.github ? `${chalk.bold("GitHub:")} ${chalk.cyan(authorObj.github)}` : ""}
${authorObj.website ? `${chalk.bold("Website:")} ${chalk.cyan(authorObj.website)}` : ""}
${authorObj.linkedin ? `${chalk.bold("LinkedIn:")} ${chalk.cyan(authorObj.linkedin)}` : ""}
${roleDisplay ? `${chalk.bold(`Role (${primaryLocale}):`)} ${chalk.cyan(roleDisplay)}` : ""}`,
				"Author Details",
				"green",
			),
		);
	} catch (error) {
		logger.spinnerError(
			`Failed to write author file: ${(error as Error).message}`,
		);
	}
}
