import { defineCollection, defineContentConfig, z } from '@nuxt/content'

// Helper for localized string fields
const localizedString = (isRequired = true) => {
  const schema = z.record(z.string(), z.string());
  return isRequired ? schema : schema.optional();
}


export default defineContentConfig({
  collections: {
      articles: defineCollection({
    type: 'page',
    source: 'articles/**',
    schema: z.object({
      title: localizedString(),
      description: localizedString(),
      author: z.string(),
      tags: z.array(z.string()).default([]),
      locale: z.string().default('ar'),
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
  }),
  authors: defineCollection({
    type: 'data',
    source: 'authors/**',
    schema: z.object({
      slug: z.string(),
      name: localizedString(),
      bio: localizedString(),
      avatar: z.string().optional(),
      twitter: z.string().optional(),
      github: z.string().optional(),
      website: z.string().optional(),
      linkedin: z.string().optional(),
      role: localizedString().optional()
    })
  }),
  categories: defineCollection({
    type: 'data',
    source: 'categories/**',
    schema: z.object({
      title: localizedString(),
      description: localizedString(),
      slug: z.string(),
      image: z.string().optional(),
      icon: z.string().optional()
    })
  })
  }
});
