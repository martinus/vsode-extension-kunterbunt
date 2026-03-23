import * as vscode from 'vscode';
import { execSync } from 'child_process';
import { watch, existsSync } from 'fs';
import { join } from 'path';
import { cyrb53, hslToHex, branchToHue } from './colorUtils';

// Minimal type surface for VS Code's built-in git extension API.
// Full typings live in extensions/git/src/api/git.d.ts inside the VS Code repo.
interface GitExtension {
	getAPI(version: 1): GitAPI;
}
interface GitAPI {
	repositories: GitRepository[];
	onDidOpenRepository: vscode.Event<GitRepository>;
}
interface GitRepository {
	state: GitRepositoryState;
}
interface GitRepositoryState {
	onDidChange: vscode.Event<void>;
}

// ---------------------------------------------------------------------------
// Git helpers
// ---------------------------------------------------------------------------

/**
 * Reads the `origin` remote URL from the git repository in `workspaceRoot`.
 * Returns an empty string when the folder is not a git repository or the
 * remote cannot be resolved.
 */
function getGitRemoteUrl(workspaceRoot: string): string {
	try {
		return execSync('git remote get-url origin', { cwd: workspaceRoot, encoding: 'utf8' }).trim();
	} catch {
		return '';
	}
}

/**
 * Reads the current git ref for `workspaceRoot`.  Tries the symbolic branch
 * name first.  When HEAD is detached (e.g. a tag checkout) it falls back to
 * `git describe --tags --exact-match` to return the tag name.  Returns an
 * empty string when neither a branch nor a tag can be determined.
 */
function getGitRef(workspaceRoot: string): string {
	try {
		return execSync('git symbolic-ref --short HEAD', { cwd: workspaceRoot, encoding: 'utf8' }).trim();
	} catch {
		// Detached HEAD — try to resolve a tag name.
		try {
			return execSync('git describe --tags --exact-match HEAD', {
				cwd: workspaceRoot,
				encoding: 'utf8',
				stdio: ['pipe', 'pipe', 'pipe'],
			}).trim();
		} catch {
			return '';
		}
	}
}

// ---------------------------------------------------------------------------
// Color application
// ---------------------------------------------------------------------------

// Track the last successfully resolved git values so we can detect transient
// git failures (e.g. index.lock held during rebase) and avoid overwriting
// good colors with empty-string defaults.
let lastRemoteUrl: string | undefined;
let lastRef: string | undefined;

type KunterbuntMode = 'light' | 'dark';

type TitleBarPalette = {
	saturation: number;
	activeLightness: number;
	inactiveLightness: number;
	foreground: string;
};

type ActivityPalette = {
	saturation: number;
	baseLightness: number;
	foreground: string;
	inactiveForeground: string;
};

type ActivityEffects = {
	hoverDelta: number;
	hoverMax: number;
	activeDelta: number;
	activeMin?: number;
	activeMax?: number;
	activeBorderSaturation: number;
	activeBorderLightness: number;
};

type ModeTuning = {
	titleBar: TitleBarPalette;
	activity: {
		default: ActivityPalette;
		grey: ActivityPalette;
		effects: ActivityEffects;
	};
};

// Central place for all color-tuning values. Adjust these numbers when you
// want to change the visual feel without touching the color application logic.
const MODE_TUNING: Record<KunterbuntMode, ModeTuning> = {
	light: {
		titleBar: {
			saturation: 80, // Keep light title bars vivid enough to be identifiable.
			activeLightness: 85, // Bright active title bar while preserving text contrast.
			inactiveLightness: 90, // Slightly brighter inactive title bar for softer contrast.
			foreground: '#1a1a1a', // Dark text that stays readable on light backgrounds.
		},
		activity: {
			default: {
				saturation: 75, // Main branch color intensity in light mode.
				baseLightness: 75, // Default activity/status bar background lightness.
				foreground: '#1a1a1a', // Foreground color for active icons and text.
				inactiveForeground: '#444444', // Muted icons that still read on light backgrounds.
			},
			grey: {
				saturation: 0, // Neutral branch variants intentionally remove hue.
				baseLightness: 75, // Keep neutral branches aligned with light-mode base brightness.
				foreground: '#1a1a1a', // Same foreground contrast as the colored variant.
				inactiveForeground: '#555555', // Slightly softer muted foreground for greys.
			},
			effects: {
				hoverDelta: 12, // Hover state gets lighter than the base background.
				hoverMax: 95, // Cap hover brightness to avoid washing out the color.
				activeDelta: 10, // Active item background shift relative to the base.
				activeMax: 92, // Upper limit so active state remains visibly colored.
				activeBorderSaturation: 90, // Fixed strong saturation for the opposite-hue indicator.
				activeBorderLightness: 40, // Dark enough to stay visible in light mode.
			},
		},
	},
	dark: {
		titleBar: {
			saturation: 60, // Slightly restrained saturation reads better on dark chrome.
			activeLightness: 25, // Dark active title bar with enough chroma to stand out.
			inactiveLightness: 20, // Inactive title bar recedes a bit further into the frame.
			foreground: '#f0f0f0', // Light text color for dark backgrounds.
		},
		activity: {
			default: {
				saturation: 60, // Main branch color intensity in dark mode.
				baseLightness: 25, // Default activity/status bar darkness.
				foreground: '#f0f0f0', // Foreground color for active icons and text.
				inactiveForeground: '#aaaaaa', // Muted icons that still read on dark backgrounds.
			},
			grey: {
				saturation: 0, // Neutral branch variants intentionally remove hue.
				baseLightness: 30, // Grey mode is slightly lighter so it does not look muddy.
				foreground: '#f0f0f0', // Same foreground contrast as the colored variant.
				inactiveForeground: '#888888', // Muted foreground tuned for neutral dark backgrounds.
			},
			effects: {
				hoverDelta: 14, // Hover state gets lighter than the base background.
				hoverMax: 48, // Cap hover brightness so it stays within dark-mode chrome.
				activeDelta: 12, // Active item background shift relative to the base.
				activeMax: 42, // Upper limit so active state remains distinct but still dark.
				activeBorderSaturation: 60, // Moderate saturation keeps the border visible without neon glow.
				activeBorderLightness: 60, // Bright enough to stand out against the dark activity bar.
			},
		},
	},
};

/**
 * Applies a lightness delta and then clamps the result into optional bounds.
 * This keeps hover and active states visually related to the base color while
 * preventing values that become too bright or too dark.
 */
function clampAdjustedLightness(base: number, delta: number, bounds: { min?: number; max?: number }): number {
	const adjusted = base + delta;
	if (bounds.min !== undefined && adjusted < bounds.min) {
		return bounds.min;
	}
	if (bounds.max !== undefined && adjusted > bounds.max) {
		return bounds.max;
	}
	return adjusted;
}

/**
 * Computes the current git-derived colors and writes the managed workbench
 * color customizations in a single update to avoid read-modify-write races.
 *
 * Title bar hue comes from the repository remote URL plus salt, while the
 * activity and status bar hue comes from the current git ref (branch or tag) plus salt.
 */
async function applyColors(channel: vscode.OutputChannel): Promise<void> {
	const config = vscode.workspace.getConfiguration('kunterbunt');
	const mode = config.get<KunterbuntMode>('mode', 'dark');
	const salt = config.get<string>('salt', '');
	const tuning = MODE_TUNING[mode];

	const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath;

	// --- Resolve git state, falling back to previous values on failure ---
	let remoteUrl = workspaceRoot ? getGitRemoteUrl(workspaceRoot) : '';
	let ref = workspaceRoot ? getGitRef(workspaceRoot) : '';

	if (workspaceRoot && remoteUrl === '' && lastRemoteUrl !== undefined) {
		remoteUrl = lastRemoteUrl;
	}
	if (workspaceRoot && ref === '' && lastRef !== undefined) {
		ref = lastRef;
	}

	// On the very first call, git may not be ready yet (workspace still
	// initialising).  Skip writing empty-string-based colors and retry soon
	// so we never flash the "no repo / no ref" palette on startup.
	if (workspaceRoot && remoteUrl === '' && ref === '' && lastRemoteUrl === undefined) {
		channel.appendLine('Git not ready yet — deferring initial color application');
		return;
	}

	lastRemoteUrl = remoteUrl;
	lastRef = ref;

	// --- Title bar ---
	const titleHue = cyrb53(`${remoteUrl}|${salt}`) % 360;
	const titleBar = tuning.titleBar;

	// --- Activity bar ---
	const { hue: activityHue, grey } = branchToHue(ref, salt);
	const activityPalette = grey ? tuning.activity.grey : tuning.activity.default;
	const activityEffects = tuning.activity.effects;
	const activityS = activityPalette.saturation;
	const activityL = activityPalette.baseLightness;
	const activityFg = activityPalette.foreground;
	const activityInactiveFg = activityPalette.inactiveForeground;

	const activityBackground = hslToHex(activityHue, activityS, activityL);
	const activityHoverBackground = hslToHex(
		activityHue,
		activityS,
		clampAdjustedLightness(activityL, activityEffects.hoverDelta, { max: activityEffects.hoverMax })
	);
	const activityActiveBackground = hslToHex(
		activityHue,
		activityS,
		clampAdjustedLightness(activityL, activityEffects.activeDelta, {
			min: activityEffects.activeMin,
			max: activityEffects.activeMax,
		})
	);
	// Diametral (opposite) hue for the active sidebar indicator line.
	const diametralHue = (activityHue + 180) % 360;
	const activeBorderColor = hslToHex(
		diametralHue,
		activityEffects.activeBorderSaturation,
		activityEffects.activeBorderLightness
	);

	channel.appendLine(
		`Remote: "${remoteUrl}" → titleHue: ${titleHue} | Ref: "${ref}" → activityHue: ${activityHue}${grey ? ' (grey)' : ''} | mode: ${mode}`
	);

	// Prefer workspace scope so other VS Code windows are not affected.
	const target = vscode.workspace.workspaceFolders
		? vscode.ConfigurationTarget.Workspace
		: vscode.ConfigurationTarget.Global;

	const workbenchConfig = vscode.workspace.getConfiguration('workbench');
	const existing = workbenchConfig.get<Record<string, string>>('colorCustomizations') ?? {};

	await workbenchConfig.update('colorCustomizations', {
		...existing,
		'titleBar.activeBackground': hslToHex(titleHue, titleBar.saturation, titleBar.activeLightness),
		'titleBar.activeForeground': titleBar.foreground,
		'titleBar.inactiveBackground': hslToHex(titleHue, titleBar.saturation, titleBar.inactiveLightness),
		'titleBar.inactiveForeground': titleBar.foreground,
		'activityBar.background': activityBackground,
		'activityBar.activeBackground': activityActiveBackground,
		'activityBar.foreground': activityFg,
		'activityBar.inactiveForeground': activityInactiveFg,
		'activityBar.activeBorder': activeBorderColor,
		'statusBar.background': activityBackground,
		'statusBar.foreground': activityFg,
		'statusBar.noFolderBackground': activityBackground,
		'statusBar.noFolderForeground': activityFg,
		'statusBar.debuggingBackground': activityBackground,
		'statusBar.debuggingForeground': activityFg,
		'statusBarItem.hoverBackground': activityHoverBackground,
	}, target);
}

// ---------------------------------------------------------------------------
// Extension lifecycle
// ---------------------------------------------------------------------------

/**
 * Activates the extension, registers commands and subscriptions, and starts
 * the git watchers that keep the workbench colors in sync with repository
 * state and Kunterbunt settings.
 */
export function activate(context: vscode.ExtensionContext) {
	const channel = vscode.window.createOutputChannel('Kunterbunt');
	context.subscriptions.push(channel);
	channel.appendLine('Kunterbunt activated');

	const disposable = vscode.commands.registerCommand('kunterbunt.helloWorld', () => {
		vscode.window.showInformationMessage('Hello World from Kunterbunt!');
	});
	context.subscriptions.push(disposable);

	// Debounce repeated triggers so a burst of file system and configuration
	// events results in a single color recomputation.
	let applyTimer: ReturnType<typeof setTimeout> | undefined;
	const scheduleApply = () => {
		if (applyTimer !== undefined) { clearTimeout(applyTimer); }
		applyTimer = setTimeout(() => {
			applyColors(channel).catch(err => {
				vscode.window.showErrorMessage(`Kunterbunt: failed to apply colors: ${err}`);
			});
		}, 300);
	};

	// Watch .git/HEAD with Node's fs.watch because VS Code's file watcher does
	// not reliably report changes from inside the .git directory.
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

	// Apply on startup.  Git may not be available immediately in a fresh
	// Extension Development Host, so retry with increasing back-off until
	// we get valid git data (applyColors will bail out without writing when
	// both remote URL and ref are empty on the first run).
	const initialApply = async (attempt: number) => {
		await applyColors(channel);
		if (lastRemoteUrl === undefined && attempt < 5) {
			const delay = 500 * (attempt + 1);
			channel.appendLine(`Git not ready — retry #${attempt + 1} in ${delay}ms`);
			setTimeout(() => {
				initialApply(attempt + 1).catch(err => {
					vscode.window.showErrorMessage(`Kunterbunt: failed to apply colors: ${err}`);
				});
			}, delay);
		}
	};
	initialApply(0).catch(err => {
		vscode.window.showErrorMessage(`Kunterbunt: failed to apply colors: ${err}`);
	});
	for (const folder of vscode.workspace.workspaceFolders ?? []) {
		watchGitHead(folder.uri.fsPath);
	}

	// Subscribe to VS Code's built-in git extension so we detect branch/tag
	// switches triggered via the status bar or command palette.  The fs.watch
	// on .git/HEAD alone is not reliable for those operations.
	const gitExtension = vscode.extensions.getExtension<GitExtension>('vscode.git');
	if (gitExtension) {
		const activateGitWatcher = (git: GitExtension) => {
			const api = git.getAPI(1);
			for (const repo of api.repositories) {
				context.subscriptions.push(
					repo.state.onDidChange(() => {
						channel.appendLine('Git state changed (vscode.git) — scheduling color update');
						scheduleApply();
					})
				);
			}
			context.subscriptions.push(
				api.onDidOpenRepository(repo => {
					context.subscriptions.push(
						repo.state.onDidChange(() => {
							channel.appendLine('Git state changed (vscode.git) — scheduling color update');
							scheduleApply();
						})
					);
				})
			);
		};
		if (gitExtension.isActive) {
			activateGitWatcher(gitExtension.exports);
		} else {
			gitExtension.activate().then(exports => {
				activateGitWatcher(exports);
			});
		}
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

/**
 * Deactivation hook for symmetry with VS Code's extension lifecycle.
 * No explicit teardown is needed because disposables are registered on the
 * extension context and are released automatically.
 */
export function deactivate() { }
