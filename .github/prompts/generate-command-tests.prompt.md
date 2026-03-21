---
description: "Generate VS Code extension command tests for the selected command handler"
argument-hint: "Command ID or function name to test"
agent: "agent"
---
Generate comprehensive test cases for the VS Code extension command below.

Requirements:
- Use the Mocha + `@vscode/test-electron` test infrastructure already in this project
- Cover the happy path, edge cases, and error handling
- Mock `vscode` APIs using sinon stubs where needed
- Use descriptive `it('should ...')` names
- Verify disposables are cleaned up after each test

Reference the existing test patterns in `src/test/` and the extension entry point in `src/extension.ts`.
