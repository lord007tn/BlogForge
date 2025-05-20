# Category Commands

This section covers all commands related to managing categories.

---

# Create Category

**Command:** `blogforge category create`

This command allows you to create a new category.

**Usage:**

```bash
blogforge category create --name <name> [options]
```

**Options:**

- **`--name <name>`**: (Required) The name of the category.
- **`--description <description>`**: (Optional) A short description of the category.
- **`--slug <slug>`**: (Optional) The slug for the category page. If not provided, it will be generated from the name.

**Examples:**

```bash
blogforge category create --name "Web Development" --description "Articles related to web development technologies and practices."
```

This will create a new category named "Web Development".

---

# Delete Category

**Command:** `blogforge category delete`

This command allows you to delete an existing category.

**Usage:**

```bash
blogforge category delete <slug>
```

**Arguments:**

- **`<slug>`**: (Required) The slug of the category to delete.

**Examples:**

```bash
blogforge category delete web-development
```

This will delete the category with the slug `web-development`.

---

# Doctor Category

**Command:** `blogforge category doctor`

This command helps diagnose and fix common issues with categories.

**Usage:**

```bash
blogforge category doctor [slug]
```

**Arguments:**

- **`[slug]`**: (Optional) The slug of a specific category to diagnose. If not provided, all categories will be checked.

**Examples:**

```bash
blogforge category doctor web-development
```

This will check the category `web-development` for issues.

```bash
blogforge category doctor
```

This will check all categories for issues.

---

# Category Statistics

**Command:** `blogforge category stats`

This command displays statistics about your categories, including the number of articles in each category.

**Usage:**

```bash
blogforge category stats [options]
```

**Options:**

- **`--verbose`**: (Optional) Enable verbose logging for more detailed output.

**Examples:**

```bash
blogforge category stats
```

This will display a table with category titles, slugs, and article counts.

---

# Edit Category

**Command:** `blogforge category edit`

This command allows you to edit an existing category.

**Usage:**

```bash
blogforge category edit <slug> [options]
```

**Arguments:**

- **`<slug>`**: (Required) The slug of the category to edit.

**Options:**

- **`--name <name>`**: The new name of the category.
- **`--description <description>`**: The new description of the category.
- **`--slug <new-slug>`**: The new slug for the category.

**Examples:**

```bash
blogforge category edit web-development --name "Modern Web Development"
```

This will update the name of the category `web-development`.

---

# List Categories

**Command:** `blogforge category list`

This command lists all available categories.

**Usage:**

```bash
blogforge category list [options]
```

**Options:**

- **`--sort-by <field>`**: Sort categories by a specific field (e.g., `name`).
- **`--asc`**: Sort in ascending order.
- **`--desc`**: Sort in descending order.

**Examples:**

```bash
blogforge category list
```

This will list all categories.

```bash
blogforge category list --sort-by name --desc
```

This will list all categories sorted by name in descending order.
