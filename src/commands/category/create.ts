import path from "node:path";
import chalk from "chalk";
import fs from "fs-extra";
import prompts, { type InitialReturnValue } from "prompts";
import {
	type Category,
	categorySchema,
	// normalizeMultilingualText, // Will be handled by direct object construction
} from "../../schemas";
import { updateFrontmatter } from "../../utils/frontmatter";
import { logger } from "../../utils/logger";
import { type ProjectPaths, getProjectPaths } from "../../utils/project";

export interface CreateCategoryOptions {
	verbose?: boolean;
	slug?: string;
	title?: string | Record<string, string>;
	description?: string | Record<string, string>;
	image?: string;
	icon?: string;
	locale?: string; // For guiding prompts, not for saving
}

// Helper function to prompt for multilingual values (similar to createAuthor)
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

	languagesToPrompt.add(primaryLocale);

	if (typeof initialOptValue === "object") {
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
						v?.trim() ? true : `${fieldTitle} for ${lang} is required.`
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

	if (
		isRequired &&
		(!collectedValues[primaryLocale] || !collectedValues[primaryLocale].trim())
	) {
		logger.info(
			`Required field ${fieldTitle} for primary locale '${primaryLocale}' is missing.`,
		);
		const repromptResponse = await prompts({
			type: "text",
			name: `reprompt_${fieldName}_${primaryLocale}`,
			message: `${fieldTitle} (${primaryLocale}) - REQUIRED:`,
			validate: (v: string) =>
				v?.trim() ? true : `${fieldTitle} for ${primaryLocale} is required.`,
		});
		const repromptedValue =
			repromptResponse[`reprompt_${fieldName}_${primaryLocale}`];
		if (typeof repromptedValue === "string" && repromptedValue.trim()) {
			collectedValues[primaryLocale] = repromptedValue.trim();
		} else {
			logger.error(
				`Category creation cancelled: Required ${fieldTitle} for primary locale '${primaryLocale}' not provided.`,
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
				delete collectedValues[langCode];
			}
		}
	}

	if (isRequired && Object.keys(collectedValues).length === 0) {
		logger.error(
			`${fieldTitle} is required, but no values were provided after prompts.`,
		);
		return undefined;
	}
	if (Object.keys(collectedValues).length === 0 && !isRequired) {
		return undefined;
	}

	return collectedValues;
}

export async function createCategory(opts: CreateCategoryOptions) {
	const spinner = logger.spinner("Initializing category creation");

	let paths: ProjectPaths;
	try {
		paths = await getProjectPaths(process.cwd());
		spinner.text = "Validating project structure";
	} catch (e) {
		logger.spinnerError(`Project validation failed: ${(e as Error).message}`);
		return;
	}
	spinner.stop();

	const initialPrompts: prompts.PromptObject[] = [
		{
			type: "text",
			name: "slug",
			message: "Category Slug (e.g., technology-news):",
			initial: (opts.slug as InitialReturnValue) || "",
			validate: (value: string) => (value?.trim() ? true : "Slug is required"),
		},
		{
			type: "text",
			name: "locale",
			message: "Primary Locale for Title/Description (e.g., en, ar):",
			initial: (opts.locale as InitialReturnValue) || "ar",
			validate: (value: string) =>
				value?.trim() ? true : "Primary Locale is required",
		},
		{
			type: "text",
			name: "image",
			message: "Image URL (optional):",
			initial: (opts.image as InitialReturnValue) || "",
		},
		{
			type: "text",
			name: "icon",
			message: "Icon (optional, e.g., a Font Awesome class or emoji):",
			initial: (opts.icon as InitialReturnValue) || "",
		},
	];

	const baseResponses = await prompts(initialPrompts);

	if (!baseResponses.slug || !baseResponses.locale) {
		logger.info("Category creation cancelled.");
		return;
	}

	const categorySlug = baseResponses.slug;
	const primaryLocale = baseResponses.locale;

	const titleObject = await promptForMultilingualValue(
		"title",
		"Category Title",
		opts.title,
		primaryLocale,
		true,
	);
	if (!titleObject) {
		logger.info("Category creation cancelled (title not provided).");
		return;
	}

	const descriptionObject = await promptForMultilingualValue(
		"description",
		"Category Description",
		opts.description,
		primaryLocale,
		true,
	);
	if (!descriptionObject) {
		logger.info("Category creation cancelled (description not provided).");
		return;
	}

	spinner.start("Processing category data");

	const categoriesDir = paths.categories;
	const filePath = path.join(categoriesDir, `${categorySlug}.md`);

	if (await fs.pathExists(filePath)) {
		logger.spinnerError(
			`Category \'${categorySlug}\' already exists at ${filePath}`,
		);
		return;
	}

	const categoryObj: Partial<Category> = {
		slug: categorySlug,
		title: titleObject,
		description: descriptionObject,
		image: baseResponses.image || undefined,
		icon: baseResponses.icon || undefined,
		// No locale field here
	};

	const parseResult = categorySchema.safeParse(categoryObj);
	if (!parseResult.success) {
		logger.spinnerError("Validation failed. Category not created.");
		for (const err of parseResult.error.errors) {
			console.log(chalk.red(`- ${err.path.join(".")} ${err.message}`));
		}
		return;
	}

	const frontmatter = updateFrontmatter("", parseResult.data);

	spinner.text = `Writing category to ${path.relative(process.cwd(), filePath)}`;
	try {
		await fs.ensureDir(categoriesDir);
		await fs.writeFile(filePath, frontmatter, "utf-8");
		logger.spinnerSuccess(
			`Category created: ${path.relative(process.cwd(), filePath)}`,
		);

		const titleDisplay =
			typeof titleObject[primaryLocale] === "string"
				? titleObject[primaryLocale]
				: JSON.stringify(titleObject);
		const descriptionDisplay =
			typeof descriptionObject[primaryLocale] === "string"
				? descriptionObject[primaryLocale]
				: JSON.stringify(descriptionObject);

		console.log(
			logger.box(
				`🏷️ ${chalk.green("Category successfully created!")}

${chalk.bold("Slug:")} ${chalk.cyan(categorySlug)}
${chalk.bold(`Title (${primaryLocale}):`)} ${chalk.cyan(titleDisplay)}
${chalk.bold(`Description (${primaryLocale}):`)} ${chalk.cyan(descriptionDisplay)}
${categoryObj.image ? `${chalk.bold("Image:")} ${chalk.cyan(categoryObj.image)}` : ""}
${categoryObj.icon ? `${chalk.bold("Icon:")} ${chalk.cyan(categoryObj.icon)}` : ""}`,
				"Category Details",
				"green",
			),
		);
	} catch (error) {
		logger.spinnerError(
			`Failed to write category file: ${(error as Error).message}`,
		);
	}
}
