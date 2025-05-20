# Images Commands

This section covers all commands related to managing images within your blog content. These commands help optimize images, ensure they are correctly referenced, and maintain good SEO practices.

---

# Convert Image Format

**Command:** `blogforge images convert`

This command allows you to convert images from one format to another (e.g., PNG to WebP, JPEG to AVIF). This can be useful for optimizing image sizes and using modern, efficient formats.

**Usage:**

```bash
blogforge images convert <path-to-image> --to <format> [options]
```

**Arguments:**

- **`<path-to-image>`**: (Required) The path to the image file you want to convert.
- **`--to <format>`**: (Required) The target format to convert the image to (e.g., `webp`, `jpeg`, `png`, `avif`).

**Options:**

- **`--quality <value>`**: (Optional) Set the quality for lossy formats (e.g., 0-100 for JPEG/WebP).
- **`--output <output-path>`**: (Optional) Specify the output directory or filename. If not provided, the converted image might be saved in the same directory with a new extension or a modified name.
- **`--replace`**: (Optional) If specified, the original file will be replaced by the converted image. Use with caution.

**Examples:**

```bash
blogforge images convert ./static/images/my-image.png --to webp --quality 80
```

This command converts `my-image.png` to WebP format with 80% quality.

```bash
blogforge images convert images/old-logo.jpeg --to png --output assets/new-logo.png
```

This command converts `old-logo.jpeg` to PNG and saves it as `assets/new-logo.png`.

---

# Find Unused Images

**Command:** `blogforge images find-unused`

This command scans your project (articles, templates, etc.) to identify images in your assets/images directory that are no longer referenced anywhere. This helps in cleaning up storage and removing clutter.

**Usage:**

```bash
blogforge images find-unused [options]
```

**Options:**

- **`--images-dir <path>`**: (Optional) Specify the directory where your images are stored (e.g., `public/images/`). Defaults to a common location.
- **`--content-dir <path>`**: (Optional) Specify the directory containing your content files (e.g., `content/articles/`). Defaults to a common location.
- **`--delete`**: (Optional) If specified, prompts for confirmation and then deletes the unused images found. Use with extreme caution and ensure you have backups.

**Examples:**

```bash
blogforge images find-unused --images-dir static/img --content-dir src/pages
```

This command lists all images in `static/img` that are not referenced in `src/pages`.

```bash
blogforge images find-unused --delete
```

This command finds unused images in the default directories and asks for confirmation before deleting them.

---

# Optimize Images

**Command:** `blogforge images optimize`

This command compresses and optimizes images to reduce their file size without significant loss of quality. This is crucial for website performance.

The `optimize` process performs the following steps:
1.  **Initialization**:
    *   Sets a default width of 1200px and quality of 80 if not specified by the user via options.
    *   Determines the image directory, defaulting to `public/images`. This can be overridden using the `--directory` option.
    *   If the image directory doesn't exist, it attempts to create it.
2.  **Image Discovery**:
    *   Reads the specified directory and filters for image files (JPEG, PNG, GIF, WebP, AVIF).
    *   If no images are found, it warns the user and exits.
3.  **Image Processing (for each image)**:
    *   Reads the image file.
    *   Checks the original file size. If it's less than 10KB, it skips the image, assuming it's already small enough.
    *   Uses the `sharp` library to process the image:
        *   **Resizes** the image to the specified `width` (default 1200px), without enlarging it if it's already smaller. This can be controlled with the `--width` option.
        *   **Re-encodes** the image with the specified `quality` (default 80). This can be controlled with the `--quality` option.
            *   For JPEGs: uses `mozjpeg` for better compression.
            *   For PNGs: uses a `compressionLevel` of 9 (this is a fixed value in the current implementation and not directly tied to the `--quality` option for PNGs, though `sharp` might interpret quality for PNGs differently, often relating to quantization).
            *   For WebP and AVIF: applies the specified quality.
            *   For GIFs: it only resizes to preserve animation, without re-encoding.
        *   Unsupported formats are skipped.
    *   Writes the optimized image buffer back to the original file path (overwriting the original).
    *   **Calculates Savings**:
        *   Compares the new size with the original size.
        *   If the optimized image is smaller (`savedBytes > 0`), it records the saved bytes and increments the success count.
        *   If the optimization doesn't result in a smaller file, it reverts the file to its original content to avoid increasing file size.
4.  **Results**:
    *   After processing all images, it displays a summary:
        *   The number of successfully optimized images out of the total found.
        *   The total space saved, formatted in bytes, KB, or MB.
    *   If `verbose` mode is enabled (using the `--verbose` flag), it logs details for each file:
        *   Success: `✓ image.jpg: X% smaller (OriginalKB → NewKB)`
        *   No improvement: `⚠ image.png: no improvements (kept original)`
        *   Error: `✖ image.gif: error message`

In essence, the `optimize` command aims to reduce the file size of your images by resizing them and applying compression, while trying to maintain a good level of quality. It overwrites the original images with their optimized versions if a size reduction is achieved.

**Usage:**

```bash
blogforge images optimize <path-to-image-or-directory> [options]
```

**Arguments:**

- **`<path-to-image-or-directory>`**: (Required) The path to a specific image file or a directory containing images to optimize.

**Options:**

- **`--quality <value>`**: (Optional) Set the quality for lossy compression (e.g., 0-100).
- **`--format <format>`**: (Optional) Specify the image format(s) to target for optimization (e.g., `jpeg`, `png`, `webp`).
- **`--recursive`**: (Optional) If a directory is provided, process images in subdirectories as well.
- **`--replace`**: (Optional) If specified, the original images will be replaced with their optimized versions. It's highly recommended to back up your images before using this option.

**Examples:**

```bash
blogforge images optimize ./public/images/hero.jpg --quality 75
```

This command optimizes `hero.jpg` with a quality setting of 75.

```bash
blogforge images optimize ./assets/images --recursive --replace
```

This command optimizes all images in `./assets/images` and its subdirectories, replacing the originals.

---

# Suggest Alt Text for Images

**Command:** `blogforge images suggest-alt`

This command analyzes an image and suggests appropriate alternative (alt) text for accessibility and SEO. It might use AI/ML services or image analysis techniques.

**Usage:**

```bash
blogforge images suggest-alt <path-to-image> [options]
```

**Arguments:**

- **`<path-to-image>`**: (Required) The path to the image for which you want alt text suggestions.

**Options:**

- **`--language <lang_code>`**: (Optional) Specify the language for the suggested alt text (e.g., `en`, `es`).
- **`--update-markdown <md-file>`**: (Optional) If a Markdown file path is provided, the command might attempt to find the image reference and update its alt text directly (use with caution).

**Examples:**

```bash
blogforge images suggest-alt assets/images/product-photo.png
```

This command provides alt text suggestions for `product-photo.png`.

```bash
blogforge images suggest-alt public/blog/header.jpg --language en --update-markdown content/articles/my-post.md
```

This command suggests alt text in English for `header.jpg` and offers to update its reference in `my-post.md`.

---

# Validate Image References

**Command:** `blogforge images validate-references`

This command checks your content files (e.g., Markdown articles) for broken or incorrect image references. It ensures that all `<img>` tags or Markdown image links point to existing image files.

**Usage:**

```bash
blogforge images validate-references [options]
```

**Options:**

- **`--content-dir <path>`**: (Optional) Specify the directory containing your content files (e.g., `content/`). Defaults to a common location.
- **`--images-dir <path>`**: (Optional) Specify the directory where your images are stored (e.g., `public/images/`). Defaults to a common location.
- **`--fix`**: (Optional) If specified, the command might attempt to automatically fix simple issues, like incorrect case in filenames, if a clear match is found. Use with caution.

**Examples:**

```bash
blogforge images validate-references --content-dir src/posts --images-dir static/media
```

This command validates all image references in `src/posts` against images in `static/media`.

```bash
blogforge images validate-references
```

This command validates image references using default content and image directories.
