# Agents & Conventions

## Commit message conventions

This project follows **Conventional Commits** (https://www.conventionalcommits.org/).

```
<type>(<optional scope>): <short summary>

[optional body]

[optional footer(s)]
```

### Types

| Type       | When to use                                              |
|------------|----------------------------------------------------------|
| `feat`     | A new feature                                            |
| `fix`      | A bug fix                                                |
| `chore`    | Build process, tooling, dependency updates, non-code changes |
| `refactor` | Code change that is neither a feature nor a bug fix      |
| `docs`     | Documentation only changes                               |
| `style`    | Formatting, white-space, etc. (no logic change)          |
| `test`     | Adding or correcting tests                               |
| `ci`       | CI/CD configuration changes                              |
| `perf`     | Performance improvement                                  |

### Scopes (optional)

Use the area of the codebase affected:

- `api` – Rust API server
- `ui` – React/TypeScript frontend
- `infra` – Docker, Compose, deployment configs
- `db` – Database migrations and schema

### Rules

- Summary line ≤ 72 characters, imperative mood ("add", not "added")
- No period at the end of the summary line
- Body and footers are optional; use them for non-obvious context
- Breaking changes: append `!` after the type/scope (`feat(api)!: ...`) and describe in a footer with `BREAKING CHANGE:`

### Examples

```
feat(ui): add context menu wiring for issue status and labels
fix(api): handle missing project when creating issue
chore: update pnpm lock file
refactor(ui): extract label pill into shared component
```
