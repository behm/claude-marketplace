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

## Get updates

Plugins here don't set a version, so an update gives you the latest commit.
Updates aren't automatic by default. To update manually, run this in Claude Code:

```text
/plugin marketplace update behm-claude-marketplace
```

To update automatically, open `/plugin`, go to **Marketplaces**, select this
marketplace, and select **Enable auto-update**.

## Add a plugin

1. Create a directory under `plugins/` containing `.claude-plugin/plugin.json`.
2. Add plugin components such as skills under `skills/<skill-name>/SKILL.md`.
3. Add an entry for the plugin to `.claude-plugin/marketplace.json`, using its
   directory as the relative `source`.
   Leave `version` out of both this entry and `plugin.json`, so users track commits.
4. Validate the JSON files and test the plugin in Claude Code before submitting.

See the [Claude Code plugin documentation](https://code.claude.com/docs/en/plugins)
for supported plugin components and marketplace details.

## License

[MIT](LICENSE)
