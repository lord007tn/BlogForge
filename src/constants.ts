import pkg from "../package.json" assert { type: "json" };
export const CLI_NAME = "blogforge";
export const CLI_VERSION = pkg.version;
export const NUXT_CONTENT_MIN_VERSION = "^3.0.0"; // Enforce Nuxt Content v3 or higher

export const SEO_WEIGHTS = {
	title: 0.15,
	description: 0.1,
	keyword: 0.15,
	headings: 0.1,
	links: 0.1,
	readability: 0.1,
	imageAlt: 0.1,
	wordCount: 0.1,
	anchorText: 0.1,
};
