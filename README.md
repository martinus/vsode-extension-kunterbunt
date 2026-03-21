# Kunterbunt

**Kunterbunt** (German for *colorful*) is a VS Code extension that automatically
colors your editor's title bar, activity bar, and status bar based on the name
of the workspace folder you have open — with zero manual configuration required.

It is inspired by [vscode-peacock](https://github.com/johnpapa/vscode-peacock)
but is intentionally simpler and fully automatic: open a folder and Kunterbunt
does the rest.

---

## Features

* **Zero-config coloring** — a consistent color is derived from the workspace
  folder name using a deterministic hash, so the same project always gets the
  same color across machines.
* **Sensible defaults** — colors are applied to the title bar, activity bar,
  and status bar with an automatically-chosen foreground color (white or black)
  for good contrast.
* **Lightweight settings** — four optional boolean settings let you opt-out of
  coloring individual areas or disable the extension entirely.

---

## Commands

| Command | Description |
|---|---|
| `Kunterbunt: Apply Colors for This Workspace` | Manually (re-)apply the workspace color. |
| `Kunterbunt: Reset Colors for This Workspace` | Remove all Kunterbunt color customizations from the workspace settings. |

---

## Extension Settings

| Setting | Type | Default | Description |
|---|---|---|---|
| `kunterbunt.enabled` | boolean | `true` | Enable or disable automatic coloring. |
| `kunterbunt.affectTitleBar` | boolean | `true` | Apply the color to the title bar. |
| `kunterbunt.affectActivityBar` | boolean | `true` | Apply the color to the activity bar. |
| `kunterbunt.affectStatusBar` | boolean | `true` | Apply the color to the status bar. |

---

## How It Works

1. When a workspace is opened, Kunterbunt reads the **primary workspace folder
   name**.
2. A 32-bit hash of that name is mapped to a hue (0–359°).
3. The hue is converted to an HSL color with a fixed saturation (60 %) and
   lightness (30 %) to produce a vivid-but-dark background suitable for VS Code
   chrome elements.
4. A foreground color (white or black) is selected automatically for WCAG-level
   contrast.
5. The colors are written to `workbench.colorCustomizations` in the **workspace**
   settings file (`.vscode/settings.json`), so they only affect that workspace.

---

## Development

```bash
npm install
npm run compile   # compile TypeScript to out/
npm test          # run unit tests
```