# BlogForge 🖋️

The craftsman's toolkit for Nuxt Content v3 blogs – forge, shape, and perfect your content with precision.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
[![npm](https://img.shields.io/npm/v/blogforge.svg?style=flat&color=cb3837)](https://www.npmjs.com/package/blogforge)
![GitHub release (latest by date)](https://img.shields.io/github/v/release/lord007tn/BlogForge)

## Overview

BlogForge is a powerful command-line tool designed to streamline the content management process for Nuxt Content v3 blogs. It provides a comprehensive set of commands for managing articles, authors, categories, and images, making it easier to maintain a high-quality blog.

## Features

- 📝 **Article Management**: Create, edit, list, publish/unpublish, validate, and search articles
- 👤 **Author Management**: Add, edit, list, and delete authors
- 🏷️ **Category Management**: Create and edit content categories
- 🖼️ **Image Management**: Optimize, convert, validate, and manage blog images
- 🔍 **SEO Tools**: Check articles for SEO improvements
- 🩺 **Doctor Commands**: Diagnose and fix common issues in your blog content
- 🌐 **Multilingual Support**: Manage content in multiple languages
- 🧙‍♂️ **Interactive Mode**: User-friendly interactive command-line interface

## Installation

```bash
# Install globally
npm install -g blogforge

# Or use with npx
npx blogforge
```
## Quickstart

Initialize a new project:

```bash
npx blogforge init
```

This will guide you through setting up your blog structure and creating sample content.

## Usage

### Interactive Mode

The easiest way to use BlogForge is in interactive mode:

```bash
npx blogforge
```

![Interactive Mode Demo](https://raw.githubusercontent.com/yourusername/blogforge/main/docs/images/interactive-demo.gif)

This launches an interactive menu where you can select commands to run.

### Command Line Mode

You can also run specific commands directly:

```bash
# Create a new article
npx blogforge articles create --title="My New Article" --description="This is my article description" --author="johndoe" --tags="nuxt,content,blog" --locale="en"

# List all articles
npx blogforge articles list

# Run the doctor to diagnose issues
npx blogforge doctor
```

## Command Groups

- `articles` - Article management commands
- `author` - Author management commands
- `category` - Category management commands
- `images` - Image management tools
- `doctor` - Run diagnostic checks on your blog content

## Configuration

BlogForge is configurable through a `blogforge.config.js`, `blogforge.config.ts`, or `blogforge.config.json` file. Create this file in your project root:

```js
// blogforge.config.js
export default {
  // Directory structure
  directories: {
    articles: "articles",
    authors: "authors",
    categories: "categories",
    images: "images",
  },

  // Multilingual settings
  multilingual: true,
  languages: ["en", "ar"],
  defaultLanguage: "ar",

  // Schema extensions
  schemaExtensions: {
    article: {
      // Add custom fields
      customField: "string",
    },
    author: {},
    category: {},
  },

  // Default values
  defaultValues: {
    article: {
      isDraft: true,
    },
  },
};
```

## Requirements

- Node.js 20.x or higher
- A Nuxt Content v3 project (with content.config.ts or nuxt.config.ts)

## Documentation

For detailed command documentation, see the [docs](./docs/) directory. This includes:

- [General Commands](./docs/general.md)
- [Articles](./docs/articles.md)
- [Authors](./docs/authors.md)
- [Categories](./docs/category.md)
- [Images](./docs/images.md)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

## Development Workflow

1. **Fork** the repository
2. **Clone** your fork locally
3. **Create a feature branch**: `git checkout -b feat/your-feature-name`
4. **Make your changes** following our [coding standards](CONTRIBUTING.md)
5. **Commit** using [conventional commits](https://www.conventionalcommits.org/):
   ```bash
   git commit -m "feat(cli): add new article template command"
   ```
6. **Push** to your fork: `git push origin feat/your-feature-name`
7. **Create a Pull Request** with a clear description

### Quick Commands

```bash
# Install dependencies
npm install

# Lint code
npm run lint

# Build project
npm run build

# Run in development
npm run dev
```

### Branch Protection

Our `master` branch is protected with the following rules:
- ✅ Pull request reviews required (1 approval)
- ✅ Status checks must pass (Build & Test, PR Validation)
- ✅ Branches must be up to date
- ✅ Conversations must be resolved
- ❌ Force pushes disabled

### Release Process

We use [Release Drafter](https://github.com/release-drafter/release-drafter) to automatically generate release notes from Pull Requests. The release process is:

1. **Merge PRs** to `master` - this updates the release draft
2. **Review** the generated release notes
3. **Publish** the release - this triggers npm publishing

For more details, see [CONTRIBUTING.md](CONTRIBUTING.md).

## BlogForge CLI: Future Implementation Roadmap

### AI SDK Integration

- [ ] Integrate an AI SDK to enable advanced content operations.
- [ ] `write`: Generate new articles, categories, or author bios using AI.
- [ ] `expand`: Enrich existing content with more details, examples, or explanations.
- [ ] `analyze`: Review articles/categories for quality, tone, and SEO best practices.
- [ ] `correct`: Automatically fix grammar, spelling, and style issues in markdown files.

### Model Context Protocol (MCP) Support

- [ ] Add MCP server/client integration for collaborative and context-aware content editing.
- [ ] Enable real-time suggestions and AI-driven workflows using MCP.

### CLI Stability Improvements

- [ ] Enhance error handling and user feedback throughout the CLI.
- [ ] Add comprehensive tests for all commands and utilities.
- [ ] Improve logging and diagnostics for easier troubleshooting.
- [ ] Ensure compatibility with latest Node.js and Nuxt Content versions.

### Additional Planned Features

- [ ] Interactive onboarding and guided setup for new users.
- [ ] Advanced linting and formatting for markdown and frontmatter.
- [ ] Batch operations for bulk content management.
- [ ] Translation helper: Integrate with translation systems and auto-translate content.

### Automatic Cross-Linking Between Articles

- [ ] Enable the CLI to automatically create cross-links between articles.
- [ ] The CLI will read all articles, analyze references and related topics, and edit content to add internal links (e.g., "See also: ...") between relevant articles.

### Nuxt Content Collection Sources Support

- [ ] Support defining collection sources via glob patterns.
- [ ] Allow configuring `include`, `exclude`, `prefix`, and `cwd` for local collection sources.
- [ ] Enable fetching content from remote git repositories, including support for `repository`, `authToken`, and `authBasic` configurations.

### Import & Export Functionality

- [ ] Import and export content to and from popular platforms:
  - **Ghost** (primary focus)
  - **WordPress**
  - **Medium**
- [ ] Easily get your content ready for publishing on these platforms or import existing content from them.
- [ ] Support for platform-specific frontmatter and formatting.
- [ ] Export options for JSON, CSV, and HTML.

### Blog Analytics (Planned)

- [ ] Powerful analytics commands to provide insights into your content structure and quality, without requiring external analytics services.
- [ ] Command structure:
  - `blogsmith analytics overview` – General content statistics
  - `blogsmith analytics content` – Content structure insights
  - `blogsmith analytics authors` – Author contribution metrics
  - `blogsmith analytics categories` – Category distribution
  - `blogsmith analytics seo` – SEO readiness assessment
  - `blogsmith analytics trends` – Content publishing trends
- [ ] Visually appealing console output using tables, ASCII charts, and color-coded metrics.
- [ ] Export analytics reports as JSON, CSV, or HTML.
- [ ] Filter and compare metrics by date, author, category, etc.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgements

- [Nuxt Content](https://content.nuxtjs.org/) - The content module for Nuxt.js
- [Citty](https://github.com/unjs/citty) - CLI framework used in this project
- [All other dependencies](package.json)
