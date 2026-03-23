# Kunterbunt

**Give each repository its own look** — Kunterbunt automatically tints the VS Code title bar, activity bar, and status bar using colors derived from your Git remote URL and current branch, so you always know at a glance which repo and branch you are working in.

## Features

- **Repo color on the title bar** — Each repository gets a unique hue derived from its Git remote URL. The same repo always shows the same color, regardless of which branch you are on.
- **Branch color on the activity bar and status bar** — The current branch (or tag) produces a second hue applied to the activity bar and status bar. Switching branches or tags updates the color automatically.
- **Emoji prefix in the window title** — Two colored-square emojis (🟥🟦 etc.) are prepended to the window title so the repo and branch colors are visible even when the OS renders a native title bar that ignores the theme color.
- **Scoped to the workspace** — Color customizations are written to the workspace-level `settings.json`, so other VS Code windows are never affected.
- **Reliable change detection** — Kunterbunt subscribes to VS Code's built-in git extension and also directly watches `.git/HEAD`, so branch switches triggered by the status bar, the command palette, or an external tool are all detected.
- **Graceful startup** — On slow machines or large repositories where git is not immediately ready, Kunterbunt defers the initial color application and retries with increasing back-off rather than flashing placeholder colors.

## How It Works

| UI area | Hue source |
|---|---|
| Title bar | Hash of the Git **remote URL** + `kunterbunt.hueId` |
| Activity bar | Hash of the current **branch / tag name** + `kunterbunt.hueId` |
| Status bar | Same as the activity bar |
| Window title prefix | Colored-square emojis for both hues |

Hues are computed with a fast 53-bit non-cryptographic hash (cyrb53), so the mapping is deterministic and stable — the same remote or branch will always produce the same color.

The active sidebar indicator uses the *diametral* (complementary) hue of the activity bar to create a visible accent without clashing with the background.

## Extension Settings

| Setting | Type | Default | Description |
|---|---|---|---|
| `kunterbunt.hueId` | `string` | `"k3f8x"` | An arbitrary salt mixed into every hue hash. Change it to shift all generated colors if two unrelated repos accidentally land on the same color. |
| `kunterbunt.saturation` | `number` | `60` | Saturation (0–100) for all generated colors. Lower values produce greyer, more muted tones; higher values produce more vivid colors. |
| `kunterbunt.lightness` | `number` | `25` | Lightness (0–100) for title-bar and activity-bar backgrounds. Values in the 15–40 range work best with dark themes. |

## Requirements

- VS Code **1.110.0** or later.
- A workspace folder that is a Git repository (non-git folders are supported but will show default/no colors).

## Known Issues

- Only the **first** workspace folder is used to determine the title bar color in multi-root workspaces.
- Colors are written to `workbench.colorCustomizations` in the workspace `.vscode/settings.json`. If you manually manage that key you may see conflicts.

## Release Notes

### 0.0.1

Initial release.

---

## Following extension guidelines

Ensure that you've read through the extensions guidelines and follow the best practices for creating your extension.

* [Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)

## Working with Markdown

You can author your README using Visual Studio Code. Here are some useful editor keyboard shortcuts:

* Split the editor (`Cmd+\` on macOS or `Ctrl+\` on Windows and Linux).
* Toggle preview (`Shift+Cmd+V` on macOS or `Shift+Ctrl+V` on Windows and Linux).
* Press `Ctrl+Space` (Windows, Linux, macOS) to see a list of Markdown snippets.

## For more information

* [Visual Studio Code's Markdown Support](http://code.visualstudio.com/docs/languages/markdown)
* [Markdown Syntax Reference](https://help.github.com/articles/markdown-basics/)


## Inspirations

* Peacock: https://github.com/johnpapa/vscode-peacock