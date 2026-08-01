import { Group, Object3D } from 'three';

/**
 * A rig is a named bone hierarchy of plain Object3Ds with a remembered bind pose.
 *
 * Characters are assembled from three.js primitives and parented onto these bones,
 * so animation is just "set bone rotations" — no skinning, no external model files.
 */
export interface BoneSpec {
    name: string;
    parent?: string;
    /** Local offset from the parent bone. */
    position?: [number, number, number];
}

export interface BindPose {
    position: [number, number, number];
    rotation: [number, number, number];
}

export class Rig {
    readonly root = new Group();
    readonly bones = new Map<string, Object3D>();
    private readonly bind = new Map<string, BindPose>();

    constructor(specs: BoneSpec[]) {
        for (const spec of specs) {
            const bone = new Group();
            bone.name = spec.name;
            const p = spec.position ?? [0, 0, 0];
            bone.position.set(p[0], p[1], p[2]);

            const parent = spec.parent ? this.bones.get(spec.parent) : undefined;
            (parent ?? this.root).add(bone);

            this.bones.set(spec.name, bone);
            this.bind.set(spec.name, { position: [...p], rotation: [0, 0, 0] });
        }
    }

    bone(name: string): Object3D {
        const bone = this.bones.get(name);
        if (!bone) throw new Error(`Rig has no bone "${name}"`);
        return bone;
    }

    /** Attach visual geometry to a bone. */
    attach(boneName: string, ...objects: Object3D[]): void {
        this.bone(boneName).add(...objects);
    }

    bindPose(name: string): BindPose | undefined {
        return this.bind.get(name);
    }

    /** Restore every bone to its bind pose — called before applying a clip. */
    resetPose(): void {
        for (const [name, pose] of this.bind) {
            const bone = this.bones.get(name)!;
            bone.position.set(pose.position[0], pose.position[1], pose.position[2]);
            bone.rotation.set(pose.rotation[0], pose.rotation[1], pose.rotation[2]);
        }
    }

    /** Swap between the normal body and the spin-ball form. */
    setBallMode(ball: boolean): void {
        const body = this.bones.get('body');
        const ballBone = this.bones.get('ball');
        if (body) body.visible = !ball;
        if (ballBone) ballBone.visible = ball;
    }

    dispose(): void {
        this.root.removeFromParent();
        this.bones.clear();
        this.bind.clear();
    }
}
