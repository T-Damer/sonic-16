import { Scene } from 'phaser';
import { FIXED_DT, GAME_SPEED, MAX_STEPS } from '@/game/config/GameConfig';
import { CollisionWorld } from '@/game/core/CollisionWorld';
import { SystemPipeline, World } from '@/game/core/ecs';
import { InputState } from '@/game/core/InputState';
import { EventHub } from '@/game/core/Signal';
import { Effects } from '@/game/render/fx/Effects';
import { Renderer3D } from '@/game/render/Renderer3D';
import { AnimationSystem } from '@/game/systems/AnimationSystem';
import { CameraSystem } from '@/game/systems/CameraSystem';
import { CarrySystem } from '@/game/systems/CarrySystem';
import { CollisionSystem } from '@/game/systems/CollisionSystem';
import { CombatSystem } from '@/game/systems/CombatSystem';
import { EnemyAISystem } from '@/game/systems/EnemyAISystem';
import { HazardSystem } from '@/game/systems/HazardSystem';
import { HudSystem } from '@/game/systems/HudSystem';
import { InputSystem } from '@/game/systems/InputSystem';
import { LedgeSystem } from '@/game/systems/LedgeSystem';
import { LifetimeSystem } from '@/game/systems/LifetimeSystem';
import { MovementSystem } from '@/game/systems/MovementSystem';
import { PlayerStateSystem } from '@/game/systems/PlayerStateSystem';
import { ProjectileSystem } from '@/game/systems/ProjectileSystem';
import { RenderSystem } from '@/game/systems/RenderSystem';
import { RingSystem, ScatterRingSystem } from '@/game/systems/RingSystem';
import { SequenceSystem } from '@/game/systems/SequenceSystem';
import { LevelBuilder, type LevelRuntime } from '@/game/world/LevelBuilder';
import { LEVEL_01 } from '@/game/world/levels/Level01';

/**
 * Owns the simulation.
 *
 * Phaser drives the frame loop and the 2D layers; this scene creates the three.js
 * renderer behind Phaser's transparent canvas and steps the ECS at a fixed 60 Hz.
 *
 * Note the field names: Phaser's Scene already owns `events` and `input`, so our
 * equivalents are deliberately called `hub` and `controls`.
 */
export class GameScene extends Scene {
    private world!: World;
    private pipeline!: SystemPipeline;
    /** Named `view3d` because Phaser's Scene already owns `renderer`. */
    private view3d!: Renderer3D;
    private controls!: InputState;
    private effects!: Effects;
    private hub!: EventHub;
    private level!: LevelRuntime;

    private accumulator = 0;
    private elapsed = 0;
    private paused = false;
    private booted = false;

    constructor() {
        super('Game');
    }

    create(): void {
        const parent = this.game.canvas.parentElement;
        if (!parent) throw new Error('GameScene needs a parent element to host the 3D canvas');

        // ── renderer + shared services
        this.view3d = new Renderer3D(parent);
        this.view3d.resize(this.scale.width, this.scale.height);
        this.view3d.setVisible(true);

        this.world = new World();
        this.controls = new InputState();
        this.effects = new Effects(this.view3d.effects);
        this.hub = new EventHub();

        const collision = new CollisionWorld(this.world);

        this.world.setResource('renderer', this.view3d);
        this.world.setResource('input', this.controls);
        this.world.setResource('effects', this.effects);
        this.world.setResource('events', this.hub);
        this.world.setResource('collision', collision);

        // ── level
        const builder = new LevelBuilder(this.world, this.view3d);
        this.level = builder.build(LEVEL_01);
        this.world.setResource('level', this.level);
        collision.rebuild(true);

        // ── systems, in dependency order
        const combatSystem = new CombatSystem();
        const collisionSystem = new CollisionSystem();
        this.world.setResource('combatSystem', combatSystem);
        this.world.setResource('collisionSystem', collisionSystem);

        this.pipeline = new SystemPipeline(this.world);
        this.pipeline.add(
            new InputSystem(),
            new SequenceSystem(),
            new PlayerStateSystem(),
            new EnemyAISystem(),
            new CarrySystem(),
            new MovementSystem(),
            collisionSystem,
            new LedgeSystem(),
            combatSystem,
            new ProjectileSystem(),
            new RingSystem(),
            new ScatterRingSystem(),
            new HazardSystem(),
            new LifetimeSystem(),
            new AnimationSystem(),
            new CameraSystem(),
            new RenderSystem(),
            new HudSystem(),
        );

        this.view3d.camera.snapTo(this.level.def.spawn.x, this.level.def.spawn.y + 1.2);

        this.hub.on('levelComplete', () => {
            this.paused = true;
            this.controls.blocked = true;
        });

        this.scale.on('resize', this.handleResize, this);
        this.sys.events.once('shutdown', this.shutdownScene, this);
        this.sys.events.once('destroy', this.shutdownScene, this);

        if (!this.scene.isActive('Hud')) this.scene.launch('Hud');
        this.scene.bringToTop('Hud');

        this.booted = true;
    }

    private handleResize(size: Phaser.Structs.Size): void {
        this.view3d?.resize(size.width, size.height);
    }

    togglePause(): void {
        this.paused = !this.paused;
        this.controls.blocked = this.paused;
        if (this.paused) this.scene.launch('Pause');
        else this.scene.stop('Pause');
    }

    update(_time: number, delta: number): void {
        if (!this.booted) return;

        this.controls.beginFrame(this.elapsed);

        if (this.controls.pressed('pause')) {
            this.controls.consume('pause');
            this.togglePause();
        }

        if (!this.paused) {
            // Fixed step, scaled by the global pace multiplier.
            this.accumulator += Math.min(delta / 1000, 0.1) * GAME_SPEED;

            let steps = 0;
            while (this.accumulator >= FIXED_DT && steps < MAX_STEPS) {
                this.pipeline.update(FIXED_DT);
                this.accumulator -= FIXED_DT;
                this.elapsed += FIXED_DT;
                steps++;
            }
            // Drop any backlog we couldn't chew through rather than spiralling.
            if (steps >= MAX_STEPS) this.accumulator = 0;
        }

        this.view3d.render();
    }

    private shutdownScene(): void {
        this.scale.off('resize', this.handleResize, this);

        this.pipeline?.dispose();
        this.effects?.clear();
        this.hub?.clear();
        this.controls?.dispose();
        this.view3d?.dispose();
        this.world?.clear();

        if (this.scene.isActive('Hud')) this.scene.stop('Hud');
        if (this.scene.isActive('Pause')) this.scene.stop('Pause');
    }
}
