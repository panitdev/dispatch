# Agents & Conventions

## Conventional Commits

This project follows **Conventional Commits** (<https://www.conventionalcommits.org/>).

Available types: feat, fix, chore, refactor, docs, style, test, ci, perf
Scope must be one of: `api`, `auth`, `db`, `editor`, `ui`, `router`, `markdown`, `infra`, `mcp`

```
<type>(<optional scope>): <short summary>

[optional body]

[optional footer(s)]
```

## Browser interaction

Use `https://localhost.panit.dev` instead of `http://localhost:3000` for real browser testing.
This is required for Kratos auth integration.
