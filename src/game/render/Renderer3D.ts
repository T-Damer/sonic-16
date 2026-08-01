import {
    AmbientLight,
    Color,
    DirectionalLight,
    Fog,
    Group,
    HemisphereLight,
    PCFSoftShadowMap,
    Scene,
    WebGLRenderer,
} from 'three';
import { PIXEL, WORLD } from '@/game/config/GameConfig';
import { IsoCamera } from '@/game/render/IsoCamera';

/**
 * Owns the WebGL canvas, scene graph and lighting.
 *
 * The canvas is inserted *behind* Phaser's (which runs transparent), so Phaser can
 * draw the HUD, menus and fades on top of the 3D world.
 */
export class Renderer3D {
    readonly renderer: WebGLRenderer;
    readonly scene: Scene;
    readonly camera: IsoCamera;

    /** Layer groups so level teardown is a single removal. */
    readonly world = new Group();
    readonly actors = new Group();
    readonly effects = new Group();

    readonly keyLight: DirectionalLight;
    private readonly ambient: AmbientLight;
    private readonly hemi: HemisphereLight;

    private readonly canvas: HTMLCanvasElement;
    private disposed = false;

    /** 0 = fully lit, 1 = blackout (used by the ending sequence). */
    private darkness = 0;
    private readonly baseAmbient: number;
    private readonly baseKey: number;
    private readonly baseHemi: number;

    constructor(parent: HTMLElement) {
        this.canvas = document.createElement('canvas');
        this.canvas.id = 'three-canvas';
        Object.assign(this.canvas.style, {
            position: 'absolute',
            inset: '0',
            width: '100%',
            height: '100%',
            zIndex: '0',
            display: 'block',
            // The nearest-neighbour upscale that makes the low-res buffer look pixelated.
            imageRendering: 'pixelated',
        } satisfies Partial<CSSStyleDeclaration>);
        parent.insertBefore(this.canvas, parent.firstChild);

        this.renderer = new WebGLRenderer({
            canvas: this.canvas,
            // Antialiasing fights the pixel look — hard edges are the point.
            antialias: !PIXEL.enabled,
            powerPreference: 'high-performance',
        });
        this.renderer.setPixelRatio(PIXEL.enabled ? 1 : Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = PCFSoftShadowMap;

        this.scene = new Scene();
        this.scene.background = new Color(0x0a2740);
        this.scene.fog = new Fog(0x0d3352, WORLD.fogNear, WORLD.fogFar);
        this.scene.add(this.world, this.actors, this.effects);

        this.camera = new IsoCamera();

        // Warm key light from the upper-left-front, matching the reference frames.
        this.baseKey = 1.35;
        this.keyLight = new DirectionalLight(0xfff0d0, this.baseKey);
        this.keyLight.position.set(-9, 16, 12);
        this.keyLight.castShadow = true;
        // Small map keeps shadow edges chunky, matching the pixelated buffer.
        this.keyLight.shadow.mapSize.set(PIXEL.shadowMapSize, PIXEL.shadowMapSize);
        const cam = this.keyLight.shadow.camera;
        cam.left = -18;
        cam.right = 18;
        cam.top = 14;
        cam.bottom = -14;
        cam.near = 1;
        cam.far = 70;
        this.keyLight.shadow.bias = -0.0012;
        this.keyLight.shadow.normalBias = 0.03;
        this.scene.add(this.keyLight, this.keyLight.target);

        // Cool bounce so the machinery backdrop stays readable.
        this.baseHemi = 0.55;
        this.hemi = new HemisphereLight(0x9ed6ff, 0x243a30, this.baseHemi);
        this.scene.add(this.hemi);

        this.baseAmbient = 0.45;
        this.ambient = new AmbientLight(0xbcd8ff, this.baseAmbient);
        this.scene.add(this.ambient);
    }

    /**
     * Sizes the *backing store* small and lets CSS stretch it to the viewport.
     * `updateStyle = false` is what keeps the canvas visually full-screen while the
     * drawing buffer stays at the low internal resolution.
     */
    resize(width: number, height: number): void {
        if (width <= 0 || height <= 0) return;

        if (PIXEL.enabled) {
            const aspect = width / height;
            let bufferHeight: number = PIXEL.internalHeight;
            let bufferWidth = Math.round(bufferHeight * aspect);

            if (bufferWidth > PIXEL.maxInternalWidth) {
                bufferWidth = PIXEL.maxInternalWidth;
                bufferHeight = Math.round(bufferWidth / aspect);
            }

            this.renderer.setSize(bufferWidth, bufferHeight, false);
            this.camera.resize(bufferWidth, bufferHeight);
            this.camera.setPixelsPerUnit(bufferHeight);
        } else {
            this.renderer.setSize(width, height, false);
            this.camera.resize(width, height);
        }
    }

    setVisible(visible: boolean): void {
        this.canvas.style.display = visible ? 'block' : 'none';
    }

    /** 0..1 — dims the whole scene for the level-end doorway sequence. */
    setDarkness(value: number): void {
        this.darkness = Math.max(0, Math.min(1, value));
        const k = 1 - this.darkness;
        this.keyLight.intensity = this.baseKey * k;
        this.hemi.intensity = this.baseHemi * k;
        this.ambient.intensity = this.baseAmbient * (0.15 + 0.85 * k);
    }

    get darknessValue(): number {
        return this.darkness;
    }

    /** Keep the shadow frustum centred on the action. */
    syncShadowFrustum(x: number, y: number): void {
        this.keyLight.position.set(x - 9, y + 16, 12);
        this.keyLight.target.position.set(x, y, 0);
        this.keyLight.target.updateMatrixWorld();
    }

    render(): void {
        if (this.disposed) return;
        this.renderer.render(this.scene, this.camera.camera);
    }

    /** Empty the level groups without tearing down the renderer. */
    clearWorld(): void {
        for (const group of [this.world, this.actors, this.effects]) {
            while (group.children.length > 0) group.remove(group.children[0]);
        }
    }

    dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
        this.clearWorld();
        this.renderer.dispose();
        this.canvas.remove();
    }
}
