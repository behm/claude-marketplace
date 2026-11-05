---
name: repo-guide
description: Explore an unfamiliar codebase and explain its structure, key entry points, and how to validate changes.
---

# Repository guide

Help the user get oriented in the current codebase. Inspect the repository before
making claims, and cite relevant file paths and symbols so the user can verify
the explanation.

When asked to explain a repository:

1. Identify its language, framework, and purpose from its manifests and docs.
2. Find the main entry points and describe the path through the important code.
3. Point out where tests live and how to run the most relevant checks.
4. Summarize the findings clearly; distinguish verified details from assumptions.

Keep the exploration focused on the user's question. Do not modify files unless
the user explicitly asks for a change.
