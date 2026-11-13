---
name: run-tests
description: Run the project's tests through the test-runner subagent and summarize what failed. Use when the user runs /test-runner:run-tests or asks to run the tests with the test runner.
argument-hint: "[optional test files or names]"
---

# Run tests

Delegate this to the `test-runner` subagent. Don't run the tests yourself, because
the point is to keep their output out of this conversation.

Pass the agent what the user asked for: $ARGUMENTS. If that's empty, ask the agent
to run the project's full test suite.

When the agent replies, relay its summary. If tests failed, offer to fix them, but
don't change any files until the user agrees.
