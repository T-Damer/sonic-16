/**
 * Component definitions.
 *
 * A component type is just an id + a factory. Data lives in the World's stores,
 * never on the type itself.
 */

let nextComponentId = 0;

export interface ComponentType<T> {
    readonly id: number;
    readonly name: string;
    /** Produces a fresh instance; partial overrides are merged in by World.add. */
    readonly create: () => T;
}

/**
 * Declare a component type.
 *
 * ```ts
 * export const Velocity = defineComponent('Velocity', () => ({ x: 0, y: 0 }));
 * ```
 */
export function defineComponent<T extends object>(name: string, create: () => T): ComponentType<T> {
    return { id: nextComponentId++, name, create };
}

/** A tag component carries no data beyond its presence. */
export function defineTag(name: string): ComponentType<Record<string, never>> {
    return defineComponent(name, () => ({}) as Record<string, never>);
}

export function componentCount(): number {
    return nextComponentId;
}
