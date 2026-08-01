import type { World } from '@/game/core/ecs/World';

export abstract class System {
    protected world!: World;
    /** Set false to skip this system's update (used for cutscene freezes). */
    enabled = true;

    attach(world: World): void {
        this.world = world;
        this.init();
    }

    /** Build queries / cache resources here. */
    protected init(): void {}

    abstract update(dt: number): void;

    /** Called when the scene shuts down. */
    dispose(): void {}
}

/** Ordered list of systems run once per fixed step. */
export class SystemPipeline {
    private readonly systems: System[] = [];

    constructor(private readonly world: World) {}

    add(...systems: System[]): this {
        for (const system of systems) {
            system.attach(this.world);
            this.systems.push(system);
        }
        return this;
    }

    get<T extends System>(ctor: new (...args: any[]) => T): T | undefined {
        return this.systems.find((s) => s instanceof ctor) as T | undefined;
    }

    update(dt: number): void {
        for (const system of this.systems) {
            if (system.enabled) system.update(dt);
        }
        this.world.flush();
    }

    dispose(): void {
        for (const system of this.systems) system.dispose();
        this.systems.length = 0;
    }
}
