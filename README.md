# Claude Marketplace

A Claude Code plugin marketplace for plug-ins, skills, and other extensions.

## Install

In Claude Code, add this marketplace and install a plugin, such as `repo-guide`:

```text
/plugin marketplace add behm/claude-marketplace
/plugin install repo-guide@behm-claude-marketplace
```

## Plugins

| Plugin | What it does | Command |
| --- | --- | --- |
| `repo-guide` | Gets you oriented in an unfamiliar codebase | `/repo-guide:repo-guide` |
| `marketplace-helper` | Adds a new plugin to a marketplace repository | `/marketplace-helper:add-plugin` |
| `guardrails` | Stops Claude from force pushing, committing to the default branch, or editing `.env` files | None, it runs automatically |

Ask Claude for what you need, or run the command directly. Claude Code prefixes each
plugin skill's command with the plugin name.

### About `guardrails`

The hook runs before Claude Code's permission prompt, so an allow rule doesn't get
past it. It needs [Node.js](https://nodejs.org). It blocks Claude from:

- Force pushing, including `--force-with-lease`
- Committing on `main`, `master`, or the branch `origin` marks as default
- Editing `.env` and `.env.*` files, but not templates such as `.env.example`

When you do want one of these, run it yourself in your own terminal, or turn the
plugin off:

```text
claude plugin disable guardrails@behm-claude-marketplace
```

It catches mistakes, but it isn't a security boundary:

- It reads command text, so scripts, aliases, and tools like `xargs` can get past it.
- It doesn't stop Claude from reading `.env` files, or changing them with other
  commands such as `cp` or `sed`.
- It doesn't cover other ways of changing the default branch, such as `git merge`.
  Use branch protection on the server for that.
- If the hook fails or Node.js is missing, the action goes ahead.

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

The `marketplace-helper` plugin can do most of this for you. Either way, review what
it creates and try the plugin before opening a pull request.

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

7. Add the plugin to the table under [Plugins](#plugins), then open a pull request
   and complete the checklist in the template.

See the [Claude Code plugin documentation](https://code.claude.com/docs/en/plugins)
for supported plugin components and marketplace details.

## License

[MIT](LICENSE)
