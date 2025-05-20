import path from "node:path";
import chalk from "chalk";
import Table from "cli-table3";
import fs from "fs-extra";
import { SEO_WEIGHTS } from "../../constants";
import {
	extractFrontmatter,
	getFrontMatterEntry,
} from "../../utils/frontmatter";
import { logger } from "../../utils/logger";
import { getProjectPaths } from "../../utils/project";

type SeoCheckOptions = {
	keyword?: string;
	verbose?: boolean;
	file?: string;
};

function checkKeywordInText(text: string, keyword: string): boolean {
	if (!keyword || !text) return false;
	return new RegExp(`\\b${keyword}\\b`, "i").test(text);
}

function analyzeTitle(
	title: string,
	keyword: string,
): {
	score: number;
	recommendation: string;
	length: number;
	keywordPresent: boolean;
	pass: boolean;
} {
	const length = title?.length || 0;
	const keywordPresent = checkKeywordInText(title, keyword);
	let score = 0;
	let recommendation = "";
	if (!title) {
		recommendation = "Missing title.";
	} else if (length < 40) {
		recommendation = "Title is too short. Aim for 40-60 characters.";
	} else if (length > 65) {
		recommendation = "Title is too long. Keep it under 60-65 characters.";
	} else if (!keywordPresent) {
		recommendation = "Add the main keyword to the title.";
		score = 0.5;
	} else {
		score = 1;
		recommendation = "Good title length and keyword present.";
	}
	return { score, recommendation, length, keywordPresent, pass: score === 1 };
}

function analyzeDescription(
	description: string | undefined,
	keyword: string,
): {
	score: number;
	recommendation: string;
	length: number;
	keywordPresent: boolean;
	pass: boolean;
} {
	if (!description) {
		return {
			score: 0,
			recommendation: "Missing meta description.",
			length: 0,
			keywordPresent: false,
			pass: false,
		};
	}
	const length = description.length;
	const keywordPresent = checkKeywordInText(description, keyword);
	if (length < 120) {
		return {
			score: 0,
			recommendation: "Description is too short. Aim for 120-160 characters.",
			length,
			keywordPresent,
			pass: false,
		};
	}
	if (length > 170) {
		return {
			score: 0,
			recommendation:
				"Description is too long. Keep it under 160-170 characters.",
			length,
			keywordPresent,
			pass: false,
		};
	}
	if (!keywordPresent) {
		return {
			score: 0.5,
			recommendation: "Add the main keyword to the description.",
			length,
			keywordPresent,
			pass: false,
		};
	}
	return {
		score: 1,
		recommendation: "Good description length and keyword present.",
		length,
		keywordPresent,
		pass: true,
	};
}

function analyzeKeywordUsage(
	content: string,
	keyword: string,
): {
	density: string;
	recommendation: string;
	score: number;
	inFirstParagraph: boolean;
	pass: boolean;
} {
	if (!keyword)
		return {
			density: "0",
			recommendation: "No keyword provided.",
			score: 0,
			inFirstParagraph: false,
			pass: false,
		};
	const words = content.split(/\s+/g).filter(Boolean).length;
	const count = (content.match(new RegExp(keyword, "gi")) || []).length;
	const density = words ? (count / words) * 100 : 0;
	const firstParagraph = content.split(/\n\n+/)[0] || "";
	const inFirstParagraph = checkKeywordInText(firstParagraph, keyword);
	let recommendation = "";
	let score = 0;
	if (density < 0.5) {
		recommendation =
			"Keyword density is low. Consider using the main keyword more.";
	} else if (density > 2.5) {
		recommendation = "Keyword density is high. Avoid keyword stuffing.";
	} else if (!inFirstParagraph) {
		recommendation = "Add the main keyword to the first paragraph.";
		score = 0.5;
	} else {
		recommendation =
			"Keyword density is optimal and present in first paragraph.";
		score = 1;
	}
	return {
		density: density.toFixed(2),
		recommendation,
		score,
		inFirstParagraph,
		pass: score === 1,
	};
}

function analyzeHeadings(
	content: string,
	keyword: string,
): {
	h1: number;
	h2: number;
	h3: number;
	recommendation: string;
	score: number;
	keywordInHeading: boolean;
	pass: boolean;
} {
	const h1 = (content.match(/^# /gm) || []).length;
	const h2 = (content.match(/^## /gm) || []).length;
	const h3 = (content.match(/^### /gm) || []).length;
	const headings = [...content.matchAll(/^#+ (.+)$/gm)].map((m) => m[1]);
	const keywordInHeading = headings.some((h) => checkKeywordInText(h, keyword));
	let recommendation = "";
	let score = 1;
	if (h1 !== 1) {
		recommendation += `Should have exactly one H1 heading (found ${h1}). `;
		score = 0;
	}
	if (h2 < 1) {
		recommendation += "Add at least one H2 heading. ";
		score = 0;
	}
	if (!keywordInHeading) {
		recommendation += "Add the main keyword to at least one heading. ";
		score = Math.min(score, 0.5);
	}
	if (h1 + h2 + h3 < 3) {
		recommendation += "Consider adding more heading structure. ";
		score = Math.min(score, 0.5);
	}
	if (!recommendation) recommendation = "Heading structure looks good.";
	return {
		h1,
		h2,
		h3,
		recommendation,
		score,
		keywordInHeading,
		pass: score === 1,
	};
}

function analyzeWordCount(content: string): {
	wordCount: number;
	score: number;
	recommendation: string;
	pass: boolean;
} {
	const wordCount = content.split(/\s+/g).filter(Boolean).length;
	if (wordCount < 300) {
		return {
			wordCount,
			score: 0,
			recommendation: "Content is too short. Aim for at least 300 words.",
			pass: false,
		};
	}
	return {
		wordCount,
		score: 1,
		recommendation: "Good content length.",
		pass: true,
	};
}

function analyzeAnchorText(content: string): {
	descriptive: number;
	nonDescriptive: number;
	score: number;
	recommendation: string;
	pass: boolean;
} {
	const linkMatches = [...content.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)];
	const nonDescriptive = linkMatches.filter((m) =>
		/^(here|click|this|link)$/i.test(m[1].trim()),
	).length;
	const descriptive = linkMatches.length - nonDescriptive;
	let score = 1;
	let recommendation = "";
	if (nonDescriptive > 0) {
		recommendation = `Found ${nonDescriptive} non-descriptive anchor texts (e.g., 'here', 'click'). Use descriptive text for links.`;
		score = descriptive > 0 ? 0.5 : 0;
	} else {
		recommendation = "All anchor texts are descriptive.";
	}
	return {
		descriptive,
		nonDescriptive,
		score,
		recommendation,
		pass: score === 1,
	};
}

function analyzeImageAlt(
	content: string,
	keyword: string,
): {
	totalImages: number;
	missingAlt: number;
	recommendation: string;
	score: number;
	keywordInAlt: boolean;
	pass: boolean;
} {
	const imageMatches = [...content.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g)];
	if (imageMatches.length === 0) {
		return {
			score: 1,
			recommendation: "No images found.",
			totalImages: 0,
			missingAlt: 0,
			keywordInAlt: false,
			pass: true,
		};
	}
	const missingAlt = imageMatches.filter(
		(match) => !match[1] || match[1].trim() === "",
	);
	const missingCount = missingAlt.length;
	const keywordInAlt = imageMatches.some((match) =>
		checkKeywordInText(match[1], keyword),
	);
	let recommendation = "";
	let score = 1;
	if (missingCount > 0) {
		const percentage = Math.round((missingCount / imageMatches.length) * 100);
		recommendation = `Missing alt text for ${missingCount} out of ${imageMatches.length} images (${percentage}%).`;
		score = imageMatches.length > missingCount ? 0.5 : 0;
	} else if (!keywordInAlt) {
		recommendation = "Add the main keyword to at least one image alt text.";
		score = 0.5;
	} else {
		recommendation = "All images have alt text and keyword present.";
	}
	return {
		totalImages: imageMatches.length,
		missingAlt: missingCount,
		recommendation,
		score,
		keywordInAlt,
		pass: score === 1,
	};
}

function analyzeLinks(content: string): {
	internal: number;
	external: number;
	recommendation: string;
	score: number;
} {
	// Remove unnecessary escape for '/'
	const internal = (content.match(/\]\(\/?[\w\-\/]+\)/g) || []).length;
	const external = (content.match(/\]\(https?:\/\//g) || []).length;
	let recommendation = "";
	let score = 1;
	if (internal < 1) {
		recommendation += "Add at least one internal link. ";
		score = Math.min(score, 0.5);
	}
	if (external < 1) {
		recommendation += "Add at least one external link.";
		score = Math.min(score, 0.5);
	}
	if (!recommendation)
		recommendation = "Good mix of internal and external links.";
	return { internal, external, recommendation, score };
}

function analyzeReadability(content: string): {
	avgWordsPerSentence: string;
	longSentencesCount: number;
	recommendation: string;
	score: number;
} {
	// Simple readability calculation based on sentence length
	const sentences = content.split(/[.!?]+/).filter((s) => s.trim().length > 0);
	if (sentences.length === 0) {
		return {
			score: 0,
			recommendation: "No sentences found in content.",
			avgWordsPerSentence: "0",
			longSentencesCount: 0,
		};
	}
	const wordCount = sentences.reduce(
		(count, sentence) => count + sentence.split(/\s+/).filter(Boolean).length,
		0,
	);
	const avgWordsPerSentence = wordCount / sentences.length;
	let recommendation = "";
	let score = 1;
	if (avgWordsPerSentence > 25) {
		recommendation =
			"Sentences are too long. Try to keep average sentence length below 25 words.";
		score = 0;
	} else if (avgWordsPerSentence < 10) {
		recommendation =
			"Sentences are very short. Consider varying sentence length for better flow.";
		score = 0.5;
	} else {
		recommendation = "Good average sentence length.";
	}
	const longSentencesCount = sentences.filter(
		(s) => s.split(/\s+/).filter(Boolean).length > 30,
	).length;
	if (longSentencesCount > 3) {
		recommendation += ` Found ${longSentencesCount} very long sentences (>30 words).`;
		score = Math.min(score, 0.5);
	}
	return {
		avgWordsPerSentence: avgWordsPerSentence.toFixed(1),
		longSentencesCount,
		recommendation,
		score,
	};
}

// Utility to wrap/truncate text to a max width
function wrapText(text: string, width: number): string[] {
	if (!text) return [""];
	const words = text.split(" ");
	const lines: string[] = [];
	let line = "";
	for (const word of words) {
		if ((line + word).length > width) {
			lines.push(line.trim());
			line = "";
		}
		line += `${word} `;
	}
	if (line) lines.push(line.trim());
	return lines;
}

export async function seoCheck(opts: SeoCheckOptions) {
	const spinner = logger.spinner("Initializing SEO check");

	// Get project paths
	let articlesDir: string;
	try {
		const paths = await getProjectPaths(process.cwd());
		articlesDir = paths.articles;
		spinner.text = "Checking articles directory";
	} catch (e) {
		logger.spinnerError(`Project validation failed: ${(e as Error).message}`);
		return;
	}

	// Check if articles directory exists
	if (!(await fs.pathExists(articlesDir))) {
		logger.spinnerError("No articles directory found.");
		return;
	}

	// Get article files - if specific file is provided, use only that
	let files: string[];

	if (opts.file) {
		const filePath = path.join(articlesDir, opts.file);

		if (await fs.pathExists(filePath)) {
			files = [opts.file];
		} else {
			logger.spinnerError(`File not found: ${opts.file}`);
			return;
		}
	} else {
		// Get all article files
		files = (await fs.readdir(articlesDir)).filter((f) => f.endsWith(".md"));
	}

	if (!files.length) {
		logger.spinnerWarn("No articles found to analyze.");
		return;
	}

	spinner.text = `Analyzing ${files.length} article(s) for SEO`;

	// Array to store results
	const results: Array<{
		file: string;
		title: string;
		scores: Record<
			string,
			{ score: number; recommendation: string; [key: string]: any }
		>;
		overallScore: number;
	}> = [];

	for (const file of files) {
		if (opts.verbose) {
			spinner.text = `Analyzing ${file}`;
		}

		const filePath = path.join(articlesDir, file);
		const fileContent = await fs.readFile(filePath, "utf-8");
		const { frontmatter, content } = extractFrontmatter(fileContent);

		// Get keyword for this article
		const keyword =
			opts.keyword ||
			(frontmatter.keywords
				? String(frontmatter.keywords).split(",")[0].trim()
				: "");

		// Extract title and description
		const title = getFrontMatterEntry(frontmatter, "title");
		const description = getFrontMatterEntry(frontmatter, "description");

		// Collect scores from various checks
		const scores: Record<string, any> = {
			title: analyzeTitle(title, keyword),
			description: analyzeDescription(description, keyword),
			keyword: analyzeKeywordUsage(content, keyword),
			headings: analyzeHeadings(content, keyword),
			links: analyzeLinks(content),
			readability: analyzeReadability(content),
			imageAlt: analyzeImageAlt(content, keyword),
			wordCount: analyzeWordCount(content),
			anchorText: analyzeAnchorText(content),
		};

		// Calculate weighted overall score
		let weightedScore = 0;
		let totalWeight = 0;
		for (const [factor, result] of Object.entries(scores)) {
			const weight = SEO_WEIGHTS[factor as keyof typeof SEO_WEIGHTS] || 0;
			weightedScore += (result.score || 0) * weight;
			totalWeight += weight;
		}
		const overallScore = totalWeight > 0 ? weightedScore / totalWeight : 0;

		results.push({
			file,
			title,
			scores,
			overallScore,
		});
	}

	spinner.stop();

	// Sort results by overall score, lowest first
	results.sort((a, b) => a.overallScore - b.overallScore);

	// Display results
	console.log(chalk.bold.cyan("\n🔍 SEO Analysis Results\n"));

	for (const result of results) {
		// Convert score to a letter grade
		let grade: string;
		if (result.overallScore >= 0.9) grade = "A";
		else if (result.overallScore >= 0.8) grade = "B";
		else if (result.overallScore >= 0.7) grade = "C";
		else if (result.overallScore >= 0.6) grade = "D";
		else grade = "F";

		const scoreColor =
			result.overallScore >= 0.8
				? chalk.green
				: result.overallScore >= 0.6
					? chalk.yellow
					: chalk.red;

		console.log(
			chalk.bold(`\n${result.title} ${chalk.gray(`(${result.file})`)}`),
		);
		console.log(
			scoreColor(
				`Overall SEO Score: ${Math.round(
					result.overallScore * 100,
				)}% (Grade ${grade})\n`,
			),
		);

		const colWidths = [18, 28, 54, 14];
		const table = new Table({
			head: [
				chalk.cyan.bold("Factor"),
				chalk.cyan.bold("Result"),
				chalk.cyan.bold("Recommendation"),
				chalk.cyan.bold("Status"),
			],
			colWidths,
			wordWrap: false, // We'll handle wrapping manually
			style: {
				head: [],
				border: [],
			},
			chars: {
				top: "═",
				"top-mid": "╤",
				"top-left": "╔",
				"top-right": "╗",
				bottom: "═",
				"bottom-mid": "╧",
				"bottom-left": "╚",
				"bottom-right": "╝",
				left: "║",
				"left-mid": "╟",
				mid: "─",
				"mid-mid": "┼",
				right: "║",
				"right-mid": "╢",
				middle: "│",
			},
		});

		function statusIcon(score: number) {
			if (score === 1) return chalk.green.bold("✅ PASS");
			if (score >= 0.5) return chalk.yellow.bold("⚠️ PARTIAL");
			return chalk.red.bold("❌ FAIL");
		}

		function pushPrettyRow(
			factor: string,
			result: string,
			recommendation: string,
			score: number,
		) {
			const status = statusIcon(score);
			const cells = [
				wrapText(factor, colWidths[0]),
				wrapText(result, colWidths[1]),
				wrapText(recommendation, colWidths[2]),
				[status],
			];
			// Find the max number of lines in this row
			const maxLines = Math.max(...cells.map((lines) => lines.length));
			// Pad each cell's lines to maxLines
			const paddedCells = cells.map((lines) => {
				const padCount = maxLines - lines.length;
				return lines.concat(Array(padCount).fill(""));
			});
			// For each line, build the row and push to the table
			for (let i = 0; i < maxLines; i++) {
				// Only color non-empty lines for better readability
				const row = paddedCells.map((lines, idx) => {
					const cell = lines[i];
					if (!cell) return "";
					if (score === 1) return chalk.green(cell);
					if (score >= 0.5) return chalk.yellow(cell);
					return chalk.red(cell);
				});
				table.push(row);
			}
		}

		pushPrettyRow(
			"Title",
			`${result.scores.title.length} chars${
				result.scores.title.keywordPresent ? ", keyword" : ""
			}`,
			result.scores.title.recommendation,
			result.scores.title.score,
		);
		pushPrettyRow(
			"Description",
			`${result.scores.description.length} chars${
				result.scores.description.keywordPresent ? ", keyword" : ""
			}`,
			result.scores.description.recommendation,
			result.scores.description.score,
		);
		pushPrettyRow(
			"Keyword",
			`Density: ${result.scores.keyword.density}%, first para: ${
				result.scores.keyword.inFirstParagraph ? "yes" : "no"
			}`,
			result.scores.keyword.recommendation,
			result.scores.keyword.score,
		);
		pushPrettyRow(
			"Headings",
			`H1: ${result.scores.headings.h1}, H2: ${
				result.scores.headings.h2
			}, keyword: ${result.scores.headings.keywordInHeading ? "yes" : "no"}`,
			result.scores.headings.recommendation,
			result.scores.headings.score,
		);
		pushPrettyRow(
			"Links",
			`Int: ${result.scores.links.internal}, Ext: ${result.scores.links.external}`,
			result.scores.links.recommendation,
			result.scores.links.score,
		);
		pushPrettyRow(
			"Anchor Text",
			`Descriptive: ${result.scores.anchorText.descriptive}, Non-desc: ${result.scores.anchorText.nonDescriptive}`,
			result.scores.anchorText.recommendation,
			result.scores.anchorText.score,
		);
		pushPrettyRow(
			"Readability",
			`~${result.scores.readability.avgWordsPerSentence} words/sentence${
				result.scores.readability.longSentencesCount > 0
					? `, ${result.scores.readability.longSentencesCount} long`
					: ""
			}`,
			result.scores.readability.recommendation,
			result.scores.readability.score,
		);
		pushPrettyRow(
			"Images",
			`${
				result.scores.imageAlt.totalImages - result.scores.imageAlt.missingAlt
			}/${result.scores.imageAlt.totalImages} with alt${
				result.scores.imageAlt.keywordInAlt ? ", keyword" : ""
			}`,
			result.scores.imageAlt.recommendation,
			result.scores.imageAlt.score,
		);
		pushPrettyRow(
			"Word Count",
			`${result.scores.wordCount.wordCount} words`,
			result.scores.wordCount.recommendation,
			result.scores.wordCount.score,
		);

		console.log(table.toString());

		// Checklist of actionable items
		const issues = Object.entries(result.scores)
			.filter(([_, check]) => check.score < 1)
			.sort((a, b) => a[1].score - b[1].score);

		if (issues.length > 0) {
			console.log(chalk.yellow("\nActionable Checklist:"));
			for (const [factor, check] of issues) {
				console.log(
					`${chalk.red("•")} ${chalk.bold(
						factor.charAt(0).toUpperCase() + factor.slice(1),
					)}: ${check.recommendation}`,
				);
			}
		}
	}

	console.log(chalk.bold.cyan("\n📋 Summary\n"));

	// Summary table
	const summaryTable = new Table({
		head: [
			chalk.cyan.bold("Article"),
			chalk.cyan.bold("Score"),
			chalk.cyan.bold("Grade"),
		],
		style: { compact: true, head: [] },
		colWidths: [32, 10, 8],
		wordWrap: true,
		chars: {
			top: "═",
			"top-mid": "╤",
			"top-left": "╔",
			"top-right": "╗",
			bottom: "═",
			"bottom-mid": "╧",
			"bottom-left": "╚",
			"bottom-right": "╝",
			left: "║",
			"left-mid": "╟",
			mid: "─",
			"mid-mid": "┼",
			right: "║",
			"right-mid": "╢",
			middle: "│",
		},
	});

	for (const result of results) {
		let grade: string;
		if (result.overallScore >= 0.9) grade = chalk.green("A");
		else if (result.overallScore >= 0.8) grade = chalk.green("B");
		else if (result.overallScore >= 0.7) grade = chalk.yellow("C");
		else if (result.overallScore >= 0.6) grade = chalk.yellow("D");
		else grade = chalk.red("F");

		summaryTable.push([
			result.title.length > 30
				? `${result.title.substring(0, 27)}...`
				: result.title,
			`${Math.round(result.overallScore * 100)}%`,
			grade,
		]);
	}

	console.log(summaryTable.toString());
}
