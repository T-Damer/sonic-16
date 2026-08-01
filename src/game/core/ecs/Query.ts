import type { ComponentType } from '@/game/core/ecs/Component';
import type { Entity } from '@/game/core/ecs/Entity';
import {
    createSignature,
    sigContainsAll,
    sigContainsNone,
    sigSet,
    type Signature,
} from '@/game/core/ecs/Signature';

export interface QueryDescriptor {
    all?: ComponentType<any>[];
    none?: ComponentType<any>[];
}

/**
 * A cached list of entities matching a signature constraint.
 * The list is rebuilt lazily whenever the World reports a structural change.
 */
export class Query {
    readonly allMask: Signature = createSignature();
    readonly noneMask: Signature = createSignature();

    private entities: Entity[] = [];
    private cachedVersion = -1;

    constructor(desc: QueryDescriptor) {
        for (const c of desc.all ?? []) sigSet(this.allMask, c.id);
        for (const c of desc.none ?? []) sigSet(this.noneMask, c.id);
    }

    matches(sig: Signature): boolean {
        return sigContainsAll(sig, this.allMask) && sigContainsNone(sig, this.noneMask);
    }

    /**
     * @param version   world.structuralVersion
     * @param source    iterable of (entity, signature) pairs
     */
    refresh(version: number, source: () => Iterable<[Entity, Signature]>): readonly Entity[] {
        if (version === this.cachedVersion) return this.entities;
        this.entities.length = 0;
        for (const [entity, sig] of source()) {
            if (this.matches(sig)) this.entities.push(entity);
        }
        this.cachedVersion = version;
        return this.entities;
    }

    invalidate(): void {
        this.cachedVersion = -1;
    }
}
