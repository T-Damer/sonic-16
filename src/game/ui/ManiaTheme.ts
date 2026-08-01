/**
 * Visual language for the front-end, drawn entirely with Phaser vector graphics.
 * No image assets — the whole menu is procedural, like the rest of the project.
 */

export const THEME = {
    /** SEGA-yellow field the whole menu sits on. */
    bg: 0xf5c518,
    bgDeep: 0xe0a908,

    /** Concentric arc ribbons behind everything. */
    arcs: [0xe8892b, 0x8fa6b8, 0xd13b2e, 0x3f8f7a, 0xe8892b, 0x8fa6b8],

    banner: 0x1c2f9e,
    bannerEdge: 0x0f1c6b,

    bar: 0x101014,
    barEdge: 0x2b2b34,
    barSelected: 0x1c1c26,

    textPrimary: '#ffffff',
    textSelected: '#ffd23f',
    textDim: '#b8b8c4',

    titleFill: '#ffd23f',
    /** Same colour as `titleFill`, for the Graphics API which wants a number. */
    titleFillHex: 0xffd23f,
    titleStroke: '#1c1c1c',

    /** The rainbow rule under the banner. */
    rainbow: [0xd13b2e, 0xf5c518, 0x3fa64b, 0x2f6fd0],

    panelSpace: 0x120c33,
    panelStar: 0xffffff,

    promptRing: 0x2b2b34,
    promptCross: 0x2f6fd0,
} as const;

/** Shared font stack — heavy, condensed, close to the arcade look. */
export const FONT_HEAVY = '"Arial Black", "Arial Bold", Impact, system-ui, sans-serif';
export const FONT_BODY = '"Arial Black", Arial, system-ui, sans-serif';

export const SKEW = 0.28;

/**
 * Draws one of the angled black option bars.
 * The right edge is sheared so the stack reads as a fan, like the reference menu.
 */
export function drawAngledBar(
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    width: number,
    height: number,
    color: number,
    alpha = 1,
): void {
    const shear = height * SKEW;
    graphics.fillStyle(color, alpha);
    graphics.beginPath();
    graphics.moveTo(x + shear, y);
    graphics.lineTo(x + width, y);
    graphics.lineTo(x + width - shear, y + height);
    graphics.lineTo(x, y + height);
    graphics.closePath();
    graphics.fillPath();
}

/** A chevron-ended banner plate for headings. */
export function drawBanner(
    graphics: Phaser.GameObjects.Graphics,
    centerX: number,
    y: number,
    width: number,
    height: number,
    color: number,
): void {
    const half = width / 2;
    const notch = height * 0.5;
    graphics.fillStyle(color, 1);
    graphics.beginPath();
    graphics.moveTo(centerX - half + notch, y);
    graphics.lineTo(centerX + half - notch, y);
    graphics.lineTo(centerX + half, y + height / 2);
    graphics.lineTo(centerX + half - notch, y + height);
    graphics.lineTo(centerX - half + notch, y + height);
    graphics.lineTo(centerX - half, y + height / 2);
    graphics.closePath();
    graphics.fillPath();
}

/** The four-segment rainbow rule that sits under the banner. */
export function drawRainbowRule(
    graphics: Phaser.GameObjects.Graphics,
    centerX: number,
    y: number,
    width: number,
    thickness: number,
): void {
    const segments = THEME.rainbow.length;
    const segWidth = width / segments;
    const shear = thickness * 1.6;

    for (let i = 0; i < segments; i++) {
        const x = centerX - width / 2 + i * segWidth;
        graphics.fillStyle(THEME.rainbow[i], 1);
        graphics.beginPath();
        graphics.moveTo(x + shear, y);
        graphics.lineTo(x + segWidth + shear, y);
        graphics.lineTo(x + segWidth, y + thickness);
        graphics.lineTo(x, y + thickness);
        graphics.closePath();
        graphics.fillPath();
    }
}

/** Button-prompt pip: a filled circle with a glyph, as used in the corners. */
export function drawPromptPip(
    scene: Phaser.Scene,
    x: number,
    y: number,
    glyph: string,
    color: number,
    label: string,
): Phaser.GameObjects.Container {
    const container = scene.add.container(x, y);

    const graphics = scene.add.graphics();
    graphics.fillStyle(0x14141a, 1);
    graphics.fillCircle(0, 0, 22);
    graphics.lineStyle(3, color, 1);
    graphics.strokeCircle(0, 0, 22);
    container.add(graphics);

    const glyphText = scene.add.text(0, 0, glyph, {
        fontFamily: FONT_HEAVY,
        fontSize: '22px',
        color: '#ffffff',
    }).setOrigin(0.5);
    container.add(glyphText);

    // the trailing black tab carrying the label
    const tab = scene.add.graphics();
    drawAngledBar(tab, 18, -17, 150, 34, 0x101014, 1);
    container.add(tab);

    const labelText = scene.add.text(40, 0, label, {
        fontFamily: FONT_HEAVY,
        fontSize: '20px',
        color: '#ffffff',
    }).setOrigin(0, 0.5);
    container.add(labelText);

    // keep the pip above its tab
    container.bringToTop(graphics);
    container.bringToTop(glyphText);

    return container;
}

/** Title text styling used for headings and menu entries. */
export function titleStyle(size: number): Phaser.Types.GameObjects.Text.TextStyle {
    return {
        fontFamily: FONT_HEAVY,
        fontSize: `${size}px`,
        color: THEME.titleFill,
        stroke: THEME.titleStroke,
        strokeThickness: Math.max(4, size * 0.12),
    };
}
