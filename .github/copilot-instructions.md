# Project Guidelines

## Overview

This is a VS Code extension project. Follow VS Code extension development best practices.

## Code Style

- Use TypeScript with strict mode enabled
- Prefer `const` over `let`, avoid `var`
- Use descriptive names; avoid abbreviations
- Keep functions small and focused (single responsibility)

## Architecture

- Entry point: `src/extension.ts` — `activate()` and `deactivate()` lifecycle hooks
- Commands registered in `package.json` under `contributes.commands`
- Disposables must be pushed to `context.subscriptions`

## Build and Test

```bash
npm install          # Install dependencies
npm run compile      # Compile TypeScript
npm test             # Run tests (Extension Host)
```

Press `F5` in VS Code to launch the Extension Development Host.

## Conventions

- Register all disposables: `context.subscriptions.push(...)`
- Use `vscode.window.showErrorMessage` for user-facing errors
- Prefer `vscode.workspace.getConfiguration` for reading settings
- Never use `console.log` in production code — use the output channel

## Testing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for test conventions.
