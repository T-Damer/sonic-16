import { OrthographicCamera, Vector3 } from 'three';
import { CAMERA, PIXEL } from '@/game/config/GameConfig';
import { damp, DEG } from '@/game/core/MathUtils';

/**
 * Orthographic camera locked to a fixed near-isometric orientation.
 *
 * The camera never rotates during play — only its look-at target moves. That's what
 * gives the reference footage its "pre-rendered diorama" feel: parallel projection,
 * a slight yaw so we see the right-hand faces of props, and enough pitch that the
 * tops of platforms stay visible.
 */
export class IsoCamera {
    readonly camera: OrthographicCamera;

    /** Where the camera is looking (world space). */
    readonly target = new Vector3(0, 0, 0);
    /** Smoothed position the camera actually uses. */
    private readonly current = new Vector3(0, 0, 0);
    private readonly offset = new Vector3();

    private shake = 0;
    private shakeSeed = Math.random() * 1000;
    private peekOffset = 0;
    private viewHeight: number = CAMERA.viewHeight;
    private aspect = 16 / 9;
    /** World units per rendered pixel — used to snap the camera to the pixel grid. */
    private unitsPerPixel = 0;

    constructor() {
        this.camera = new OrthographicCamera(-8, 8, 4.5, -4.5, 0.1, 400);
        this.recomputeOffset();
        this.camera.position.copy(this.offset);
        this.camera.lookAt(0, 0, 0);
    }

    private recomputeOffset(): void {
        const yaw = CAMERA.yaw * DEG;
        const pitch = CAMERA.pitch * DEG;
        // Spherical → cartesian. Camera sits in front (+Z) of the play plane,
        // offset sideways by yaw and lifted by pitch.
        this.offset.set(
            Math.sin(yaw) * Math.cos(pitch),
            Math.sin(pitch),
            Math.cos(yaw) * Math.cos(pitch),
        ).multiplyScalar(CAMERA.distance);
    }

    resize(width: number, height: number): void {
        this.aspect = width / Math.max(1, height);
        this.applyFrustum();
    }

    setViewHeight(height: number): void {
        this.viewHeight = height;
        this.applyFrustum();
    }

    private applyFrustum(): void {
        const halfH = this.viewHeight / 2;
        const halfW = halfH * this.aspect;
        this.camera.left = -halfW;
        this.camera.right = halfW;
        this.camera.top = halfH;
        this.camera.bottom = -halfH;
        this.camera.updateProjectionMatrix();
    }

    /** Half-extents of the visible area in world units — used for culling. */
    get halfViewWidth(): number {
        return (this.viewHeight / 2) * this.aspect;
    }

    get halfViewHeight(): number {
        return this.viewHeight / 2;
    }

    snapTo(x: number, y: number): void {
        this.target.set(x, y, 0);
        this.current.set(x, y, 0);
        this.commit();
    }

    addShake(amount: number): void {
        this.shake = Math.min(this.shake + amount, 1.5);
    }

    /**
     * @param desiredX / desiredY  raw follow target
     * @param peek                 signed corner-peek offset in world units
     * @param groundedLerp         use the snappier vertical follow
     */
    update(dt: number, desiredX: number, desiredY: number, peek: number, groundedLerp: boolean): void {
        this.peekOffset = damp(this.peekOffset, peek, CAMERA.peekLerp, dt);

        this.current.x = damp(this.current.x, desiredX + this.peekOffset, CAMERA.followLerpX, dt);
        this.current.y = damp(
            this.current.y,
            desiredY,
            groundedLerp ? CAMERA.followLerpYGround : CAMERA.followLerpYAir,
            dt,
        );

        if (this.shake > 0.0001) {
            this.shake = Math.max(0, this.shake - CAMERA.shakeDecay * dt * this.shake);
        }

        this.commit();
    }

    /** Called by the renderer whenever the low-res backing store is resized. */
    setPixelsPerUnit(bufferHeight: number): void {
        this.unitsPerPixel = bufferHeight > 0 ? this.viewHeight / bufferHeight : 0;
    }

    /** Quantise a world coordinate to the virtual pixel grid. */
    private snap(value: number): number {
        if (!PIXEL.snapToGrid || this.unitsPerPixel <= 0) return value;
        return Math.round(value / this.unitsPerPixel) * this.unitsPerPixel;
    }

    private commit(): void {
        let sx = 0;
        let sy = 0;
        if (this.shake > 0.0001) {
            this.shakeSeed += 0.9;
            sx = Math.sin(this.shakeSeed * 2.3) * this.shake * 0.35;
            sy = Math.cos(this.shakeSeed * 3.1) * this.shake * 0.35;
        }
        // Snapping the camera (not the actors) removes the sub-pixel crawl that
        // otherwise makes a low-res buffer shimmer as it scrolls.
        this.target.set(
            this.snap(this.current.x + sx),
            this.snap(this.current.y + sy),
            0,
        );
        this.camera.position.copy(this.target).add(this.offset);
        this.camera.lookAt(this.target);
        this.camera.updateMatrixWorld();
    }

    /** Is a world-space X/Y inside the view (with margin)? */
    isVisible(x: number, y: number, margin = 3): boolean {
        return (
            Math.abs(x - this.target.x) < this.halfViewWidth + margin &&
            Math.abs(y - this.target.y) < this.halfViewHeight + margin
        );
    }
}
