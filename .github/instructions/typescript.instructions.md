---
description: "Use when writing TypeScript for VS Code extensions. Covers extension API patterns, disposable management, and activation events."
applyTo: "**/*.ts"
---
# TypeScript / VS Code Extension Guidelines

- Always import from `vscode` — never use `require('vscode')`
- Wrap async operations in `try/catch` and surface errors via `vscode.window.showErrorMessage`
- Use `vscode.ExtensionContext.subscriptions.push(...)` for every disposable
- Prefer `readonly` on class properties that are never reassigned
- Use `vscode.workspace.getConfiguration('kunterbunt')` to read extension settings

## Disposable Pattern

```ts
const disposable = vscode.commands.registerCommand('kunterbunt.myCommand', () => {
    // implementation
});
context.subscriptions.push(disposable);
```

## Output Channel (instead of console.log)

```ts
const channel = vscode.window.createOutputChannel('Kunterbunt');
context.subscriptions.push(channel);
channel.appendLine('Extension activated');
```
