import {
    AnimState,
    BlastDoor,
    Intent,
    PlayerState,
    PlayerTag,
    RingPurse,
    Transform,
    Trigger,
    Velocity,
} from '@/game/components';
import { System, type Entity, type Query } from '@/game/core/ecs';
import { clamp, damp } from '@/game/core/MathUtils';
import type { EventHub } from '@/game/core/Signal';
import type { Renderer3D } from '@/game/render/Renderer3D';
import type { LevelRuntime } from '@/game/world/LevelBuilder';

type Phase =
    | 'idle'
    | 'approach'     // the player walks the last few metres to the ally
    | 'greet'        // they meet; the lights start to drop
    | 'doorOpen'     // the blast door parts
    | 'enter'        // both walk into the dark hallway
    | 'fade'         // blackout
    | 'done';

/** How close the player walks to the ally before the greeting starts. */
const GREET_DISTANCE = 1.5;

/**
 * Scripted beats: the opening climb-out, the contextual hints, and the level-end
 * rendezvous at the blast door.
 *
 * A sequence takes over an actor by setting `Intent.scripted`, which makes InputSystem
 * skip it — the same channel the player normally drives, so nothing else changes.
 */
export class SequenceSystem extends System {
    private triggers!: Query;
    private players!: Query;

    private events!: EventHub;
    private renderer!: Renderer3D;
    private level!: LevelRuntime;

    private phase: Phase = 'idle';
    private phaseTimer = 0;
    private levelTime = 0;
    private firedHints = new Set<string>();
    private activePrompt: string | null = null;
    private promptTimer = 0;

    protected init(): void {
        this.triggers = this.world.query({ all: [Trigger, Transform] });
        this.players = this.world.query({ all: [PlayerTag, Transform, PlayerState, Intent] });

        this.events = this.world.getResource<EventHub>('events');
        this.renderer = this.world.getResource<Renderer3D>('renderer');
        this.level = this.world.getResource<LevelRuntime>('level');
    }

    update(dt: number): void {
        this.levelTime += dt;

        const player = this.firstPlayer();
        if (player < 0) return;

        this.updatePrompt(dt);
        if (this.phase === 'idle') this.checkTriggers(player);
        this.updateEnding(player, dt);
    }

    // ───────────────────────────────────────────────────────────────── triggers

    private checkTriggers(player: Entity): void {
        const playerTransform = this.world.must(player, Transform);

        for (const entity of this.world.view(this.triggers)) {
            const trigger = this.world.must(entity, Trigger);
            if (trigger.fired && trigger.once) continue;

            const transform = this.world.must(entity, Transform);
            const inside =
                Math.abs(playerTransform.x - transform.x) < trigger.hw &&
                Math.abs(playerTransform.y + 0.5 - transform.y) < trigger.hh;
            if (!inside) continue;

            trigger.fired = true;
            this.fire(trigger.event, player);
        }
    }

    private fire(event: string, player: Entity): void {
        if (event.startsWith('hint:')) {
            const hint = event.slice(5);
            if (this.firedHints.has(hint)) return;
            this.firedHints.add(hint);
            this.showPrompt(this.hintText(hint), 4.5);
            return;
        }

        if (event === 'ending') this.startEnding(player);
    }

    private hintText(hint: string): string {
        switch (hint) {
            case 'peek':
                return 'HOLD  Q  AT THE EDGE TO PEEK AHEAD';
            case 'throw':
                return 'PRESS  J  TO THROW A RING';
            case 'buzzsaw':
                return 'HOLD  ↓ + SPACE  THEN RELEASE — BUZZSAW';
            case 'skiff':
                return 'JUMP INTO THE SKIFF’S BAR TO RIDE IT';
            default:
                return '';
        }
    }

    // ────────────────────────────────────────────────────────────────── prompts

    private showPrompt(text: string, duration: number): void {
        if (!text) return;
        this.activePrompt = text;
        this.promptTimer = duration;
        this.events.emit('promptChanged', { text });
    }

    private updatePrompt(dt: number): void {
        if (!this.activePrompt) return;
        this.promptTimer -= dt;
        if (this.promptTimer > 0) return;
        this.activePrompt = null;
        this.events.emit('promptChanged', { text: null });
    }

    // ──────────────────────────────────────────────────────────── ending scene

    private startEnding(player: Entity): void {
        if (this.phase !== 'idle') return;

        this.phase = 'approach';
        this.phaseTimer = 0;

        const state = this.world.must(player, PlayerState);
        state.previous = state.name;
        state.name = 'cutscene';
        state.timer = 0;
        state.locked = true;

        const intent = this.world.must(player, Intent);
        intent.scripted = true;
        intent.jumpPressed = false;
        intent.jumpHeld = false;
        intent.throwPressed = false;
        intent.peekHeld = false;
        intent.lookY = 0;

        this.events.emit('sequenceStarted', { id: 'ending' });
        this.showPrompt('', 0);
    }

    private updateEnding(player: Entity, dt: number): void {
        if (this.phase === 'idle' || this.phase === 'done') return;

        this.phaseTimer += dt;

        const playerTransform = this.world.must(player, Transform);
        const playerVelocity = this.world.get(player, Velocity);
        const playerAnim = this.world.get(player, AnimState);
        const intent = this.world.must(player, Intent);

        const ally = this.level.ally;
        const allyTransform = ally >= 0 ? this.world.get(ally, Transform) : undefined;
        const allyAnim = ally >= 0 ? this.world.get(ally, AnimState) : undefined;

        const door = this.level.blastDoor >= 0 ? this.world.get(this.level.blastDoor, BlastDoor) : undefined;
        const doorTransform = this.level.blastDoor >= 0
            ? this.world.get(this.level.blastDoor, Transform)
            : undefined;

        switch (this.phase) {
            case 'approach': {
                const targetX = (allyTransform?.x ?? playerTransform.x) - GREET_DISTANCE;
                const dx = targetX - playerTransform.x;

                if (Math.abs(dx) > 0.12) {
                    this.walk(playerTransform, playerVelocity, Math.sign(dx), 3.2, dt);
                    if (playerAnim) playerAnim.clip = 'walk';
                } else {
                    if (playerVelocity) playerVelocity.x = 0;
                    if (playerAnim) playerAnim.clip = 'idle';
                    playerTransform.facing = 1;
                    if (allyTransform) allyTransform.facing = -1;
                    this.phase = 'greet';
                    this.phaseTimer = 0;
                }
                break;
            }

            case 'greet': {
                if (playerVelocity) playerVelocity.x = 0;
                if (playerAnim) playerAnim.clip = 'victory';
                if (allyAnim) allyAnim.clip = 'sallyIdle';

                // the lights begin to drop as the door powers up
                this.renderer.setDarkness(clamp(this.phaseTimer / 2.2, 0, 0.45));

                if (this.phaseTimer >= 1.3) {
                    if (door) door.opening = true;
                    this.phase = 'doorOpen';
                    this.phaseTimer = 0;
                    this.renderer.camera.addShake(0.35);
                }
                break;
            }

            case 'doorOpen': {
                if (playerAnim) playerAnim.clip = 'idle';
                this.animateDoor(door, dt);
                this.renderer.setDarkness(clamp(0.45 + this.phaseTimer * 0.12, 0, 0.6));

                if (door && door.open >= 0.98) {
                    this.phase = 'enter';
                    this.phaseTimer = 0;
                    if (allyTransform) allyTransform.facing = 1;
                }
                break;
            }

            case 'enter': {
                const doorX = doorTransform?.x ?? playerTransform.x + 4;
                this.animateDoor(door, dt);

                // both characters walk into the dark hallway
                this.walk(playerTransform, playerVelocity, 1, 2.6, dt);
                if (playerAnim) playerAnim.clip = 'walk';

                if (allyTransform) {
                    allyTransform.x += 2.9 * dt;
                    allyTransform.facing = 1;
                    if (allyAnim) allyAnim.clip = 'sallyWalk';
                }

                // fade the world out as they cross the threshold
                const progress = clamp((playerTransform.x - (doorX - 3.2)) / 3.2, 0, 1);
                this.renderer.setDarkness(clamp(0.6 + progress * 0.4, 0, 1));

                if (playerTransform.x >= doorX - 0.2 || this.phaseTimer > 6) {
                    this.phase = 'fade';
                    this.phaseTimer = 0;
                    if (playerVelocity) playerVelocity.x = 0;
                }
                break;
            }

            case 'fade': {
                this.renderer.setDarkness(1);
                if (this.phaseTimer >= 0.9) {
                    this.phase = 'done';
                    const purse = this.world.get(player, RingPurse);
                    this.events.emit('sequenceFinished', { id: 'ending' });
                    this.events.emit('levelComplete', {
                        time: this.levelTime,
                        rings: purse?.rings ?? 0,
                    });
                }
                break;
            }

            default:
                break;
        }

        // keep the scripted actor's intent inert
        intent.moveX = 0;
        intent.jumpPressed = false;
    }

    /** Slide the two door panels apart. */
    private animateDoor(door: ReturnType<typeof BlastDoor.create> | undefined, dt: number): void {
        if (!door || !door.opening) return;
        door.open = damp(door.open, 1, 2.4, dt);

        const travel = 1.55;
        if (door.leftPanel) door.leftPanel.position.x = -travel / 2 - door.open * travel;
        if (door.rightPanel) door.rightPanel.position.x = travel / 2 + door.open * travel;
    }

    /** Move a scripted actor horizontally without going through the state machine. */
    private walk(
        transform: ReturnType<typeof Transform.create>,
        velocity: ReturnType<typeof Velocity.create> | undefined,
        dir: number,
        speed: number,
        dt: number,
    ): void {
        transform.x += dir * speed * dt;
        transform.facing = dir >= 0 ? 1 : -1;
        if (velocity) velocity.x = 0;
    }

    private firstPlayer(): Entity {
        for (const entity of this.world.view(this.players)) return entity;
        return -1;
    }

    /** Exposed for the HUD timer. */
    get elapsed(): number {
        return this.levelTime;
    }

    get isPlayingCutscene(): boolean {
        return this.phase !== 'idle' && this.phase !== 'done';
    }
}
