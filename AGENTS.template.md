---
from: https://www.coldtea.ai/blog/agents-md-field-study
---

# AGENTS.md

## Project overview

One short paragraph: what this project does and the parts an agent
will touch most. Link deeper docs instead of repeating them.

## Project structure

- `src/` - core application code
- `tests/` - test suites, mirrors `src/`
- `docs/` - contributor documentation

## Setup & build

```bash
<install command>      # e.g. pnpm install
<build command>        # e.g. pnpm build
```

## Testing

```bash
<full test suite>      # e.g. pnpm test
<single test>          # e.g. pnpm vitest run path/to/file.test.ts
<lint + typecheck>     # e.g. pnpm lint && pnpm typecheck
```

- Run the full suite before committing. All tests must pass.
- While iterating, run the single test closest to your change.
- Never delete, weaken, or rewrite a test to make a change pass.
- Do not claim that an interrupted or timed-out run passed.

## Code style

- Formatter: <tool>. Linter: <tool>. Run them; do not hand-format.
- Follow the patterns already in neighboring files.
- Do not add comments that restate the code.
- Do not reformat code you are not otherwise changing.

## Git workflow

- Branch from <branch>; PRs target <branch>.
- Commit format: <convention, e.g. Conventional Commits>.
- Never commit, push, or open a PR unless asked.
- All CI checks must pass before merge.

## Boundaries

- Do not modify unrelated files or widen scope beyond the request.
- Do not add dependencies without asking.
- Never commit secrets, API keys, or .env files.
- If a command fails, report the failure. Do not guess or
  present assumptions as confirmed results.
