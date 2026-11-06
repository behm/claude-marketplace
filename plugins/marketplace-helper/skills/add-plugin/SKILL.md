---
name: add-plugin
description: Scaffold a new plugin in a Claude Code plugin marketplace repository, add it to marketplace.json, and validate it. Use when the user wants to add, create, or start a new plugin in a marketplace repo. Not for editing an existing plugin or for creating a standalone skill outside a marketplace.
---

# Add a plugin to a marketplace

## 1. Check the repository

Look for `.claude-plugin/marketplace.json` at the repository root. If it isn't
there, stop and tell the user this isn't a marketplace repository. Don't create one
unless they ask.

Read the marketplace file, `README.md`, `CLAUDE.md`, and an existing plugin if there
is one. Their conventions override the defaults below.

## 2. Settle the name and purpose

- If you can't tell what the plugin should do, ask before creating anything.
- Use a kebab-case name. If the user's name isn't kebab-case, suggest one and ask.
- If a marketplace entry or plugin folder already uses the name, stop and ask. Never
  overwrite or merge into an existing plugin.

## 3. Create the plugin

Create only what the plugin needs. Default to a single skill, and add hooks, agents,
or MCP servers only if the user asks or the purpose requires one.

Put the plugin where the existing plugins live, or in `plugins/<plugin-name>/` if
there are none. Create `.claude-plugin/plugin.json` with:

- `name`
- `description`
- `author`, matching the existing plugins or the marketplace `owner`
- `version` only if the existing plugins set one

Create each skill at `skills/<skill-name>/SKILL.md`, with frontmatter containing:

- `name`
- `description`, saying what the skill does and when to use it, since Claude uses
  this to decide when to load the skill

Write working instructions for the purpose the user described, not placeholders.
If the marketplace repo is public, leave out private names, URLs, and credentials.

## 4. Add the marketplace entry

Add an entry to `plugins` in `.claude-plugin/marketplace.json`, matching the fields
and `source` style of the existing entries. Don't change other entries. Set `version`
only if the existing entries do.

## 5. Validate

If the repository has its own validation script, such as one named in `CLAUDE.md`
or the `README.md`, run it. Otherwise run both of these:

```text
claude plugin validate . --strict
claude plugin validate <plugin-directory> --strict
```

Fix any problem your change caused. Report other problems without fixing them.

## 6. Report back

Tell the user:

- Which files you created and changed
- The validation result, including anything you couldn't run
- The command for each skill, in the form `/<plugin-name>:<skill-name>`
- How to try the plugin: `claude --plugin-dir <plugin-directory>`

Don't commit, push, or open a pull request unless the user asks.
