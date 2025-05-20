import boxen from "boxen";
import chalk from "chalk";
import { logger } from "../utils/logger";
import { doctorArticles } from "./articles/doctor";
import { doctorAuthors } from "./authors/doctor";
import { doctorCategories } from "./category/doctor";
import { suggestMissingAltText } from "./images/suggest-alt";
import { validateImageReferences } from "./images/validate-references";

export async function globalDoctor(opts: { verbose?: boolean; fix?: boolean }) {
	logger.info(
		boxen(chalk.bold.magenta(" Running Full Blog Doctor Check "), {
			padding: 1,
			margin: 1,
			borderColor: "magenta",
			borderStyle: "round",
		}),
	);

	let totalIssues = 0;
	let totalFixed = 0;
	let hasErrors = false;

	// Run all doctor checks
	logger.info(chalk.bold.cyan("\n🔍 Checking Articles"));
	try {
		const articlesResult = await doctorArticles({
			verbose: opts.verbose,
			fix: opts.fix,
		});

		if (articlesResult?.hasError) {
			hasErrors = true;
			totalIssues += articlesResult.issueCount;
			totalFixed += articlesResult.fixedCount;
		}
	} catch (error) {
		hasErrors = true;
		logger.error(
			chalk.red(`Error checking articles: ${(error as Error).message}`),
		);
	}

	logger.info(chalk.bold.cyan("\n🔍 Checking Authors"));
	try {
		const authorsResult = await doctorAuthors({
			verbose: opts.verbose,
			fix: opts.fix,
		});

		if (authorsResult?.hasError) {
			hasErrors = true;
			totalIssues += authorsResult.issueCount;
			totalFixed += authorsResult.fixedCount;
		}
	} catch (error) {
		hasErrors = true;
		logger.error(
			chalk.red(`Error checking authors: ${(error as Error).message}`),
		);
	}

	logger.info(chalk.bold.cyan("\n🔍 Checking Categories"));
	try {
		const categoriesResult = await doctorCategories({
			verbose: opts.verbose,
			fix: opts.fix,
		});

		if (categoriesResult?.hasError) {
			hasErrors = true;
			totalIssues += categoriesResult.issueCount;
			totalFixed += categoriesResult.fixedCount;
		}
	} catch (error) {
		hasErrors = true;
		logger.error(
			chalk.red(`Error checking categories: ${(error as Error).message}`),
		);
	}

	logger.info(chalk.bold.cyan("\n🔍 Checking Image References"));
	try {
		const imageResult = await validateImageReferences({
			verbose: opts.verbose,
			fix: opts.fix,
		});

		if (
			imageResult &&
			Array.isArray(imageResult.broken) &&
			imageResult.broken.length > 0
		) {
			hasErrors = true;
			totalIssues += imageResult.broken.length;
		}
	} catch (error) {
		hasErrors = true;
		logger.error(
			chalk.red(`Error checking image references: ${(error as Error).message}`),
		);
	}

	logger.info(chalk.bold.cyan("\n🔍 Checking Image Alt Text"));
	try {
		const altTextResult = await suggestMissingAltText({
			verbose: opts.verbose,
			fix: opts.fix,
		});

		if (
			altTextResult &&
			Array.isArray(altTextResult.missing) &&
			altTextResult.missing.length > 0
		) {
			hasErrors = true;
			totalIssues += altTextResult.missing.length;
		}
	} catch (error) {
		hasErrors = true;
		logger.error(
			chalk.red(`Error checking image alt text: ${(error as Error).message}`),
		);
	}

	// Display summary
	logger.info(
		boxen(
			hasErrors
				? chalk.yellow(
						`Found ${totalIssues} issues${
							totalFixed > 0 ? `, fixed ${totalFixed}` : ""
						}`,
					)
				: chalk.green(
						"All checks passed! Your blog is in excellent health. 🎉",
					),
			{
				padding: 1,
				margin: { top: 1, bottom: 0, left: 0, right: 0 },
				borderColor: hasErrors ? "yellow" : "green",
				borderStyle: "round",
				title: "Doctor Summary",
				titleAlignment: "center",
			},
		),
	);

	if (hasErrors && !opts.fix) {
		logger.info(
			chalk.cyan(
				"\nRun with --fix to attempt to automatically fix issues that can be fixed.",
			),
		);
	}

	return { totalIssues, totalFixed, hasErrors };
}
