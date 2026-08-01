import {
    Collider,
    Grounded,
    Intent,
    PlayerState,
    PlayerTag,
    Transform,
    Velocity,
} from '@/game/components';
import { CAMERA, PHYSICS, PLAYER } from '@/game/config/GameConfig';
import { System, type Entity, type Query } from '@/game/core/ecs';
import { clamp, damp } from '@/game/core/MathUtils';
import type { Renderer3D } from '@/game/render/Renderer3D';
import type { LevelRuntime } from '@/game/world/LevelBuilder';

/**
 * Follows the player with a horizontal deadzone, speed-based look-ahead and the
 * corner-peek push. The camera's *orientation* never changes — only its target.
 */
export class CameraSystem extends System {
    private players!: Query;
    private renderer!: Renderer3D;
    private level!: LevelRuntime;

    private focusX = 0;
    private focusY = 0;
    private lookAhead = 0;
    private verticalOffset = 0;
    private initialised = false;

    protected init(): void {
        this.players = this.world.query({
            all: [PlayerTag, Transform, Velocity, PlayerState, Grounded, Collider],
        });
        this.renderer = this.world.getResource<Renderer3D>('renderer');
        this.level = this.world.getResource<LevelRuntime>('level');
    }

    update(dt: number): void {
        const player = this.firstPlayer();
        if (player < 0) return;

        const transform = this.world.must(player, Transform);
        const velocity = this.world.must(player, Velocity);
        const state = this.world.must(player, PlayerState);
        const grounded = this.world.must(player, Grounded);
        const intent = this.world.get(player, Intent);

        const targetX = transform.x;
        // Aim at the character's chest rather than the feet.
        const targetY = transform.y + 1.0;

        if (!this.initialised) {
            this.focusX = targetX;
            this.focusY = targetY;
            this.renderer.camera.snapTo(targetX, targetY);
            this.initialised = true;
        }

        // ── horizontal deadzone: the camera only moves once the player leaves it
        const dx = targetX - this.focusX;
        if (dx > CAMERA.deadzoneX) this.focusX = targetX - CAMERA.deadzoneX;
        else if (dx < -CAMERA.deadzoneX) this.focusX = targetX + CAMERA.deadzoneX;

        // ── look-ahead in the direction of travel, scaled by speed
        const speedRatio = clamp(velocity.x / CAMERA.lookAheadSpeedRef, -1, 1);
        this.lookAhead = damp(this.lookAhead, speedRatio * CAMERA.lookAheadX, 3.2, dt);

        // ── vertical bias for looking up / crouching
        let verticalTarget = 0;
        if (state.name === 'lookUp') verticalTarget = CAMERA.lookUpOffset;
        else if (state.name === 'crouch') verticalTarget = CAMERA.crouchOffset;
        this.verticalOffset = damp(this.verticalOffset, verticalTarget, 3.5, dt);

        // ── corner peek: push the camera past the corner the player is leaning over
        let peek = 0;
        if (state.name === 'peek') {
            peek = state.peekDir * PLAYER.peekCameraOffset * state.peekAmount;
        } else if (intent?.peekHeld && grounded.atEdge) {
            peek = grounded.edgeDir * PLAYER.peekCameraOffset * 0.4;
        }

        // ── vertical follow: snap when grounded, drift when airborne
        const groundedFollow = grounded.onGround || state.name === 'ledgeHang' || state.name === 'riding';
        this.focusY = damp(
            this.focusY,
            targetY + this.verticalOffset,
            groundedFollow ? CAMERA.followLerpYGround : CAMERA.followLerpYAir,
            dt,
        );

        // ── clamp to the level bounds so we never show the void
        const halfW = this.renderer.camera.halfViewWidth;
        const halfH = this.renderer.camera.halfViewHeight;
        const bounds = this.level.def.bounds;

        const desiredX = clamp(
            this.focusX + this.lookAhead,
            bounds.minX + halfW,
            Math.max(bounds.minX + halfW, bounds.maxX - halfW),
        );
        const desiredY = clamp(
            this.focusY,
            bounds.minY + halfH,
            Math.max(bounds.minY + halfH, bounds.maxY - halfH),
        );

        this.renderer.camera.update(dt, desiredX, desiredY, peek, groundedFollow);
        this.renderer.syncShadowFrustum(this.renderer.camera.target.x, this.renderer.camera.target.y);

        // A little extra shake at buzzsaw speed sells the momentum.
        if (state.name === 'buzzsaw' && Math.abs(velocity.x) > PHYSICS.topSpeed) {
            this.renderer.camera.addShake(0.03);
        }
    }

    /** Re-centre instantly, e.g. after a respawn or a scene transition. */
    snap(): void {
        this.initialised = false;
    }

    private firstPlayer(): Entity {
        for (const entity of this.world.view(this.players)) return entity;
        return -1;
    }
}
