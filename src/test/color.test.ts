import assert from "assert";
import {
    hashString,
    hslToHex,
    getForegroundColor,
    getFolderColor,
    getColorSet,
} from "../color";

describe("hashString", () => {
    it("returns a non-negative integer", () => {
        assert.ok(hashString("hello") >= 0);
        assert.ok(hashString("") >= 0);
    });

    it("is deterministic", () => {
        assert.strictEqual(hashString("my-project"), hashString("my-project"));
    });

    it("produces different hashes for different inputs", () => {
        assert.notStrictEqual(hashString("foo"), hashString("bar"));
        assert.notStrictEqual(hashString("project-a"), hashString("project-b"));
    });

    it("handles empty string without throwing", () => {
        assert.doesNotThrow(() => hashString(""));
    });
});

describe("hslToHex", () => {
    it("returns a valid 7-character hex string", () => {
        const hex = hslToHex(0, 0, 0);
        assert.match(hex, /^#[0-9a-f]{6}$/i);
    });

    it("black is #000000", () => {
        assert.strictEqual(hslToHex(0, 0, 0), "#000000");
    });

    it("white is #ffffff", () => {
        assert.strictEqual(hslToHex(0, 0, 100), "#ffffff");
    });

    it("pure red is #ff0000", () => {
        assert.strictEqual(hslToHex(0, 100, 50), "#ff0000");
    });

    it("pure green is #00ff00", () => {
        assert.strictEqual(hslToHex(120, 100, 50), "#00ff00");
    });

    it("pure blue is #0000ff", () => {
        assert.strictEqual(hslToHex(240, 100, 50), "#0000ff");
    });

    it("is deterministic", () => {
        assert.strictEqual(hslToHex(180, 60, 40), hslToHex(180, 60, 40));
    });
});

describe("getForegroundColor", () => {
    it("returns white for dark backgrounds", () => {
        assert.strictEqual(getForegroundColor("#000000"), "#ffffff");
        assert.strictEqual(getForegroundColor("#1a1a2e"), "#ffffff");
    });

    it("returns black for light backgrounds", () => {
        assert.strictEqual(getForegroundColor("#ffffff"), "#000000");
        assert.strictEqual(getForegroundColor("#ffffcc"), "#000000");
    });

    it("returns a valid color string", () => {
        const fg = getForegroundColor("#3c6e71");
        assert.ok(fg === "#ffffff" || fg === "#000000");
    });
});

describe("getFolderColor", () => {
    it("returns a valid 7-character hex color", () => {
        const color = getFolderColor("my-project");
        assert.match(color, /^#[0-9a-f]{6}$/i);
    });

    it("is deterministic for the same folder name", () => {
        assert.strictEqual(
            getFolderColor("workspace"),
            getFolderColor("workspace")
        );
    });

    it("produces different colors for different folder names", () => {
        // These are very likely to be different given the hash function
        const colorsAreDifferent =
            getFolderColor("project-alpha") !== getFolderColor("project-beta");
        assert.ok(colorsAreDifferent);
    });
});

describe("getColorSet", () => {
    it("returns an object with background and foreground", () => {
        const { background, foreground } = getColorSet("some-folder");
        assert.match(background, /^#[0-9a-f]{6}$/i);
        assert.ok(foreground === "#ffffff" || foreground === "#000000");
    });

    it("is deterministic", () => {
        const a = getColorSet("test-project");
        const b = getColorSet("test-project");
        assert.strictEqual(a.background, b.background);
        assert.strictEqual(a.foreground, b.foreground);
    });
});
