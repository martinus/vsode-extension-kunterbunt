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

// Maps a branch name to a hue (0–360) by hashing the branch name and salt.
export function branchToHue(branch: string, salt = ''): number {
	return cyrb53(`${branch}|${salt}`) % 360;
}
