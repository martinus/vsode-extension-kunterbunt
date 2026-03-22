import * as assert from 'assert';
import { cyrb53, hslToHex, branchToHue } from '../colorUtils';

suite('cyrb53', () => {
	test('returns a non-negative number', () => {
		assert.ok(cyrb53('anything') >= 0);
	});

	test('returns a safe integer (≤ 2^53)', () => {
		for (const input of ['', 'hello', 'a very long string that keeps going']) {
			assert.ok(Number.isSafeInteger(cyrb53(input)), `not safe integer for "${input}"`);
		}
	});

	test('empty string produces a deterministic value', () => {
		assert.strictEqual(cyrb53(''), cyrb53(''));
	});

	test('same input always produces the same output', () => {
		assert.strictEqual(cyrb53('test'), cyrb53('test'));
	});

	test('different inputs produce different outputs', () => {
		const a = cyrb53('hello');
		const b = cyrb53('world');
		assert.notStrictEqual(a, b);
	});

	test('small input changes produce large output changes (avalanche)', () => {
		const a = cyrb53('abc');
		const b = cyrb53('abd');
		// The two hashes should differ by more than a trivial amount.
		const diff = Math.abs(a - b);
		assert.ok(diff > 1000, `expected large diff, got ${diff}`);
	});

	test('hash covers a wide range across many inputs', () => {
		const hues = new Set<number>();
		for (let i = 0; i < 1000; i++) {
			hues.add(cyrb53(`input-${i}`) % 360);
		}
		// With 1000 inputs mapped to 360 buckets, we expect most buckets filled.
		assert.ok(hues.size > 300, `expected >300 distinct hues, got ${hues.size}`);
	});
});

suite('hslToHex', () => {
	test('pure red (0, 100, 50) → #ff0000', () => {
		assert.strictEqual(hslToHex(0, 100, 50), '#ff0000');
	});

	test('pure green (120, 100, 50) → #00ff00', () => {
		assert.strictEqual(hslToHex(120, 100, 50), '#00ff00');
	});

	test('pure blue (240, 100, 50) → #0000ff', () => {
		assert.strictEqual(hslToHex(240, 100, 50), '#0000ff');
	});

	test('black (0, 0, 0) → #000000', () => {
		assert.strictEqual(hslToHex(0, 0, 0), '#000000');
	});

	test('white (0, 0, 100) → #ffffff', () => {
		assert.strictEqual(hslToHex(0, 0, 100), '#ffffff');
	});

	test('50% grey (0, 0, 50) → #808080', () => {
		assert.strictEqual(hslToHex(0, 0, 50), '#808080');
	});

	test('returns 7-character hex string', () => {
		for (let h = 0; h < 360; h += 37) {
			const hex = hslToHex(h, 60, 25);
			assert.match(hex, /^#[0-9a-f]{6}$/, `bad format for hue ${h}: ${hex}`);
		}
	});

	test('dark mode parameters produce valid dark colors', () => {
		const hex = hslToHex(180, 60, 25);
		// Lightness 25% → each RGB channel should be ≤ 128.
		const r = parseInt(hex.slice(1, 3), 16);
		const g = parseInt(hex.slice(3, 5), 16);
		const b = parseInt(hex.slice(5, 7), 16);
		assert.ok(r <= 128 && g <= 128 && b <= 128,
			`expected dark color, got ${hex} (r=${r}, g=${g}, b=${b})`);
	});

	test('light mode parameters produce valid light colors', () => {
		const hex = hslToHex(180, 80, 85);
		const r = parseInt(hex.slice(1, 3), 16);
		const g = parseInt(hex.slice(3, 5), 16);
		const b = parseInt(hex.slice(5, 7), 16);
		assert.ok(r >= 128 && g >= 128 && b >= 128,
			`expected light color, got ${hex} (r=${r}, g=${g}, b=${b})`);
	});
});

suite('branchToHue', () => {
	// --- Well-known branch names ---

	test('main → blue (220), not grey', () => {
		const result = branchToHue('main');
		assert.strictEqual(result.hue, 220);
		assert.strictEqual(result.grey, false);
	});

	test('master → blue (220), not grey', () => {
		const result = branchToHue('master');
		assert.strictEqual(result.hue, 220);
		assert.strictEqual(result.grey, false);
	});

	test('main/master are case-insensitive', () => {
		assert.strictEqual(branchToHue('Main').hue, 220);
		assert.strictEqual(branchToHue('MASTER').hue, 220);
	});

	// --- Well-known prefixes ---

	test('feature/ → green (120)', () => {
		const result = branchToHue('feature/add-login');
		assert.strictEqual(result.hue, 120);
		assert.strictEqual(result.grey, false);
	});

	test('bugfix/ → yellow (55)', () => {
		const result = branchToHue('bugfix/fix-crash');
		assert.strictEqual(result.hue, 55);
		assert.strictEqual(result.grey, false);
	});

	test('hotfix/ → red (0)', () => {
		const result = branchToHue('hotfix/urgent');
		assert.strictEqual(result.hue, 0);
		assert.strictEqual(result.grey, false);
	});

	test('release/ → purple (270)', () => {
		const result = branchToHue('release/v2.0');
		assert.strictEqual(result.hue, 270);
		assert.strictEqual(result.grey, false);
	});

	test('task/ → grey', () => {
		const result = branchToHue('task/cleanup');
		assert.strictEqual(result.grey, true);
	});

	test('chore/ → grey', () => {
		const result = branchToHue('chore/update-deps');
		assert.strictEqual(result.grey, true);
	});

	// --- Prefix case-insensitivity ---

	test('Feature/ (capitalized) → green (120)', () => {
		assert.strictEqual(branchToHue('Feature/something').hue, 120);
	});

	test('HOTFIX/ (uppercase) → red (0)', () => {
		assert.strictEqual(branchToHue('HOTFIX/critical').hue, 0);
	});

	// --- Unknown prefix → hashed ---

	test('unknown prefix hashes the prefix, not the full branch', () => {
		const a = branchToHue('experiment/foo');
		const b = branchToHue('experiment/bar');
		// Same prefix → same hue.
		assert.strictEqual(a.hue, b.hue);
		assert.strictEqual(a.grey, false);
	});

	test('different unknown prefixes produce different hues', () => {
		const a = branchToHue('experiment/foo');
		const b = branchToHue('sandbox/foo');
		assert.notStrictEqual(a.hue, b.hue);
	});

	// --- No prefix → hash whole branch ---

	test('branch without slash hashes the full name', () => {
		const a = branchToHue('my-branch');
		const b = branchToHue('other-branch');
		assert.notStrictEqual(a.hue, b.hue);
		assert.strictEqual(a.grey, false);
	});

	// --- Edge cases ---

	test('empty string returns a result without throwing', () => {
		const result = branchToHue('');
		assert.strictEqual(typeof result.hue, 'number');
		assert.strictEqual(typeof result.grey, 'boolean');
	});

	test('hue is always in [0, 360)', () => {
		const branches = [
			'main', 'feature/x', 'bugfix/y', 'hotfix/z',
			'release/1', 'task/a', 'chore/b', 'custom/c',
			'no-prefix', '', 'a/b/c/d',
		];
		for (const branch of branches) {
			const { hue } = branchToHue(branch);
			assert.ok(hue >= 0 && hue < 360, `hue ${hue} out of range for "${branch}"`);
		}
	});

	test('nested slashes use only the first segment as prefix', () => {
		// "feature/sub/detail" should still match "feature" prefix → hue 120.
		assert.strictEqual(branchToHue('feature/sub/detail').hue, 120);
	});
});
