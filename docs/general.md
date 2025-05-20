# General Commands

This section covers general-purpose commands for BlogForge.

---

## Initialize Project

**Command:** `blogforge init`

This command initializes a new BlogForge project or sets up BlogForge in an existing Nuxt Content project. It guides you through the initial configuration, creating necessary directories and sample content if desired.

**Usage:**

```bash
blogforge init [options]
```

**Options:**

*   Currently, the `init` command may not have specific CLI options as it often runs interactively. Refer to the interactive prompts when running the command.

**Examples:**

```bash
blogforge init
```
This will start the interactive initialization process.

---

## Doctor (Project Health Check)

**Command:** `blogforge doctor`

This command runs a comprehensive health check on your entire BlogForge project. It typically executes all specific "doctor" commands (for articles, authors, categories, etc.) to diagnose and suggest fixes for common issues across your content.

**Usage:**

```bash
blogforge doctor [options]
```

**Options:**

*   Currently, the main `doctor` command may not have specific CLI options. It acts as an aggregator for other doctor commands.

**Examples:**

```bash
blogforge doctor
```
This will run all available diagnostic checks on your project.
