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

// Returns the current branch name, or "" on failure (e.g. detached HEAD).
function getGitBranch(workspaceRoot: string): string {
	try {
		return execSync('git symbolic-ref --short HEAD', { cwd: workspaceRoot, encoding: 'utf8' }).trim();
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
// Branch-to-color mapping
// ---------------------------------------------------------------------------

// Well-known branch names and prefixes map to fixed, semantically meaningful
// hues. task/chore return grey=true (saturation forced to 0). For any other
// prefix the prefix itself is hashed; for branches with no slash the whole
// branch name is hashed.
function branchToHue(branch: string): { hue: number; grey: boolean } {
	const lower = branch.toLowerCase();

	if (lower === 'main' || lower === 'master') {
		return { hue: 220, grey: false }; // Blue — stable baseline
	}

	const slashIdx = branch.indexOf('/');
	const prefix = slashIdx >= 0 ? lower.slice(0, slashIdx) : '';

	switch (prefix) {
		case 'feature':  return { hue: 120, grey: false }; // Green  — new development
		case 'bugfix':   return { hue:  55, grey: false }; // Yellow — needs attention
		case 'hotfix':   return { hue:   0, grey: false }; // Red    — critical/danger
		case 'release':  return { hue: 270, grey: false }; // Purple — preparing production
		case 'task':
		case 'chore':    return { hue:   0, grey: true  }; // Grey   — routine maintenance
		default: {
			// Hash the prefix when present; otherwise hash the whole branch name.
			const hashInput = prefix !== '' ? prefix : branch;
			return { hue: cyrb53(hashInput) % 360, grey: false };
		}
	}
}

// ---------------------------------------------------------------------------
// Color application
// ---------------------------------------------------------------------------

// Computes and writes all Kunterbunt-managed color customizations in a single
// update call to avoid any read-modify-write races on colorCustomizations.
//   Title bar  — hue derived from git remote URL + salt (stable per repo)
//   Activity bar — hue derived from current branch name (changes on checkout)
async function applyColors(channel: vscode.OutputChannel): Promise<void> {
	const config = vscode.workspace.getConfiguration('kunterbunt');
	const mode = config.get<string>('mode', 'dark');
	const salt = config.get<string>('salt', '');

	const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath;

	// --- Title bar ---
	const remoteUrl = workspaceRoot ? getGitRemoteUrl(workspaceRoot) : '';
	const titleHue = cyrb53(`${remoteUrl}|${salt}`) % 360;

	let titleS: number, titleLActive: number, titleLInactive: number, titleFg: string;
	if (mode === 'light') {
		titleS = 80; titleLActive = 85; titleLInactive = 90; titleFg = '#1a1a1a';
	} else {
		titleS = 60; titleLActive = 25; titleLInactive = 20; titleFg = '#f0f0f0';
	}

	// --- Activity bar ---
	const branch = workspaceRoot ? getGitBranch(workspaceRoot) : '';
	const { hue: activityHue, grey } = branchToHue(branch);

	let activityS: number, activityL: number, activityFg: string, activityInactiveFg: string;
	if (grey) {
		activityS = 0;
		if (mode === 'light') { activityL = 75; activityFg = '#1a1a1a'; activityInactiveFg = '#555555'; }
		else                  { activityL = 30; activityFg = '#f0f0f0'; activityInactiveFg = '#888888'; }
	} else {
		if (mode === 'light') { activityS = 75; activityL = 75; activityFg = '#1a1a1a'; activityInactiveFg = '#444444'; }
		else                  { activityS = 60; activityL = 25; activityFg = '#f0f0f0'; activityInactiveFg = '#aaaaaa'; }
	}

	channel.appendLine(
		`Remote: "${remoteUrl}" → titleHue: ${titleHue} | Branch: "${branch}" → activityHue: ${activityHue}${grey ? ' (grey)' : ''} | mode: ${mode}`
	);

	// Prefer workspace scope so other VS Code windows are not affected.
	const target = vscode.workspace.workspaceFolders
		? vscode.ConfigurationTarget.Workspace
		: vscode.ConfigurationTarget.Global;

	const workbenchConfig = vscode.workspace.getConfiguration('workbench');
	const existing = workbenchConfig.get<Record<string, string>>('colorCustomizations') ?? {};

	await workbenchConfig.update('colorCustomizations', {
		...existing,
		'titleBar.activeBackground':      hslToHex(titleHue, titleS, titleLActive),
		'titleBar.activeForeground':      titleFg,
		'titleBar.inactiveBackground':    hslToHex(titleHue, titleS, titleLInactive),
		'titleBar.inactiveForeground':    titleFg,
		'activityBar.background':         hslToHex(activityHue, activityS, activityL),
		'activityBar.foreground':         activityFg,
		'activityBar.inactiveForeground': activityInactiveFg,
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

	const apply = () => applyColors(channel).catch(err => {
		vscode.window.showErrorMessage(`Kunterbunt: failed to apply colors: ${err}`);
	});

	// Apply on startup.
	apply();

	// Re-apply when kunterbunt settings (mode, salt) change.
	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration(event => {
			if (event.affectsConfiguration('kunterbunt')) { apply(); }
		})
	);

	// Re-apply when the branch changes — git rewrites .git/HEAD on every checkout.
	const workspaceUri = vscode.workspace.workspaceFolders?.[0]?.uri;
	if (workspaceUri) {
		const headWatcher = vscode.workspace.createFileSystemWatcher(
			new vscode.RelativePattern(vscode.Uri.joinPath(workspaceUri, '.git'), 'HEAD')
		);
		headWatcher.onDidChange(apply);
		context.subscriptions.push(headWatcher);
	}
}

export function deactivate() {}
