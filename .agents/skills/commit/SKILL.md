---
name: commit
description: Create atomic conventional commits from staged/unstaged changes. Use when the user asks to commit, save, or checkpoint their work.
allowed-tools: Bash(git *)
---

# Commit Skill

Create atomic, well-scoped conventional commits following the Conventional Commits specification.

## Process

1. Run `git status` and `git diff` to understand all changes
2. Run `git log --oneline -5` to see recent commit style
3. Group changes into **atomic commits** — each commit should represent one logical change
4. For each atomic commit:
   - Stage only the relevant files (`git add <specific files>`)
   - Write a conventional commit message using the format below
   - Verify with `git status` after committing

## Conventional Commit Format

```
<type>(<scope>): <short description>

<optional body>

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

Always pass the message via HEREDOC:
```bash
git commit -m "$(cat <<'EOF'
<type>(<scope>): <short description>

<optional body>

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

### Types
- `feat` — new feature or capability
- `fix` — bug fix
- `refactor` — code restructuring without behavior change
- `style` — formatting, CSS, visual changes
- `docs` — documentation only
- `chore` — tooling, config, dependencies
- `perf` — performance improvement
- `test` — adding or updating tests

### Scope
Optional, lowercase, identifies the area: `ui`, `parser`, `api`, `theme`, etc.

### Rules
- Subject line: imperative mood, lowercase, no period, under 72 chars
- Body: explain **why**, not what (the diff shows what)
- One logical change per commit — if changes touch unrelated areas, split into multiple commits
- Never use `git add .` or `git add -A` — always add specific files
- Never amend unless explicitly asked
- Never push unless explicitly asked
- Never use `--no-verify`
