## Summary

<!-- What changed and why. Add "Closes #123" if this finishes an issue. -->

## Testing

<!-- What you ran and what happened. -->

## Plugin checklist

<!-- Only for PRs that add or change a plugin. Delete this section otherwise. -->

- [ ] `node scripts/validate.mjs` passes
- [ ] Tested in a session started with `claude --plugin-dir plugins/<plugin-name>`
- [ ] New plugins are listed in `.claude-plugin/marketplace.json`
- [ ] `version` isn't set in `plugin.json` or the marketplace entry
- [ ] Renamed plugins are added to the `renames` map in `marketplace.json`
- [ ] Nothing private is included, since this repo is public
