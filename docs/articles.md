# Articles Commands

This section covers all commands related to managing articles.

---

# Create Article

**Command:** `blogforge articles create`

This command allows you to create a new article.

**Usage:**

```bash
blogforge articles create [options]
```

**Options:**

- **`--title <title>`**: (Required) The title of the article.
- **`--author <author>`**: (Required) The author of the article.
- **`--category <category>`**: (Required) The category of the article.
- **`--content <content>`**: (Optional) The content of the article. If not provided, an empty article will be created.
- **`--slug <slug>`**: (Optional) The slug for the article URL. If not provided, it will be generated from the title.

**Examples:**

```bash
blogforge articles create --title "My First Article" --author "John Doe" --category "Technology"
```

This will create a new article with the specified title, author, and category.

---

# Delete Article

**Command:** `blogforge articles delete`

This command allows you to delete an existing article.

**Usage:**

```bash
blogforge articles delete <slug>
```

**Arguments:**

- **`<slug>`**: (Required) The slug of the article to delete.

**Examples:**

```bash
blogforge articles delete my-first-article
```

This will delete the article with the slug `my-first-article`.

---

# Doctor Article

**Command:** `blogforge articles doctor`

This command helps diagnose and fix common issues with articles, such as missing frontmatter fields or broken links.

**Usage:**

```bash
blogforge articles doctor [slug]
```

**Arguments:**

- **`[slug]`**: (Optional) The slug of a specific article to diagnose. If not provided, all articles will be checked.

**Examples:**

```bash
blogforge articles doctor my-first-article
```

This will check the article with the slug `my-first-article` for issues.

```bash
blogforge articles doctor
```

This will check all articles for issues.

---

# Edit Article

**Command:** `blogforge articles edit`

This command allows you to edit an existing article.

**Usage:**

```bash
blogforge articles edit <slug> [options]
```

**Arguments:**

- **`<slug>`**: (Required) The slug of the article to edit.

**Options:**

- **`--title <title>`**: The new title of the article.
- **`--author <author>`**: The new author of the article.
- **`--category <category>`**: The new category of the article.
- **`--content <content>`**: The new content of the article.
- **`--slug <new-slug>`**: The new slug for the article URL.

**Examples:**

```bash
blogforge articles edit my-first-article --title "My Updated Article Title"
```

This will update the title of the article with the slug `my-first-article`.

---

# List Articles

**Command:** `blogforge articles list`

This command lists all available articles.

**Usage:**

```bash
blogforge articles list [options]
```

**Options:**

- **`--author <author>`**: Filter articles by author.
- **`--category <category>`**: Filter articles by category.
- **`--status <status>`**: Filter articles by status (e.g., `published`, `draft`).
- **`--sort-by <field>`**: Sort articles by a specific field (e.g., `title`, `date`, `author`).
- **`--asc`**: Sort in ascending order.
- **`--desc`**: Sort in descending order.

**Examples:**

```bash
blogforge articles list
```

This will list all articles.

```bash
blogforge articles list --category "Technology" --sort-by date --desc
```

This will list all articles in the 'Technology' category, sorted by date in descending order.

---

# Publish Article

**Command:** `blogforge articles publish`

This command publishes a draft article, making it publicly visible.

**Usage:**

```bash
blogforge articles publish <slug>
```

**Arguments:**

- **`<slug>`**: (Required) The slug of the article to publish.

**Examples:**

```bash
blogforge articles publish my-draft-article
```

This will publish the article with the slug `my-draft-article`.

---

# Search Articles

**Command:** `blogforge articles search`

This command allows you to search for articles based on keywords.

**Usage:**

```bash
blogforge articles search <query>
```

**Arguments:**

- **`<query>`**: (Required) The search term or keywords.

**Examples:**

```bash
blogforge articles search "getting started"
```

This will search for articles containing the phrase "getting started".

---

# SEO Check Article

**Command:** `blogforge articles seo-check`

This command performs an SEO (Search Engine Optimization) check on an article, providing suggestions for improvement.

**Usage:**

```bash
blogforge articles seo-check <slug>
```

**Arguments:**

- **`<slug>`**: (Required) The slug of the article to perform an SEO check on.

**Examples:**

```bash
blogforge articles seo-check my-first-article
```

This will analyze the SEO aspects of the article `my-first-article`.

---

# Article Stats

**Command:** `blogforge articles stats`

This command displays statistics for articles, such as word count, number of views (if applicable), etc.

**Usage:**

```bash
blogforge articles stats
```

This will show overall article statistics.

---

# Unpublish Article

**Command:** `blogforge articles unpublish`

This command unpublishes a published article, changing its status to draft or making it not publicly visible.

**Usage:**

```bash
blogforge articles unpublish <slug>
```

**Arguments:**

- **`<slug>`**: (Required) The slug of the article to unpublish.

**Examples:**

```bash
blogforge articles unpublish my-published-article
```

This will unpublish the article with the slug `my-published-article`.

---

# Validate Articles

**Command:** `blogforge articles validate`

This command validates the structure and frontmatter of articles.

**Usage:**

```bash
blogforge articles validate [slug]
```

**Arguments:**

- **`[slug]`**: (Optional) The slug of a specific article to validate. If not provided, all articles will be validated.

**Examples:**

```bash
blogforge articles validate my-first-article
```

This will validate the article with the slug `my-first-article`.

```bash
blogforge articles validate
```

This will validate all articles.
