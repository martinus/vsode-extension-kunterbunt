import * as path from "path";
import * as vscode from "vscode";
import { getColorSet } from "./color";

const COLOR_CUSTOMIZATIONS_KEY = "workbench.colorCustomizations";

function getConfig(): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration("kunterbunt");
}

function buildColorCustomizations(
    folderName: string,
    existing: Record<string, string>
): Record<string, string> {
    const cfg = getConfig();
    const { background, foreground } = getColorSet(folderName);
    const inactiveFg = foreground + "99";

    const result: Record<string, string> = { ...existing };

    if (cfg.get<boolean>("affectTitleBar", true)) {
        result["titleBar.activeBackground"] = background;
        result["titleBar.activeForeground"] = foreground;
        result["titleBar.inactiveBackground"] = background;
        result["titleBar.inactiveForeground"] = inactiveFg;
    }

    if (cfg.get<boolean>("affectActivityBar", true)) {
        result["activityBar.background"] = background;
        result["activityBar.foreground"] = foreground;
        result["activityBar.inactiveForeground"] = inactiveFg;
    }

    if (cfg.get<boolean>("affectStatusBar", true)) {
        result["statusBar.background"] = background;
        result["statusBar.foreground"] = foreground;
        result["statusBarItem.hoverBackground"] = background;
    }

    return result;
}

const KUNTERBUNT_KEYS = [
    "titleBar.activeBackground",
    "titleBar.activeForeground",
    "titleBar.inactiveBackground",
    "titleBar.inactiveForeground",
    "activityBar.background",
    "activityBar.foreground",
    "activityBar.inactiveForeground",
    "statusBar.background",
    "statusBar.foreground",
    "statusBarItem.hoverBackground",
];

function removeKunterbuntKeys(
    obj: Record<string, string>
): Record<string, string> {
    const result = { ...obj };
    for (const key of KUNTERBUNT_KEYS) {
        delete result[key];
    }
    return result;
}

async function applyColors(folderName: string): Promise<void> {
    const wsConfig = vscode.workspace.getConfiguration();
    const existing =
        wsConfig.get<Record<string, string>>(COLOR_CUSTOMIZATIONS_KEY) ?? {};

    const updated = buildColorCustomizations(folderName, existing);

    await wsConfig.update(
        COLOR_CUSTOMIZATIONS_KEY,
        updated,
        vscode.ConfigurationTarget.Workspace
    );
}

async function resetColors(): Promise<void> {
    const wsConfig = vscode.workspace.getConfiguration();
    const existing =
        wsConfig.get<Record<string, string>>(COLOR_CUSTOMIZATIONS_KEY) ?? {};

    const cleaned = removeKunterbuntKeys(existing);
    const value =
        Object.keys(cleaned).length === 0 ? undefined : cleaned;

    await wsConfig.update(
        COLOR_CUSTOMIZATIONS_KEY,
        value,
        vscode.ConfigurationTarget.Workspace
    );
}

function getPrimaryFolderName(): string | undefined {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
        return undefined;
    }
    return path.basename(folders[0].uri.fsPath);
}

export function activate(context: vscode.ExtensionContext): void {
    // Auto-apply on startup if enabled
    if (getConfig().get<boolean>("enabled", true)) {
        const folderName = getPrimaryFolderName();
        if (folderName) {
            applyColors(folderName);
        }
    }

    // Re-apply when workspace folders change
    const onFoldersChanged = vscode.workspace.onDidChangeWorkspaceFolders(
        () => {
            if (!getConfig().get<boolean>("enabled", true)) {
                return;
            }
            const folderName = getPrimaryFolderName();
            if (folderName) {
                applyColors(folderName);
            } else {
                resetColors();
            }
        }
    );

    // Re-apply when the extension settings change
    const onConfigChanged = vscode.workspace.onDidChangeConfiguration((e) => {
        if (!e.affectsConfiguration("kunterbunt")) {
            return;
        }
        if (!getConfig().get<boolean>("enabled", true)) {
            resetColors();
            return;
        }
        const folderName = getPrimaryFolderName();
        if (folderName) {
            applyColors(folderName);
        }
    });

    const cmdApply = vscode.commands.registerCommand(
        "kunterbunt.apply",
        () => {
            const folderName = getPrimaryFolderName();
            if (folderName) {
                applyColors(folderName);
            } else {
                vscode.window.showWarningMessage(
                    "Kunterbunt: No workspace folder is open."
                );
            }
        }
    );

    const cmdReset = vscode.commands.registerCommand(
        "kunterbunt.reset",
        resetColors
    );

    context.subscriptions.push(
        onFoldersChanged,
        onConfigChanged,
        cmdApply,
        cmdReset
    );
}

export function deactivate(): void {
    // Color customizations live in workspace settings and intentionally persist.
}
