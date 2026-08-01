import { CanvasTexture, NearestFilter, RepeatWrapping, SRGBColorSpace, type Texture } from 'three';
import { PIXEL } from '@/game/config/GameConfig';

/**
 * Every texture in the game is drawn here at boot — nothing is downloaded.
 * Keeps the project offline-capable and free of third-party art.
 */

const cache = new Map<string, Texture>();

function make(
    key: string,
    width: number,
    height: number,
    draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
    repeat: [number, number] = [1, 1],
): Texture {
    const existing = cache.get(key);
    if (existing) return existing;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    draw(ctx, width, height);

    const tex = new CanvasTexture(canvas);
    tex.colorSpace = SRGBColorSpace;
    tex.wrapS = RepeatWrapping;
    tex.wrapT = RepeatWrapping;
    tex.repeat.set(repeat[0], repeat[1]);

    if (PIXEL.enabled) {
        // Hard texel edges, no mip blurring — this is what reads as "pixel art"
        // once the low-res buffer is upscaled.
        tex.magFilter = NearestFilter;
        tex.minFilter = NearestFilter;
        tex.generateMipmaps = false;
        tex.anisotropy = 1;
    } else {
        tex.anisotropy = 4;
    }

    cache.set(key, tex);
    return tex;
}

function noise(ctx: CanvasRenderingContext2D, w: number, h: number, amount: number, alpha: number) {
    for (let i = 0; i < amount; i++) {
        const x = Math.random() * w;
        const y = Math.random() * h;
        const r = Math.random() * 2 + 0.5;
        ctx.fillStyle = `rgba(0,0,0,${Math.random() * alpha})`;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
    }
}

/** Green industrial brick — the back wall. */
export const brickTexture = (): Texture =>
    make('brick', 64, 64, (ctx, w, h) => {
        ctx.fillStyle = '#3f6b4a';
        ctx.fillRect(0, 0, w, h);

        const rows = 8;
        const cols = 4;
        const bh = h / rows;
        const bw = w / cols;
        for (let r = 0; r < rows; r++) {
            const offset = r % 2 === 0 ? 0 : bw / 2;
            for (let c = -1; c <= cols; c++) {
                const x = Math.round(c * bw + offset) + 1;
                const y = Math.round(r * bh) + 1;
                const shade = 0.82 + Math.random() * 0.28;
                ctx.fillStyle = `rgb(${Math.floor(63 * shade)},${Math.floor(107 * shade)},${Math.floor(74 * shade)})`;
                ctx.fillRect(x, y, bw - 2, bh - 2);

                ctx.fillStyle = 'rgba(255,255,255,0.09)';
                ctx.fillRect(x, y, bw - 2, 1);
                ctx.fillStyle = 'rgba(0,0,0,0.16)';
                ctx.fillRect(x, y + bh - 3, bw - 2, 1);
            }
        }
        noise(ctx, w, h, 40, 0.18);
    }, [1, 1]);

/** Blue riveted machine plating — background panels. */
export const plateTexture = (): Texture =>
    make('plate', 64, 64, (ctx, w, h) => {
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, '#2f6b96');
        grad.addColorStop(1, '#1d4a70');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);

        // panel seams, snapped to whole texels so they stay crisp
        ctx.fillStyle = 'rgba(255,255,255,0.14)';
        for (let x = 8; x < w; x += 16) ctx.fillRect(x, 0, 1, h);
        ctx.fillStyle = 'rgba(0,0,0,0.26)';
        for (let y = 16; y < h; y += 16) ctx.fillRect(0, y, w, 1);

        // rivets — single texels at this resolution
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        for (let x = 4; x < w; x += 16) {
            for (let y = 4; y < h; y += 16) ctx.fillRect(x, y, 1, 1);
        }
        noise(ctx, w, h, 30, 0.12);
    });

/** Ochre grit — the walkable ground top face. */
export const groundTexture = (): Texture =>
    make('ground', 64, 64, (ctx, w, h) => {
        ctx.fillStyle = '#d9a01e';
        ctx.fillRect(0, 0, w, h);
        // gravel, drawn as blocky texel clusters rather than smooth ellipses
        for (let i = 0; i < 90; i++) {
            const x = Math.floor(Math.random() * w);
            const y = Math.floor(Math.random() * h);
            const size = 1 + Math.floor(Math.random() * 2);
            ctx.fillStyle = Math.random() > 0.5
                ? 'rgba(255,225,140,0.65)'
                : 'rgba(150,95,10,0.55)';
            ctx.fillRect(x, y, size * 2, size);
        }
        noise(ctx, w, h, 45, 0.2);
    });

/** Teal side plating of the ground slabs. */
export const slabSideTexture = (): Texture =>
    make('slabSide', 32, 32, (ctx, w, h) => {
        ctx.fillStyle = '#2b6f74';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = 'rgba(0,0,0,0.24)';
        for (let y = 0; y < h; y += 8) ctx.fillRect(0, y, w, 1);
        ctx.fillStyle = 'rgba(255,255,255,0.14)';
        ctx.fillRect(0, 0, w, 2);
        noise(ctx, w, h, 18, 0.16);
    });

/** Dark slatted sewer grate. */
export const grateTexture = (): Texture =>
    make('grate', 32, 32, (ctx, w, h) => {
        ctx.fillStyle = '#12181c';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#4a5a60';
        for (let x = 2; x < w; x += 6) ctx.fillRect(x, 2, 3, h - 4);
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        for (let x = 2; x < w; x += 6) ctx.fillRect(x, 2, 3, 1);
    });

/** Emissive green monitor face with a ring glyph. */
export const monitorScreenTexture = (): Texture =>
    make('monitorScreen', 32, 32, (ctx, w, h) => {
        ctx.fillStyle = '#1ea94a';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.fillRect(0, 0, w, 2);

        // ring glyph, thick enough to survive at 32px
        ctx.strokeStyle = '#ffd23f';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.ellipse(w / 2, h / 2, 7, 9, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = '#fff1a8';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(w / 2 - 1, h / 2 - 1, 6, 8, 0, Math.PI * 0.8, Math.PI * 1.6);
        ctx.stroke();

        // scanlines
        ctx.fillStyle = 'rgba(0,0,0,0.16)';
        for (let y = 0; y < h; y += 2) ctx.fillRect(0, y, w, 1);
    });

/** Radial soft blob used for contact shadows. */
export const blobShadowTexture = (): Texture =>
    make('blobShadow', 128, 128, (ctx, w, h) => {
        const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
        grad.addColorStop(0, 'rgba(0,0,0,0.55)');
        grad.addColorStop(0.55, 'rgba(0,0,0,0.28)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
    });

/** Soft round particle sprite. */
export const sparkTexture = (): Texture =>
    make('spark', 64, 64, (ctx, w, h) => {
        const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
        grad.addColorStop(0, 'rgba(255,255,255,1)');
        grad.addColorStop(0.35, 'rgba(255,235,150,0.85)');
        grad.addColorStop(1, 'rgba(255,180,40,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
    });

/** Deep backdrop haze panel. */
export const backdropTexture = (): Texture =>
    make('backdrop', 64, 64, (ctx, w, h) => {
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, '#0f3a5c');
        grad.addColorStop(0.6, '#123f63');
        grad.addColorStop(1, '#0a2740');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);

        // faint pipework silhouettes
        ctx.strokeStyle = 'rgba(255,255,255,0.07)';
        ctx.lineWidth = 3;
        for (let i = 0; i < 5; i++) {
            const x = 5 + i * 13;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h * 0.6);
            ctx.quadraticCurveTo(x, h * 0.75, x + 8, h * 0.75);
            ctx.stroke();
        }
    });

export function disposeTextures(): void {
    for (const tex of cache.values()) tex.dispose();
    cache.clear();
}
