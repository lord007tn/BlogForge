export const ArticleCollectionTemplate = (
	zStringLocalized: string,
	zStringLocalizedRequired: string,
	defaultLanguage: string,
	source: string,
) => `articles: defineCollection({
    type: 'page',
    source: '${source}',
    schema: z.object({
      title: ${zStringLocalizedRequired},
      description: ${zStringLocalizedRequired},
      author: z.string().min(1),
      tags: z.array(z.string()).optional(),
      locale: z.string().default('${defaultLanguage}'),
      isDraft: z.boolean().default(true),
      category: z.string().optional(),
      image: z.string().optional(),
      readingTime: z.number().optional(),
      isFeatured: z.boolean().default(false),
      publishedAt: z.date().optional(),
      updatedAt: z.date().optional(),
      series: z.string().optional(),
      seriesIndex: z.number().optional(),
      canonicalURL: z.string().optional(),
      slug: z.string().min(1)
    })
  })`;

// Template for content.config file for Nuxt Content v3
export const ContentConfigTemplate = (
	collections: string[],
) => `import { defineCollection, defineContentConfig, z } from '@nuxt/content'

export default defineContentConfig({
  collections: {
${collections.map((line) => `    ${line}`).join(",\n")}
  }
});
`;

// Markdown template for a new article
export const ArticleMarkdownTemplate = (
	title = "Article Title",
	description = "Short description",
	author = "author-slug",
	tags = ["tag1", "tag2"],
	locale = "en",
	isDraft = true,
	slug = "article-slug",
) => `---
title: ${title}
description: ${description}
author: ${author}
tags: [${tags.join(", ")}]
locale: ${locale}
isDraft: ${isDraft}
slug: ${slug}
---

# ${title}

Write your article content here.
`;

// Markdown template for a new author
export const AuthorMarkdownTemplate = (
	slug = "author-slug",
	name = "Author Name",
	bio = "Short bio",
	avatar = "",
	twitter = "",
	github = "",
	website = "",
	linkedin = "",
	role = "",
) => `---
slug: ${slug}
name: ${name}
bio: ${bio}
avatar: ${avatar}
twitter: ${twitter}
github: ${github}
website: ${website}
linkedin: ${linkedin}
role: ${role}
---
`;

// Markdown template for a new category
export const CategoryMarkdownTemplate = (
	title = "Category Title",
	description = "Short description",
	slug = "category-slug",
	image = "",
	icon = "",
) => `---
title: ${title}
description: ${description}
slug: ${slug}
image: ${image}
icon: ${icon}
---
`;

export const AuthorCollectionTemplate = (
	zStringLocalized: string,
	zStringLocalizedRequired: string,
	source: string,
) => `authors: defineCollection({
    type: 'data',
    source: '${source}',
    schema: z.object({
      slug: z.string().min(1),
      name: ${zStringLocalizedRequired},
      bio: ${zStringLocalizedRequired},
      avatar: z.string().optional(),
      twitter: z.string().optional(),
      github: z.string().optional(),
      website: z.string().optional(),
      linkedin: z.string().optional(),
      role: ${zStringLocalized}
    })
  })`;

export const CategoryCollectionTemplate = (
	zStringLocalized: string,
	zStringLocalizedRequired: string,
	source: string,
) => `categories: defineCollection({
    type: 'data',
    source: '${source}',
    schema: z.object({
      title: ${zStringLocalizedRequired},
      description: ${zStringLocalizedRequired},
      slug: z.string().min(1),
      image: z.string().optional(),
      icon: z.string().optional()
    })
  })`;

// Templates for configuration files
export const ConfigTemplate = (config: Record<string, unknown>) => ({
	ts: `/**
 * blogforge Configuration
 * Generated on ${new Date().toLocaleString()}
 */
export default ${JSON.stringify(config, null, 2)};
`,
	js: `/**
 * blogforge Configuration
 * Generated on ${new Date().toLocaleString()}
 */
export default ${JSON.stringify(config, null, 2)};
`,
	json: JSON.stringify(config, null, 2),
});

// Templates for content schemas with Nuxt Content v3
export const ContentSchemaTemplates = (
	articlesDir: string,
	authorsDir: string,
	categoriesDir: string,
	multilingual: boolean,
	defaultLanguage: string,
) => ({
	imports: `import { defineCollection, defineContentConfig, z } from '@nuxt/content'

// Helper for localized string fields
const localizedString = (isRequired = true) => {
  const schema = z.record(z.string(), z.string());
  return isRequired ? schema : schema.optional();
}`,

	article: `articles: defineCollection({
    type: 'page',
    source: '${articlesDir}/**',
    schema: z.object({
      title: ${multilingual ? "localizedString()" : "z.string()"},
      description: ${multilingual ? "localizedString()" : "z.string()"},
      author: z.string(),
      tags: z.array(z.string()).default([]),
      locale: z.string().default('${defaultLanguage}'),
      idDraft: z.boolean().default(true),
      slug: z.string(),
      category: z.string().optional(),
      image: z.string().optional(),
      readingTime: z.number().optional(),
      isFeatured: z.boolean().default(false),
      publishedAt: z.string().optional(),
      updatedAt: z.string().optional(),
      canonicalURL: z.string().optional(),
    })
  })`,

	author: `authors: defineCollection({
    type: 'data',
    source: '${authorsDir}/**',
    schema: z.object({
      slug: z.string(),
      name: ${multilingual ? "localizedString()" : "z.string()"},
      bio: ${multilingual ? "localizedString()" : "z.string()"},
      avatar: z.string().optional(),
      twitter: z.string().optional(),
      github: z.string().optional(),
      website: z.string().optional(),
      linkedin: z.string().optional(),
      role: ${
				multilingual ? "localizedString().optional()" : "z.string().optional()"
			}
    })
  })`,

	category: `categories: defineCollection({
    type: 'data',
    source: '${categoriesDir}/**',
    schema: z.object({
      title: ${multilingual ? "localizedString()" : "z.string()"},
      description: ${multilingual ? "localizedString()" : "z.string()"},
      slug: z.string(),
      image: z.string().optional(),
      icon: z.string().optional()
    })
  })`,

	configTemplate: `
export default defineContentConfig({
  collections: {
    $COLLECTIONS
  }
});
`,
});

// Templates for sample content
export const SampleContentTemplates = (
	languages: string[],
	defaultLanguage: string,
) => {
	const today = new Date().toISOString().split("T")[0];

	return {
		author: {
			multilingual: `---
slug: "john-doe"
name:
  en: "John Doe"
  ${languages
		.filter((l) => l !== "en")
		.map((lang) => `${lang}: "John Doe (${lang.toUpperCase()})`)
		.join("\n  ")}
bio:
  en: "John Doe is a tech writer with years of experience in the field."
  ${languages
		.filter((l) => l !== "en")
		.map((lang) => `${lang}: "Bio in ${lang.toUpperCase()}"`)
		.join("\n  ")}
avatar: "/images/authors/john-doe.jpg"
twitter: "johndoe"
github: "johndoe"
---
`,
			default: `---
slug: "john-doe"
name: "John Doe"
bio: "John Doe is a tech writer with years of experience in the field."
avatar: "/images/authors/john-doe.jpg"
twitter: "johndoe"
github: "johndoe"
---`,
		},

		category: {
			multilingual: `---
slug: "technology"
title:
  en: "Technology"
  ${languages
		.filter((l) => l !== "en")
		.map((lang) => `${lang}: "Technology (${lang.toUpperCase()})"`)
		.join("\n  ")}
description:
  en: "Articles about the latest in technology"
  ${languages
		.filter((l) => l !== "en")
		.map((lang) => `${lang}: "Description in ${lang.toUpperCase()}"`)
		.join("\n  ")}
icon: "computer"
---
`,
			default: `---
slug: "technology"
title: "Technology"
description: "Articles about the latest in technology"
icon: "computer"
---
`,
		},

		article: {
			multilingual: `---
title:
  en: "Getting Started with Blog Smith"
  ${languages
		.filter((l) => l !== "en")
		.map(
			(lang) =>
				`${lang}: "Getting Started with Blog Smith (${lang.toUpperCase()})"`,
		)
		.join("\n  ")}
description:
  en: "Learn how to use Blog Smith to manage your Nuxt Content blog"
  ${languages
		.filter((l) => l !== "en")
		.map((lang) => `${lang}: "Description in ${lang.toUpperCase()}"`)
		.join("\n  ")}
author: "john-doe"
tags:
  - "nuxt"
  - "content"
  - "blog"
locale: "${defaultLanguage}"
idDraft: false
category: "technology"
publishedAt: "${today}"
slug: "getting-started-with-blogforge"
---

# Getting Started with Blog Smith

This is a sample article created by the Blog Smith initialization wizard.

## What is Blog Smith?

Blog Smith is a command-line tool for managing Nuxt Content blogs. It helps you create, 
edit, and manage blog posts, authors, categories, and more.

## Features

- Article management
- Author management
- Category management
- Image optimization
- And much more!

## Next Steps

Run \`npx blogforge\` to see available commands.
`,
			default: `---
title: "Getting Started with Blog Smith"
description: "Learn how to use Blog Smith to manage your Nuxt Content blog"
author: "john-doe"
tags:
  - "nuxt"
  - "content"
  - "blog"
locale: "${defaultLanguage}"
idDraft: false
category: "technology"
publishedAt: "${today}"
slug: "getting-started-with-blogforge"
---

# Getting Started with Blog Smith

This is a sample article created by the Blog Smith initialization wizard.

## What is Blog Smith?

Blog Smith is a command-line tool for managing Nuxt Content blogs. It helps you create, 
edit, and manage blog posts, authors, categories, and more.

## Features

- Article management
- Author management
- Category management
- Image optimization
- And much more!

## Next Steps

Run \`npx blogforge\` to see available commands.
`,
		},
	};
};
