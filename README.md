# kunterbunt README


Kunterbunt is a Visual Studio Code extension to colorize the app automatically based on a fixed set of rules for easy recognizeability.

# Ideas for Rules

* Most colors are based on HSL values, where S and L are fixed and H based on a hash.
* Top titlebar color based on remote URL
* Left bar: 
  * main/master,Blue (210∘),"Stable, neutral",The baseline.
  * feature/,Green (120∘),Normal saturation,Developing new things.
  * bugfix/,Yellow (60∘),Slightly higher contrast,"Fixing logic, needs attention."
  * hotfix/,Red (0∘),High Saturation (Alert),Critical production fix. Danger!
  * release/,Purple (270∘),"Stable, slightly distinct",Preparing production.
  * task/ / chore/,"Grey (0∘, S=0)",Low Saturation (Muted),Routine maintenance.
  * (Any other prefix),Random Hue,Normal saturation,A creative fallback.
  * No prefix: hash of whole branch
* status bar: hash of whole branch

## Inspirations

* Peacock: https://github.com/johnpapa/vscode-peacock

-------------

This is the README for your extension "kunterbunt". After writing up a brief description, we recommend including the following sections.

## Features

Describe specific features of your extension including screenshots of your extension in action. Image paths are relative to this README file.

For example if there is an image subfolder under your extension project workspace:

\!\[feature X\]\(images/feature-x.png\)

> Tip: Many popular extensions utilize animations. This is an excellent way to show off your extension! We recommend short, focused animations that are easy to follow.

## Requirements

If you have any requirements or dependencies, add a section describing those and how to install and configure them.

## Extension Settings

Include if your extension adds any VS Code settings through the `contributes.configuration` extension point.

For example:

This extension contributes the following settings:

* `myExtension.enable`: Enable/disable this extension.
* `myExtension.thing`: Set to `blah` to do something.

## Known Issues

Calling out known issues can help limit users opening duplicate issues against your extension.

## Release Notes

Users appreciate release notes as you update your extension.

### 1.0.0

Initial release of ...

### 1.0.1

Fixed issue #.

### 1.1.0

Added features X, Y, and Z.

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

**Enjoy!**
