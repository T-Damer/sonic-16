/** Minimal typed pub/sub used for gameplay events inside the ECS world. */

export type Listener<T> = (payload: T) => void;

export class Signal<T> {
    private listeners: Listener<T>[] = [];

    on(fn: Listener<T>): () => void {
        this.listeners.push(fn);
        return () => this.off(fn);
    }

    off(fn: Listener<T>): void {
        const i = this.listeners.indexOf(fn);
        if (i >= 0) this.listeners.splice(i, 1);
    }

    emit(payload: T): void {
        // copy so handlers may unsubscribe during dispatch
        for (const fn of this.listeners.slice()) fn(payload);
    }

    clear(): void {
        this.listeners.length = 0;
    }
}

import type { Entity } from '@/game/core/ecs/Entity';

export interface GameEvents {
    ringsChanged: { rings: number; delta: number };
    playerHurt: { rings: number };
    playerDied: Record<string, never>;
    playerRespawned: { x: number; y: number };
    checkpointReached: { index: number };
    enemyDestroyed: { entity: Entity; kind: string; x: number; y: number };
    monitorBroken: { x: number; y: number };
    spikesBroken: { x: number; y: number };
    cameraShake: { amount: number };
    promptChanged: { text: string | null };
    sequenceStarted: { id: string };
    sequenceFinished: { id: string };
    levelComplete: { time: number; rings: number };
}

/** Strongly-typed event hub, one instance per World (stored as a resource). */
export class EventHub {
    private signals = new Map<keyof GameEvents, Signal<any>>();

    private signal<K extends keyof GameEvents>(key: K): Signal<GameEvents[K]> {
        let sig = this.signals.get(key);
        if (!sig) {
            sig = new Signal<GameEvents[K]>();
            this.signals.set(key, sig);
        }
        return sig;
    }

    on<K extends keyof GameEvents>(key: K, fn: Listener<GameEvents[K]>): () => void {
        return this.signal(key).on(fn);
    }

    emit<K extends keyof GameEvents>(key: K, payload: GameEvents[K]): void {
        this.signal(key).emit(payload);
    }

    clear(): void {
        for (const sig of this.signals.values()) sig.clear();
        this.signals.clear();
    }
}
