// ---------------------------------------------------------------------------
// Hashing
// ---------------------------------------------------------------------------

// cyrb53: fast 53-bit non-cryptographic hash with good avalanche behaviour.
// Uses two independent 32-bit accumulators mixed via Math.imul, then combined
// into a single number that fits within JS's safe integer range.
export function cyrb53(str: string): number {
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
// Color utilities
// ---------------------------------------------------------------------------

// Converts HSL (h: 0–360, s: 0–100, l: 0–100) to a CSS hex color string.
// Uses the standard chroma-based formula so the output is always in-gamut sRGB.
export function hslToHex(h: number, s: number, l: number): string {
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
export function branchToHue(branch: string, salt = ''): { hue: number; grey: boolean } {
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
			return { hue: cyrb53(`${hashInput}|${salt}`) % 360, grey: false };
		}
	}
}
