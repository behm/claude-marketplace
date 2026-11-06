# Claude Marketplace

A Claude Code plugin marketplace for plug-ins, skills, and other extensions.

## Install

In Claude Code, add this marketplace and install the `repo-guide` plugin:

```text
/plugin marketplace add behm/claude-marketplace
/plugin install repo-guide@behm-claude-marketplace
```

The plugin provides the `repo-guide` skill for getting oriented in an unfamiliar
codebase. Ask Claude to use it or invoke it directly with `/repo-guide:repo-guide`.
Claude Code prefixes each plugin skill's command with the plugin name.

## Add a plugin

1. Create a directory under `plugins/` containing `.claude-plugin/plugin.json`.
2. Add plugin components such as skills under `skills/<skill-name>/SKILL.md`.
3. Add an entry for the plugin to `.claude-plugin/marketplace.json`, using its
   directory as the relative `source`.
4. Validate the JSON files and test the plugin in Claude Code before submitting.

See the [Claude Code plugin documentation](https://code.claude.com/docs/en/plugins)
for supported plugin components and marketplace details.
