import type { ComponentType } from '@/game/core/ecs/Component';
import type { Entity } from '@/game/core/ecs/Entity';
import { Query, type QueryDescriptor } from '@/game/core/ecs/Query';
import {
    createSignature,
    sigClear,
    sigHas,
    sigReset,
    sigSet,
    type Signature,
} from '@/game/core/ecs/Signature';

/**
 * Sparse-set ECS world.
 *
 * - component data lives in one Map<Entity, T> per component type
 * - each entity carries a bitset signature so queries are a cheap mask test
 * - destruction is deferred to `flush()` so systems can iterate safely
 */
export class World {
    private nextEntity: Entity = 0;
    private readonly alive = new Set<Entity>();
    private readonly signatures = new Map<Entity, Signature>();
    private readonly stores = new Map<number, Map<Entity, any>>();
    private readonly recycled: Entity[] = [];

    private readonly pendingDestroy = new Set<Entity>();
    private readonly queries: Query[] = [];

    /** Bumped whenever an entity or component is added/removed. */
    structuralVersion = 0;

    /** Arbitrary per-world blackboard for cross-system state (level, camera, fx pools…). */
    readonly resources = new Map<string, unknown>();

    // ---------------------------------------------------------------- entities

    create(): Entity {
        const entity = this.recycled.length > 0 ? this.recycled.pop()! : this.nextEntity++;
        this.alive.add(entity);
        let sig = this.signatures.get(entity);
        if (sig) sigReset(sig);
        else {
            sig = createSignature();
            this.signatures.set(entity, sig);
        }
        this.structuralVersion++;
        return entity;
    }

    isAlive(entity: Entity): boolean {
        return this.alive.has(entity);
    }

    /** Marks for destruction at the next `flush()`. */
    destroy(entity: Entity): void {
        if (this.alive.has(entity)) this.pendingDestroy.add(entity);
    }

    /** Applies deferred destruction. Call once per frame, after the pipeline. */
    flush(): void {
        if (this.pendingDestroy.size === 0) return;
        for (const entity of this.pendingDestroy) {
            const sig = this.signatures.get(entity);
            if (sig) {
                for (const [typeId, store] of this.stores) {
                    if (sigHas(sig, typeId)) store.delete(entity);
                }
                sigReset(sig);
            }
            this.alive.delete(entity);
            this.recycled.push(entity);
        }
        this.pendingDestroy.clear();
        this.structuralVersion++;
    }

    // -------------------------------------------------------------- components

    private storeOf<T>(type: ComponentType<T>): Map<Entity, T> {
        let store = this.stores.get(type.id);
        if (!store) {
            store = new Map<Entity, T>();
            this.stores.set(type.id, store);
        }
        return store as Map<Entity, T>;
    }

    add<T extends object>(entity: Entity, type: ComponentType<T>, init?: Partial<T>): T {
        const data = type.create();
        if (init) Object.assign(data, init);
        this.storeOf(type).set(entity, data);
        const sig = this.signatures.get(entity);
        if (sig) sigSet(sig, type.id);
        this.structuralVersion++;
        return data;
    }

    get<T>(entity: Entity, type: ComponentType<T>): T | undefined {
        return this.storeOf(type).get(entity);
    }

    /** Throws if absent — use where the query already guarantees presence. */
    must<T>(entity: Entity, type: ComponentType<T>): T {
        const data = this.storeOf(type).get(entity);
        if (data === undefined) {
            throw new Error(`Entity ${entity} is missing component ${type.name}`);
        }
        return data;
    }

    has<T>(entity: Entity, type: ComponentType<T>): boolean {
        const sig = this.signatures.get(entity);
        return sig ? sigHas(sig, type.id) : false;
    }

    remove<T>(entity: Entity, type: ComponentType<T>): void {
        if (!this.storeOf(type).delete(entity)) return;
        const sig = this.signatures.get(entity);
        if (sig) sigClear(sig, type.id);
        this.structuralVersion++;
    }

    /** All live entities carrying `type`, as [entity, data] pairs. */
    each<T>(type: ComponentType<T>): Iterable<[Entity, T]> {
        const store = this.storeOf(type);
        const alive = this.alive;
        const pending = this.pendingDestroy;
        return {
            *[Symbol.iterator]() {
                for (const pair of store) {
                    if (alive.has(pair[0]) && !pending.has(pair[0])) yield pair;
                }
            },
        };
    }

    // ------------------------------------------------------------------ queries

    query(desc: QueryDescriptor): Query {
        const q = new Query(desc);
        this.queries.push(q);
        return q;
    }

    /** Resolve a query against the current world state. */
    view(query: Query): readonly Entity[] {
        return query.refresh(this.structuralVersion, () => this.entitySignatures());
    }

    private *entitySignatures(): Iterable<[Entity, Signature]> {
        for (const entity of this.alive) {
            if (this.pendingDestroy.has(entity)) continue;
            const sig = this.signatures.get(entity);
            if (sig) yield [entity, sig];
        }
    }

    // ---------------------------------------------------------------- resources

    setResource<T>(key: string, value: T): T {
        this.resources.set(key, value);
        return value;
    }

    getResource<T>(key: string): T {
        const value = this.resources.get(key);
        if (value === undefined) throw new Error(`Missing world resource: ${key}`);
        return value as T;
    }

    tryResource<T>(key: string): T | undefined {
        return this.resources.get(key) as T | undefined;
    }

    // ------------------------------------------------------------------- teardown

    clear(): void {
        for (const store of this.stores.values()) store.clear();
        this.alive.clear();
        this.signatures.clear();
        this.pendingDestroy.clear();
        this.recycled.length = 0;
        this.nextEntity = 0;
        for (const q of this.queries) q.invalidate();
        this.structuralVersion++;
    }

    get entityCount(): number {
        return this.alive.size;
    }
}
