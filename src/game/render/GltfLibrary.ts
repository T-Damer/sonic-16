import {
    AnimationMixer,
    NearestFilter,
    type AnimationAction,
    type Mesh,
    type Object3D,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { PIXEL } from '@/game/config/GameConfig';
import type { AssetEntry, ClipDriver } from '@/game/ui/AssetCatalog';

/**
 * Runtime loader for generated GLB assets — the landing zone of
 * docs/ASSET_GEN_PIPELINE.md.
 *
 * Drop `<name>.glb` into public/assets/models/, list it in manifest.json, and it
 * appears in EXTRAS under IMPORTED with the full review tooling (turntable,
 * silhouette gate, clip playback). Missing manifest → empty library, no error.
 */

interface ManifestModel {
    id: string;
    name: string;
    file: string;
    description?: string;
    scale?: number;
}

interface Manifest {
    models: ManifestModel[];
}

/** Match imported textures to the house pixel look. */
function pixelate(root: Object3D): void {
    if (!PIXEL.enabled) return;
    root.traverse((node) => {
        const mesh = node as Mesh;
        if (!mesh.isMesh) return;
        mesh.castShadow = true;
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const material of materials) {
            const map = (material as { map?: { magFilter: number; minFilter: number; generateMipmaps: boolean; needsUpdate: boolean } }).map;
            if (!map) continue;
            map.magFilter = NearestFilter;
            map.minFilter = NearestFilter;
            map.generateMipmaps = false;
            map.needsUpdate = true;
        }
    });
}

export async function loadGltfLibrary(baseUrl = 'assets/models/'): Promise<AssetEntry[]> {
    let manifest: Manifest;
    try {
        const response = await fetch(`${baseUrl}manifest.json`);
        if (!response.ok) return [];
        manifest = (await response.json()) as Manifest;
    } catch {
        return [];
    }
    if (!manifest?.models?.length) return [];

    const loader = new GLTFLoader();
    const entries: AssetEntry[] = [];

    for (const model of manifest.models) {
        try {
            const gltf = await loader.loadAsync(baseUrl + model.file);
            const object = gltf.scene;
            // Cached across viewer selections — the viewer must not dispose it.
            object.userData.preserve = true;
            if (model.scale) object.scale.setScalar(model.scale);
            pixelate(object);

            const animations = gltf.animations ?? [];

            entries.push({
                id: model.id,
                name: model.name.toUpperCase(),
                category: 'IMPORTED',
                description: model.description ?? `Generated asset — ${model.file}`,
                build: () => {
                    let driver: ClipDriver | undefined;
                    if (animations.length > 0) {
                        const mixer = new AnimationMixer(object);
                        let current: AnimationAction | null = null;
                        driver = {
                            clips: animations.map((clip) => clip.name),
                            play(name) {
                                const clip = animations.find((c) => c.name === name);
                                if (!clip) return;
                                current?.stop();
                                current = mixer.clipAction(clip);
                                current.reset().play();
                            },
                            update(dt) {
                                mixer.update(dt);
                            },
                        };
                    }
                    return { object, driver };
                },
            });
        } catch (error) {
            console.warn(`[GltfLibrary] failed to load ${model.file}:`, error);
        }
    }

    return entries;
}
