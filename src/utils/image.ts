import path from "node:path";
import fs from "fs-extra";

/**
 * Recursively get all Markdown files from a directory and its subdirectories
 */
export async function getMarkdownFiles(
	dir: string,
	base = "",
): Promise<string[]> {
	const files = await fs.readdir(dir);
	const result: string[] = [];

	for (const file of files) {
		const filePath = path.join(dir, file);
		const stat = await fs.stat(filePath);
		const relativePath = base ? path.join(base, file) : file;

		if (stat.isDirectory()) {
			result.push(...(await getMarkdownFiles(filePath, relativePath)));
		} else if (file.endsWith(".md")) {
			result.push(relativePath);
		}
	}

	return result;
}

/**
 * Recursively get all image paths from a directory
 */
export async function getAllImagePaths(
	dir: string,
	base = "",
): Promise<string[]> {
	const imageExtensions = [
		".jpg",
		".jpeg",
		".png",
		".gif",
		".webp",
		".avif",
		".svg",
	];
	const files = await fs.readdir(dir);
	const result: string[] = [];

	for (const file of files) {
		const filePath = path.join(dir, file);
		const stat = await fs.stat(filePath);
		const relativePath = base ? path.join(base, file) : file;

		if (stat.isDirectory()) {
			result.push(...(await getAllImagePaths(filePath, relativePath)));
		} else if (
			imageExtensions.some((ext) => file.toLowerCase().endsWith(ext))
		) {
			result.push(relativePath);
		}
	}

	return result;
}

/**
 * Check if a URL is external
 */
export function isExternalUrl(url: string): boolean {
	return (
		url.startsWith("http:") || url.startsWith("https:") || url.startsWith("//")
	);
}

/**
 * Check if an image is available in the filesystem
 */
export function isImageAvailable(
	imagePath: string,
	availableImagePaths: string[],
	baseImageDir: string,
	availableImageSet?: Set<string>,
): boolean {
	// Remove query/hash parameters if present
	const pathWithoutParams = imagePath.split("?")[0].split("#")[0];
	// Remove any leading slashes or 'public/' or 'images/'
	const normalizedPath = pathWithoutParams
		.replace(/^\/+/, "")
		.replace(/^public\//, "")
		.replace(/^images\//, "");

	// Use Set for faster lookups if provided
	if (availableImageSet?.has(normalizedPath)) {
		return true;
	}
	// Fallback to array lookup
	if (availableImagePaths.includes(normalizedPath)) {
		return true;
	}

	// Check if the file exists on disk (for absolute certainty)
	const absolutePath = path.join(baseImageDir, normalizedPath);
	if (fs.existsSync(absolutePath)) {
		return true;
	}

	return false;
}
