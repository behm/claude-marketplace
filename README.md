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

Plugins here don't set a version, so an update gives you the latest commit. Any
commit to this repo counts as a new version of every plugin, even one that didn't
change. Updates aren't automatic by default. To update manually, run this in Claude Code:

```text
/plugin marketplace update behm-claude-marketplace
```

To update automatically, open `/plugin`, go to **Marketplaces**, select this
marketplace, and select **Enable auto-update**.

## Add a plugin

You'll need [Node.js](https://nodejs.org) and Claude Code. Changes reach `master`
through pull requests, and the `Validate marketplace` check must pass before merging.

1. Choose a kebab-case plugin name, such as `my-plugin`. It sets the install id
   (`my-plugin@behm-claude-marketplace`) and the prefix of its skill commands
   (`/my-plugin:<skill-name>`). Renaming later needs an entry in the `renames` map
   in `marketplace.json`, so existing installs don't break.
2. Create `plugins/my-plugin/.claude-plugin/plugin.json`. Leave out `version`, so
   users track commits:

   ```json
   {
     "name": "my-plugin",
     "description": "What the plugin does.",
     "author": {
       "name": "your-name"
     }
   }
   ```

3. Add components, such as a skill at `plugins/my-plugin/skills/<skill-name>/SKILL.md`.
   The skill's `description` should say what it does and when to use it, because
   Claude uses it to decide when to load the skill.
4. Add an entry to `plugins` in `.claude-plugin/marketplace.json`, also without
   `version`:

   ```json
   {
     "name": "my-plugin",
     "source": "./plugins/my-plugin",
     "description": "What the plugin does."
   }
   ```

5. Run the same validation as CI:

   ```text
   node scripts/validate.mjs
   ```

6. Try the plugin in a session, then run `/my-plugin:<skill-name>`. After editing
   its files, run `/reload-plugins` in the session to pick up your changes.

   ```text
   claude --plugin-dir plugins/my-plugin
   ```

7. Open a pull request and complete the checklist in the template.

See the [Claude Code plugin documentation](https://code.claude.com/docs/en/plugins)
for supported plugin components and marketplace details.

## License

[MIT](LICENSE)
