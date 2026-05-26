# Agents & Conventions

## Commit message conventions

This project follows **Conventional Commits** (<https://www.conventionalcommits.org/>).

```
<type>(<optional scope>): <short summary>

[optional body]

[optional footer(s)]
```

Available types: feat, fix, chore, refactor, docs, style, test, ci, perf

## Browser interaction

Use `https://localhost.panit.dev` instead of `http://localhost:3000` for real browser testing.
This is required for Kratos auth integration.
