# kunterbunt

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