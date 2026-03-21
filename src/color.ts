/**
 * Computes a non-negative 32-bit integer hash from a string using a
 * DJB2-style XOR variant.
 */
export function hashString(str: string): number {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
        hash = hash >>> 0; // keep unsigned 32-bit
    }
    return hash;
}

/**
 * Converts HSL color values to a CSS hex color string.
 * @param h Hue in degrees [0, 360)
 * @param s Saturation in percent [0, 100]
 * @param l Lightness in percent [0, 100]
 */
export function hslToHex(h: number, s: number, l: number): string {
    s /= 100;
    l /= 100;

    const a = s * Math.min(l, 1 - l);
    const f = (n: number): string => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color)
            .toString(16)
            .padStart(2, "0");
    };
    return `#${f(0)}${f(8)}${f(4)}`;
}

/**
 * Derives a foreground color (white or black) that provides good contrast
 * against the given background hex color.
 */
export function getForegroundColor(bgHex: string): string {
    const r = parseInt(bgHex.slice(1, 3), 16);
    const g = parseInt(bgHex.slice(3, 5), 16);
    const b = parseInt(bgHex.slice(5, 7), 16);

    // Relative luminance per WCAG 2.1
    const toLinear = (c: number): number => {
        const sRGB = c / 255;
        return sRGB <= 0.04045
            ? sRGB / 12.92
            : Math.pow((sRGB + 0.055) / 1.055, 2.4);
    };
    const luminance =
        0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);

    return luminance > 0.179 ? "#000000" : "#ffffff";
}

/**
 * Derives a consistent background color for the given workspace folder name.
 * Uses a fixed saturation and lightness tuned for VS Code chrome elements.
 */
export function getFolderColor(folderName: string): string {
    const hash = hashString(folderName);
    const hue = hash % 360;
    // Saturation 60 %, lightness 30 % → vivid-but-dark color suitable for bars
    return hslToHex(hue, 60, 30);
}

export interface ColorSet {
    background: string;
    foreground: string;
}

/** Returns the background and foreground pair for a given folder name. */
export function getColorSet(folderName: string): ColorSet {
    const background = getFolderColor(folderName);
    const foreground = getForegroundColor(background);
    return { background, foreground };
}
