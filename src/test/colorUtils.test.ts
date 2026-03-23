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
	test('returns a number', () => {
		assert.strictEqual(typeof branchToHue('main'), 'number');
	});

	test('empty string returns a number without throwing', () => {
		assert.strictEqual(typeof branchToHue(''), 'number');
	});

	test('hue is always in [0, 360)', () => {
		const branches = [
			'main', 'feature/x', 'bugfix/y', 'hotfix/z',
			'release/1', 'task/a', 'chore/b', 'custom/c',
			'no-prefix', '', 'a/b/c/d',
		];
		for (const branch of branches) {
			const hue = branchToHue(branch);
			assert.ok(hue >= 0 && hue < 360, `hue ${hue} out of range for "${branch}"`);
		}
	});

	test('different branches produce different hues', () => {
		assert.notStrictEqual(branchToHue('my-branch'), branchToHue('other-branch'));
		assert.notStrictEqual(branchToHue('experiment/foo'), branchToHue('sandbox/foo'));
	});

	test('same branch always produces the same hue', () => {
		assert.strictEqual(branchToHue('feature/login'), branchToHue('feature/login'));
	});

	test('salt changes the hue', () => {
		assert.notStrictEqual(branchToHue('experiment/foo', 'salt-a'), branchToHue('experiment/foo', 'salt-b'));
		assert.notStrictEqual(branchToHue('my-branch', 'salt-a'), branchToHue('my-branch', 'salt-b'));
	});
});
