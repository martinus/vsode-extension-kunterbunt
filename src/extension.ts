import * as vscode from 'vscode';
import { execSync } from 'child_process';
import { watch, existsSync } from 'fs';
import { join } from 'path';
import { cyrb53, hslToHex, branchToHue } from './colorUtils';

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
// Color application
// ---------------------------------------------------------------------------

// Track the last successfully resolved git values so we can detect transient
// git failures (e.g. index.lock held during rebase) and avoid overwriting
// good colors with empty-string defaults.
let lastRemoteUrl: string | undefined;
let lastBranch: string | undefined;

// Computes and writes all Kunterbunt-managed color customizations in a single
// update call to avoid any read-modify-write races on colorCustomizations.
//   Title bar  — hue derived from git remote URL + salt (stable per repo)
//   Activity bar — hue derived from current branch name (changes on checkout)
async function applyColors(channel: vscode.OutputChannel): Promise<void> {
	const config = vscode.workspace.getConfiguration('kunterbunt');
	const mode = config.get<string>('mode', 'dark');
	const salt = config.get<string>('salt', '');

	const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath;

	// --- Resolve git state, falling back to previous values on failure ---
	let remoteUrl = workspaceRoot ? getGitRemoteUrl(workspaceRoot) : '';
	let branch = workspaceRoot ? getGitBranch(workspaceRoot) : '';

	if (workspaceRoot && remoteUrl === '' && lastRemoteUrl !== undefined) {
		remoteUrl = lastRemoteUrl;
	}
	if (workspaceRoot && branch === '' && lastBranch !== undefined) {
		branch = lastBranch;
	}
	lastRemoteUrl = remoteUrl;
	lastBranch = branch;

	// --- Title bar ---
	const titleHue = cyrb53(`${remoteUrl}|${salt}`) % 360;

	let titleS: number, titleLActive: number, titleLInactive: number, titleFg: string;
	if (mode === 'light') {
		titleS = 80; titleLActive = 85; titleLInactive = 90; titleFg = '#1a1a1a';
	} else {
		titleS = 60; titleLActive = 25; titleLInactive = 20; titleFg = '#f0f0f0';
	}

	// --- Activity bar ---
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

	// Debounce: collapse rapid consecutive triggers into a single call so
	// we only apply once even when multiple events fire close together.
	let applyTimer: ReturnType<typeof setTimeout> | undefined;
	const scheduleApply = () => {
		if (applyTimer !== undefined) { clearTimeout(applyTimer); }
		applyTimer = setTimeout(() => {
			applyColors(channel).catch(err => {
				vscode.window.showErrorMessage(`Kunterbunt: failed to apply colors: ${err}`);
			});
		}, 300);
	};

	// Watch .git/HEAD with Node's fs.watch — VS Code's createFileSystemWatcher
	// does not reliably deliver events for files inside .git/.
	const watchGitHead = (folderPath: string) => {
		const headPath = join(folderPath, '.git', 'HEAD');
		if (!existsSync(headPath)) { return; }
		try {
			const watcher = watch(headPath, () => {
				channel.appendLine('.git/HEAD changed — scheduling color update');
				scheduleApply();
			});
			context.subscriptions.push({ dispose: () => watcher.close() });
		} catch (err) {
			channel.appendLine(`Could not watch ${headPath}: ${err}`);
		}
	};

	// Apply on startup and set up HEAD watchers for all current folders.
	scheduleApply();
	for (const folder of vscode.workspace.workspaceFolders ?? []) {
		watchGitHead(folder.uri.fsPath);
	}

	// Re-apply when kunterbunt settings (mode, salt) change.
	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration(event => {
			if (event.affectsConfiguration('kunterbunt')) { scheduleApply(); }
		})
	);

	// Re-apply and register watchers when folders are added (e.g. "open folder"
	// into an already-running window, or multi-root workspace changes).
	context.subscriptions.push(
		vscode.workspace.onDidChangeWorkspaceFolders(event => {
			scheduleApply();
			for (const folder of event.added) {
				watchGitHead(folder.uri.fsPath);
			}
		})
	);
}

export function deactivate() {}
