import {
    AmbientLight,
    Box3,
    CircleGeometry,
    Color,
    DirectionalLight,
    Group,
    HemisphereLight,
    Mesh,
    MeshBasicMaterial,
    MeshLambertMaterial,
    Object3D,
    PCFSoftShadowMap,
    PerspectiveCamera,
    RingGeometry,
    Scene,
    Sphere,
    Vector3,
    WebGLRenderer,
} from 'three';
import { PIXEL } from '@/game/config/GameConfig';
import { DEG } from '@/game/core/MathUtils';

/**
 * Standalone turntable viewer for the EXTRAS asset library.
 *
 * Same pixelated presentation as the game renderer (small backing store,
 * nearest-neighbour upscale) so assets are previewed exactly as they ship.
 * It owns its own canvas behind Phaser's transparent one, like Renderer3D.
 */
export class ModelViewer {
    private readonly canvas: HTMLCanvasElement;
    private readonly renderer: WebGLRenderer;
    private readonly scene: Scene;
    private readonly camera: PerspectiveCamera;

    private readonly stage = new Group();
    private readonly floor: Mesh;
    private readonly center = new Vector3(0, 0.8, 0);
    private orbitRadius = 5;
    private yaw = 0.6;
    private readonly pitch = 16 * DEG;
    /** Animated rotor bones (coolers) collected on setObject. */
    private rotors: Object3D[] = [];
    private disposed = false;

    /** Silhouette review mode — see docs/ART_PIPELINE.md step 5. */
    private silhouette = false;
    private readonly silhouetteMaterial = new MeshBasicMaterial({ color: 0x14141c });

    autoRotate = true;

    constructor(parent: HTMLElement) {
        this.canvas = document.createElement('canvas');
        this.canvas.id = 'viewer-canvas';
        Object.assign(this.canvas.style, {
            position: 'absolute',
            inset: '0',
            width: '100%',
            height: '100%',
            zIndex: '0',
            display: 'block',
            imageRendering: 'pixelated',
        } satisfies Partial<CSSStyleDeclaration>);
        parent.insertBefore(this.canvas, parent.firstChild);

        this.renderer = new WebGLRenderer({
            canvas: this.canvas,
            antialias: !PIXEL.enabled,
            powerPreference: 'high-performance',
        });
        this.renderer.setPixelRatio(PIXEL.enabled ? 1 : Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = PCFSoftShadowMap;

        this.scene = new Scene();
        this.scene.background = new Color(0x0d1b2e);

        this.camera = new PerspectiveCamera(35, 16 / 9, 0.1, 200);

        // Lighting mirrors the game's warm key / cool fill balance.
        const key = new DirectionalLight(0xfff0d0, 1.4);
        key.position.set(-4, 7, 6);
        key.castShadow = true;
        key.shadow.mapSize.set(PIXEL.shadowMapSize, PIXEL.shadowMapSize);
        key.shadow.camera.left = -8;
        key.shadow.camera.right = 8;
        key.shadow.camera.top = 8;
        key.shadow.camera.bottom = -8;
        key.shadow.bias = -0.0012;
        this.scene.add(key);
        this.scene.add(new HemisphereLight(0x9ed6ff, 0x243a30, 0.6));
        this.scene.add(new AmbientLight(0xbcd8ff, 0.4));

        // Display plinth: a dark disc with an accent ring.
        this.floor = new Mesh(
            new CircleGeometry(6, 40),
            new MeshLambertMaterial({ color: 0x13293d }),
        );
        this.floor.rotation.x = -Math.PI / 2;
        this.floor.receiveShadow = true;
        this.scene.add(this.floor);

        const accent = new Mesh(
            new RingGeometry(5.5, 5.7, 48),
            new MeshLambertMaterial({ color: 0x2f6fd0 }),
        );
        accent.rotation.x = -Math.PI / 2;
        accent.position.y = 0.01;
        this.floor.add(accent);

        this.scene.add(this.stage);
    }

    /** Swap in a new asset, dispose the old one's geometry and auto-frame it. */
    setObject(object: Object3D): void {
        this.clearStage();
        this.stage.add(object);

        this.rotors = [];
        object.traverse((child) => {
            if (child.name === 'rotor') this.rotors.push(child);
        });

        this.frame(object);
    }

    /** Fit the camera orbit to the object's bounding sphere. */
    private frame(object: Object3D): void {
        const box = new Box3().setFromObject(object);
        const sphere = box.getBoundingSphere(new Sphere());
        const radius = Math.max(0.5, sphere.radius);

        this.center.copy(sphere.center);
        this.orbitRadius = (radius / Math.sin((this.camera.fov * DEG) / 2)) * 1.25;

        // Keep the plinth just under the asset's lowest point.
        this.floor.position.y = box.min.y - 0.02;
    }

    addYaw(delta: number): void {
        this.yaw += delta;
    }

    /**
     * Flat-black-on-light silhouette view. If an asset isn't identifiable here,
     * its shape needs work before any colour or detail pass — the pipeline's
     * first acceptance gate.
     */
    toggleSilhouette(): boolean {
        this.silhouette = !this.silhouette;
        this.scene.overrideMaterial = this.silhouette ? this.silhouetteMaterial : null;
        (this.scene.background as Color).setHex(this.silhouette ? 0xcdd8e4 : 0x0d1b2e);
        this.floor.visible = !this.silhouette;
        return this.silhouette;
    }

    resize(width: number, height: number): void {
        if (width <= 0 || height <= 0) return;

        let bufferWidth = width;
        let bufferHeight = height;
        if (PIXEL.enabled) {
            const aspect = width / height;
            bufferHeight = PIXEL.internalHeight;
            bufferWidth = Math.round(bufferHeight * aspect);
            if (bufferWidth > PIXEL.maxInternalWidth) {
                bufferWidth = PIXEL.maxInternalWidth;
                bufferHeight = Math.round(bufferWidth / aspect);
            }
        }

        this.renderer.setSize(bufferWidth, bufferHeight, false);
        this.camera.aspect = bufferWidth / Math.max(1, bufferHeight);
        this.camera.updateProjectionMatrix();
    }

    update(dt: number): void {
        if (this.disposed) return;

        if (this.autoRotate) this.yaw += 0.45 * dt;
        for (const rotor of this.rotors) rotor.rotation.z += 5.5 * dt;

        this.camera.position
            .set(
                Math.sin(this.yaw) * Math.cos(this.pitch),
                Math.sin(this.pitch),
                Math.cos(this.yaw) * Math.cos(this.pitch),
            )
            .multiplyScalar(this.orbitRadius)
            .add(this.center);
        this.camera.lookAt(this.center);

        this.renderer.render(this.scene, this.camera);
    }

    private clearStage(): void {
        for (const child of [...this.stage.children]) {
            // Procedural assets are rebuilt per selection, so their geometry is
            // disposed. Imported GLBs are cached by GltfLibrary and flagged
            // `preserve` — those are only detached.
            if (!child.userData.preserve) {
                child.traverse((node) => {
                    (node as Mesh).geometry?.dispose?.();
                });
            }
            this.stage.remove(child);
        }
        this.rotors = [];
    }

    dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
        this.clearStage();
        this.renderer.dispose();
        this.canvas.remove();
    }
}
