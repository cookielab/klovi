# Contributing to Klovi

Thanks for your interest in contributing to Klovi! This guide will help you get started.

Please read and follow our [Code of Conduct](CODE_OF_CONDUCT.md).

## Development Setup

1. **Prerequisites:** [Bun](https://bun.sh) v1.3+
2. Clone the repo and install dependencies:
   ```bash
   git clone https://github.com/cookielab/klovi.git
   cd klovi
   bun install
   ```
3. Start the dev app:
   ```bash
   bun run dev
   ```
   The native window opens automatically.

## Running Checks

Before submitting a PR, ensure all checks pass:

```bash
bun run check      # Biome lint + format
bun run typecheck  # TypeScript type checking
bun test           # Unit tests
```

To auto-fix lint/format issues:

```bash
bun run check:fix
```

## Code Style

- **Linting & Formatting:** Enforced by [Biome](https://biomejs.dev/). No manual style decisions needed — just run `bun run check:fix`.
- **TypeScript:** Strict mode with `noUncheckedIndexedAccess`. Use `!` non-null assertions for array index access when the index is known to be valid.
- **CSS:** Plain CSS (custom properties + CSS modules). No CSS framework. App shell styles live in `src/frontend/`; reusable package styles live in `packages/klovi-ui/` and `packages/klovi-design-system/`.
- **Testing:** Use `bun:test` with `@testing-library/react` and `happy-dom`. See `docs/testing.md` for patterns.

## Commit Messages

This project uses [Conventional Commits](https://www.conventionalcommits.org/). Prefix your commit messages with a type:

- `feat:` — new feature
- `fix:` — bug fix
- `docs:` — documentation only
- `test:` — adding or updating tests
- `refactor:` — code change that neither fixes a bug nor adds a feature
- `chore:` — maintenance tasks (deps, CI, build)

Examples:
```
feat: add search filtering to session list
fix: handle missing plugin data directory gracefully
docs: update README with contributing section
```

## Pull Request Process

1. Fork the repo and create a branch from `main`.
2. Make your changes.
3. Ensure all checks pass (`bun run check`, `bun run typecheck`, `bun test`).
4. Write a clear PR description explaining **what** and **why**.
5. If you add a new feature, consider adding tests and updating docs.

## Reporting Issues

Use [GitHub Issues](https://github.com/cookielab/klovi/issues) to report bugs or request features.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
