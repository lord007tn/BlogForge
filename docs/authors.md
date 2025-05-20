# Authors Commands

This section covers all commands related to managing authors.

---

# Create Author

**Command:** `blogforge authors create`

This command allows you to create a new author profile.

**Usage:**

```bash
blogforge authors create --name <name> [options]
```

**Options:**

- **`--name <name>`**: (Required) The full name of the author.
- **`--email <email>`**: (Optional) The email address of the author.
- **`--bio <bio>`**: (Optional) A short biography of the author.
- **`--slug <slug>`**: (Optional) The slug for the author's profile page. If not provided, it will be generated from the name.

**Examples:**

```bash
blogforge authors create --name "Jane Doe" --email "jane.doe@example.com"
```

This will create a new author profile for Jane Doe.

---

# Delete Author

**Command:** `blogforge authors delete`

This command allows you to delete an existing author profile.

**Usage:**

```bash
blogforge authors delete <slug>
```

**Arguments:**

- **`<slug>`**: (Required) The slug of the author to delete.

**Examples:**

```bash
blogforge authors delete jane-doe
```

This will delete the author profile with the slug `jane-doe`.

---

# Doctor Author

**Command:** `blogforge authors doctor`

This command helps diagnose and fix common issues with author profiles, such as missing information.

**Usage:**

```bash
blogforge authors doctor [slug]
```

**Arguments:**

- **`[slug]`**: (Optional) The slug of a specific author to diagnose. If not provided, all author profiles will be checked.

**Examples:**

```bash
blogforge authors doctor jane-doe
```

This will check the author profile `jane-doe` for issues.

```bash
blogforge authors doctor
```

This will check all author profiles for issues.

---

# Edit Author

**Command:** `blogforge authors edit`

This command allows you to edit an existing author profile.

**Usage:**

```bash
blogforge authors edit <slug> [options]
```

**Arguments:**

- **`<slug>`**: (Required) The slug of the author to edit.

**Options:**

- **`--name <name>`**: The new name of the author.
- **`--email <email>`**: The new email of the author.
- **`--bio <bio>`**: The new biography of the author.
- **`--slug <new-slug>`**: The new slug for the author's profile.

**Examples:**

```bash
blogforge authors edit jane-doe --email "new.email@example.com"
```

This will update the email for the author profile `jane-doe`.

---

# List Authors

**Command:** `blogforge authors list`

This command lists all author profiles.

**Usage:**

```bash
blogforge authors list [options]
```

**Options:**

- **`--sort-by <field>`**: Sort authors by a specific field (e.g., `name`, `email`).
- **`--asc`**: Sort in ascending order.
- **`--desc`**: Sort in descending order.

**Examples:**

```bash
blogforge authors list
```

This will list all author profiles.

```bash
blogforge authors list --sort-by name --asc
```

This will list all author profiles sorted by name in ascending order.

---

# Author Statistics

**Command:** `blogforge authors stats`

This command displays statistics about authors, including the number of articles written and approximate total word count.

**Usage:**

```bash
blogforge authors stats [options]
```

**Options:**

- **`--verbose`**: (Optional) Enable verbose logging for more detailed output (e.g., list of articles per author).

**Examples:**

```bash
blogforge authors stats
```

This will display a table with author names, IDs, article counts, and total word counts.

```bash
blogforge authors stats --verbose
```

This will display the main statistics table and also list the titles of articles written by each author.
