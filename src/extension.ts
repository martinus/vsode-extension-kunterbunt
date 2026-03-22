import * as vscode from 'vscode';
import { execSync } from 'child_process';

// ---------------------------------------------------------------------------
// Hashing
// ---------------------------------------------------------------------------

// cyrb53: fast 53-bit non-cryptographic hash with good avalanche behaviour.
// Uses two independent 32-bit accumulators mixed via Math.imul, then combined
// into a single number that fits within JS's safe integer range.
function cyrb53(str: string): number {
	let h1 = 0xdeadbeef;
	let h2 = 0x41c6ce57;
	for (let i = 0; i < str.length; i++) {
		const ch = str.charCodeAt(i);
		h1 = Math.imul(h1 ^ ch, 2654435761);
		h2 = Math.imul(h2 ^ ch, 1597334677);
	}
	h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
	h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
	return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

// ---------------------------------------------------------------------------
// Git helpers
// ---------------------------------------------------------------------------

// Returns the "origin" remote URL for the given workspace root, or "" on failure.
function getGitRemoteUrl(workspaceRoot: string): string {
	try {
		return execSync('git remote get-url origin', { cwd: workspaceRoot, encoding: 'utf8' }).trim();
	} catch {
		return '';
	}
}

// ---------------------------------------------------------------------------
// Color utilities
// ---------------------------------------------------------------------------

// Converts HSL (h: 0–360, s: 0–100, l: 0–100) to a CSS hex color string.
// Uses the standard chroma-based formula so the output is always in-gamut sRGB.
function hslToHex(h: number, s: number, l: number): string {
	s /= 100;
	l /= 100;
	const a = s * Math.min(l, 1 - l);
	const f = (n: number) => {
		const k = (n + h / 30) % 12;
		const channel = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
		return Math.round(255 * channel).toString(16).padStart(2, '0');
	};
	return `#${f(0)}${f(8)}${f(4)}`;
}

// ---------------------------------------------------------------------------
// Title bar color logic
// ---------------------------------------------------------------------------

// Reads the kunterbunt settings, derives a hue from the git remote URL + salt,
// and writes the appropriate HSL-based colors to workbench.colorCustomizations.
async function applyTitleBarColor(channel: vscode.OutputChannel): Promise<void> {
	const config = vscode.workspace.getConfiguration('kunterbunt');
	const mode = config.get<string>('mode', 'dark');
	const salt = config.get<string>('salt', '');

	// Hash input: remoteUrl|salt — the pipe separator ensures salt is always
	// distinct from the URL even when one of them is empty.
	const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath;
	const remoteUrl = workspaceRoot ? getGitRemoteUrl(workspaceRoot) : '';
	const hue = cyrb53(`${remoteUrl}|${salt}`) % 360;

	channel.appendLine(`Remote URL: "${remoteUrl}", hue: ${hue}, mode: ${mode}`);

	// Saturation and lightness differ per mode so the bar is legible in both themes.
	let s: number, lActive: number, lInactive: number, fg: string;
	if (mode === 'light') {
		s = 80; lActive = 85; lInactive = 90; fg = '#1a1a1a';
	} else {
		s = 60; lActive = 25; lInactive = 20; fg = '#f0f0f0';
	}

	const activeBackground = hslToHex(hue, s, lActive);
	const inactiveBackground = hslToHex(hue, s, lInactive);

	// Prefer workspace-scoped settings so other windows are not affected.
	const target = vscode.workspace.workspaceFolders
		? vscode.ConfigurationTarget.Workspace
		: vscode.ConfigurationTarget.Global;

	const workbenchConfig = vscode.workspace.getConfiguration('workbench');
	const existing = workbenchConfig.get<Record<string, string>>('colorCustomizations') ?? {};

	await workbenchConfig.update('colorCustomizations', {
		...existing,
		'titleBar.activeBackground': activeBackground,
		'titleBar.activeForeground': fg,
		'titleBar.inactiveBackground': inactiveBackground,
		'titleBar.inactiveForeground': fg,
	}, target);
}

// ---------------------------------------------------------------------------
// Extension lifecycle
// ---------------------------------------------------------------------------

export function activate(context: vscode.ExtensionContext) {
	const channel = vscode.window.createOutputChannel('Kunterbunt');
	context.subscriptions.push(channel);
	channel.appendLine('Kunterbunt activated');

	const disposable = vscode.commands.registerCommand('kunterbunt.helloWorld', () => {
		vscode.window.showInformationMessage('Hello World from Kunterbunt!');
	});
	context.subscriptions.push(disposable);

	// Apply on startup, then re-apply whenever kunterbunt settings change.
	applyTitleBarColor(channel).catch(err => {
		vscode.window.showErrorMessage(`Kunterbunt: failed to apply title bar color: ${err}`);
	});

	const configListener = vscode.workspace.onDidChangeConfiguration(event => {
		if (event.affectsConfiguration('kunterbunt')) {
			applyTitleBarColor(channel).catch(err => {
				vscode.window.showErrorMessage(`Kunterbunt: failed to apply title bar color: ${err}`);
			});
		}
	});
	context.subscriptions.push(configListener);
}

export function deactivate() {}
