import {
    Color,
    DoubleSide,
    MeshBasicMaterial,
    MeshLambertMaterial,
    MeshStandardMaterial,
    type Material,
} from 'three';
import {
    backdropTexture,
    blobShadowTexture,
    brickTexture,
    grateTexture,
    groundTexture,
    monitorScreenTexture,
    plateTexture,
    slabSideTexture,
    sparkTexture,
} from '@/game/render/TextureFactory';

/**
 * Shared material cache. The look is deliberately flat-ish (Lambert) so the render
 * reads like the pre-rendered sprite work of the era rather than modern PBR.
 */
const cache = new Map<string, Material>();

function cached<T extends Material>(key: string, build: () => T): T {
    const existing = cache.get(key);
    if (existing) return existing as T;
    const mat = build();
    cache.set(key, mat);
    return mat;
}

/** Flat coloured surface, receives light. */
export function solidColor(key: string, color: number, opts: {
    emissive?: number;
    emissiveIntensity?: number;
    flatShading?: boolean;
} = {}): MeshLambertMaterial {
    return cached(`solid:${key}`, () => new MeshLambertMaterial({
        color: new Color(color),
        emissive: new Color(opts.emissive ?? 0x000000),
        emissiveIntensity: opts.emissiveIntensity ?? 1,
        // Faceted by default — smooth gradients turn to mush at 270p, whereas hard
        // facets give each surface a distinct flat tone, like hand-shaded pixel art.
        flatShading: opts.flatShading ?? true,
    }));
}

/** Unlit — for glows, screens, projectiles. */
export function glow(key: string, color: number, opacity = 1): MeshBasicMaterial {
    return cached(`glow:${key}`, () => new MeshBasicMaterial({
        color: new Color(color),
        transparent: opacity < 1,
        opacity,
        depthWrite: opacity >= 1,
    }));
}

export function metal(key: string, color: number, roughness = 0.55): MeshStandardMaterial {
    return cached(`metal:${key}`, () => new MeshStandardMaterial({
        color: new Color(color),
        roughness,
        metalness: 0.7,
        flatShading: true,
    }));
}

// ───────────────────────────────────────────────────── textured level materials

export const groundTopMaterial = () =>
    cached('mat:groundTop', () => new MeshLambertMaterial({ map: groundTexture() }));

export const slabSideMaterial = () =>
    cached('mat:slabSide', () => new MeshLambertMaterial({ map: slabSideTexture() }));

export const wallMaterial = () =>
    cached('mat:wall', () => new MeshLambertMaterial({ map: brickTexture() }));

export const panelMaterial = () =>
    cached('mat:panel', () => new MeshLambertMaterial({ map: plateTexture() }));

export const backdropMaterial = () =>
    cached('mat:backdrop', () => new MeshBasicMaterial({ map: backdropTexture() }));

export const grateMaterial = () =>
    cached('mat:grate', () => new MeshLambertMaterial({ map: grateTexture() }));

export const monitorScreenMaterial = () =>
    cached('mat:monitorScreen', () => new MeshBasicMaterial({ map: monitorScreenTexture() }));

export const blobShadowMaterial = () =>
    cached('mat:blobShadow', () => new MeshBasicMaterial({
        map: blobShadowTexture(),
        transparent: true,
        depthWrite: false,
        opacity: 0.85,
    }));

export const sparkMaterial = () =>
    cached('mat:spark', () => new MeshBasicMaterial({
        map: sparkTexture(),
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
    }));

// ───────────────────────────────────────────────────────── character palettes

export const PALETTE = {
    sonicBlue: 0x2f5fd0,
    sonicBlueDark: 0x1d3f96,
    skin: 0xf3c893,
    glove: 0xf7f7f7,
    shoeRed: 0xd42b2b,
    shoeStripe: 0xf5f5f5,
    eyeWhite: 0xfdfdfd,
    pupil: 0x1a5c2a,
    nose: 0x1c1c1c,

    sallyHair: 0xb3441f,
    sallyFur: 0xd9a15e,
    sallyVest: 0x2f74c8,
    sallyBoot: 0x3b2f8f,

    swatGrey: 0x8d97a3,
    swatDark: 0x4d5560,
    swatVisor: 0xd83a2a,

    spyphidBody: 0x8b52c9,
    spyphidDark: 0x53307d,
    spyphidLens: 0x2ee0ff,
    spyphidAlert: 0xff3b30,

    skiffHull: 0xd6297f,
    skiffHullDark: 0x8e1352,
    skiffGlow: 0x6ff0ff,

    ringGold: 0xffc61e,
    ringGoldLight: 0xfff3a8,

    spikeGold: 0xd9b23a,
    spikeTip: 0xdfe4e8,

    pipeWhite: 0xd8e6ef,
    pipeBlue: 0x6fa8cf,
    pipeGreen: 0x4e8a5f,
} as const;

export function disposeMaterials(): void {
    for (const mat of cache.values()) mat.dispose();
    cache.clear();
}
