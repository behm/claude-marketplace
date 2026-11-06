# Claude Marketplace

A public Claude Code plugin marketplace. See the "Add a plugin" section of
`README.md` for the full steps.

## Layout

- `.claude-plugin/marketplace.json`: the catalog of plugins users can install
- `plugins/<plugin-name>/`: one plugin, with its manifest at `.claude-plugin/plugin.json`
- `scripts/validate.mjs`: all validation and plugin tests (`*.test.mjs`), used both
  locally and in CI
- `.github/workflows/validate.yml`: runs the `Validate marketplace` check

## Rules

- Run `node scripts/validate.mjs` after changing a plugin, a manifest, or the script.
- Every folder under `plugins/` needs an entry in `marketplace.json` and a row in
  the README's Plugins table, and each local `source` must point to an existing folder.
- Don't set `version` in `plugin.json` or a marketplace entry. Users track commits
  for now. `metadata.version` describes the marketplace and is a separate field.
- When renaming a plugin, add the old name to the `renames` map in `marketplace.json`,
  because changing a `name` otherwise breaks existing installs.
- Plugin skill commands are `/<plugin-name>:<skill-name>`. Use the full form in docs.
- Don't add internal names, URLs, credentials, or other private details. This repo is public.
- `master` is protected, so work on a branch and open a pull request.
- The branch protection rule requires the check by name. If you rename the job
  in `validate.yml`, the rule has to be updated too.
