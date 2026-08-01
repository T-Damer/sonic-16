import { PlayerState, PlayerTag, RingPurse } from '@/game/components';
import { System, type Entity, type Query } from '@/game/core/ecs';
import type { EventHub } from '@/game/core/Signal';
import { EventBus } from '@/game/EventBus';

/**
 * Bridges gameplay state to the Phaser HUD scene.
 *
 * The HUD lives in Phaser's 2D layer, so this is the one place the simulation talks
 * to it — everything goes over the EventBus, keeping the two renderers decoupled.
 */
export class HudSystem extends System {
    private players!: Query;
    private events!: EventHub;

    private lastRings = -1;
    private lastState = '';
    private elapsed = 0;
    private lastWholeSecond = -1;

    protected init(): void {
        this.players = this.world.query({ all: [PlayerTag, RingPurse, PlayerState] });
        this.events = this.world.getResource<EventHub>('events');

        // Forward the gameplay events the HUD cares about.
        this.events.on('promptChanged', ({ text }) => EventBus.emit('hud:prompt', text));
        this.events.on('checkpointReached', ({ index }) => EventBus.emit('hud:checkpoint', index));
        this.events.on('playerHurt', () => EventBus.emit('hud:hurt'));
        this.events.on('playerDied', () => EventBus.emit('hud:died'));
        this.events.on('levelComplete', (payload) => EventBus.emit('hud:levelComplete', payload));
    }

    update(dt: number): void {
        this.elapsed += dt;

        const player = this.firstPlayer();
        if (player < 0) return;

        const purse = this.world.must(player, RingPurse);
        const state = this.world.must(player, PlayerState);

        if (purse.rings !== this.lastRings) {
            this.lastRings = purse.rings;
            EventBus.emit('hud:rings', purse.rings);
        }

        if (state.name !== this.lastState) {
            this.lastState = state.name;
            EventBus.emit('hud:state', state.name);
        }

        const whole = Math.floor(this.elapsed);
        if (whole !== this.lastWholeSecond) {
            this.lastWholeSecond = whole;
            EventBus.emit('hud:time', this.elapsed);
        }
    }

    private firstPlayer(): Entity {
        for (const entity of this.world.view(this.players)) return entity;
        return -1;
    }
}
