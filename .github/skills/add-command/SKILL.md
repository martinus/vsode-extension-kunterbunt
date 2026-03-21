---
name: add-command
description: "Add a new VS Code extension command end-to-end. Use when registering a new command, adding it to package.json, implementing the handler, and wiring up the disposable."
argument-hint: "Command ID and short description, e.g. 'kunterbunt.helloWorld - say hello'"
---

# Add VS Code Extension Command

Adds a new command to the extension from scratch, covering all required touch-points.

## Steps

1. **Register in `package.json`**
   - Add entry under `contributes.commands` with `command`, `title`, and optional `category`
   - Add the command ID to `activationEvents` if not using `onStartupFinished`

2. **Implement the handler in `src/extension.ts`** (or a dedicated file in `src/commands/`)
   - Use `vscode.commands.registerCommand('kunterbunt.<name>', async () => { ... })`
   - Wrap the body in `try/catch`; show errors via `vscode.window.showErrorMessage`
   - Push the returned disposable to `context.subscriptions`

3. **Write a test** in `src/test/`
   - Follow the pattern in existing test files
   - Stub any `vscode` API calls with sinon

4. **Verify**
   - Run `npm run compile` — must succeed with zero errors
   - Press `F5` to smoke-test in the Extension Development Host
   - Run `npm test` — all tests must pass

## Template

```ts
// src/commands/myCommand.ts
import * as vscode from 'vscode';

export function registerMyCommand(context: vscode.ExtensionContext): void {
    const disposable = vscode.commands.registerCommand('kunterbunt.myCommand', async () => {
        try {
            // TODO: implement
            vscode.window.showInformationMessage('Hello from myCommand!');
        } catch (err) {
            vscode.window.showErrorMessage(`myCommand failed: ${err}`);
        }
    });
    context.subscriptions.push(disposable);
}
```
