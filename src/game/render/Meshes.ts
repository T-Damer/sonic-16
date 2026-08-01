import {
    BoxGeometry,
    CircleGeometry,
    ConeGeometry,
    CylinderGeometry,
    DoubleSide,
    Group,
    Mesh,
    MeshBasicMaterial,
    Object3D,
    PlaneGeometry,
    RingGeometry,
    SphereGeometry,
    TorusGeometry,
    type Material,
} from 'three';
import { WORLD } from '@/game/config/GameConfig';
import {
    backdropMaterial,
    blobShadowMaterial,
    glow,
    grateMaterial,
    groundTopMaterial,
    metal,
    monitorScreenMaterial,
    panelMaterial,
    PALETTE,
    slabSideMaterial,
    solidColor,
    wallMaterial,
} from '@/game/render/Materials';

/** Depth (thickness in Z) given to gameplay solids so they read as real volumes. */
const SOLID_DEPTH = 3.2;

function shadowed(mesh: Mesh, cast = true, receive = true): Mesh {
    mesh.castShadow = cast;
    mesh.receiveShadow = receive;
    return mesh;
}

/**
 * Ground slab: ochre gravel top, teal plating on the sides, with a green pipe rail
 * running along the front lip (the signature silhouette of the reference frames).
 */
export function createGroundSlab(w: number, h: number): Group {
    const group = new Group();

    const side = slabSideMaterial();
    const top = groundTopMaterial();
    // BoxGeometry material order: +X, -X, +Y, -Y, +Z, -Z
    const materials: Material[] = [side, side, top, side, side, side];
    const body = shadowed(new Mesh(new BoxGeometry(w, h, SOLID_DEPTH), materials));
    group.add(body);

    // Front pipe rail along the bottom edge of the visible face.
    const railRadius = 0.16;
    const rail = shadowed(new Mesh(
        new CylinderGeometry(railRadius, railRadius, w, 10),
        solidColor('rail', PALETTE.pipeGreen),
    ));
    rail.rotation.z = Math.PI / 2;
    rail.position.set(0, -h / 2 + railRadius * 1.4, SOLID_DEPTH / 2 + railRadius * 0.6);
    group.add(rail);

    // Rail collars
    const collarCount = Math.max(2, Math.round(w / 1.6));
    for (let i = 0; i < collarCount; i++) {
        const collar = new Mesh(
            new CylinderGeometry(railRadius * 1.45, railRadius * 1.45, 0.14, 8),
            solidColor('railCollar', 0x3d6f4a),
        );
        collar.rotation.z = Math.PI / 2;
        collar.position.set(
            -w / 2 + (i + 0.5) * (w / collarCount),
            rail.position.y,
            rail.position.z,
        );
        group.add(collar);
    }

    return group;
}

/** One-way pipe platform: a white/blue cylinder lying along X with joint collars. */
export function createPipePlatform(w: number, h: number): Group {
    const group = new Group();
    const radius = Math.max(0.16, h / 2);

    const pipe = shadowed(new Mesh(
        new CylinderGeometry(radius, radius, w, 14),
        solidColor('pipeBody', PALETTE.pipeWhite),
    ));
    pipe.rotation.z = Math.PI / 2;
    group.add(pipe);

    const joints = Math.max(2, Math.round(w / 2.2));
    for (let i = 0; i <= joints; i++) {
        const joint = shadowed(new Mesh(
            new CylinderGeometry(radius * 1.22, radius * 1.22, radius * 0.55, 12),
            solidColor('pipeJoint', PALETTE.pipeBlue),
        ));
        joint.rotation.z = Math.PI / 2;
        joint.position.x = -w / 2 + (i * w) / joints;
        group.add(joint);
    }

    // Back support struts so it doesn't look like it floats.
    const strutCount = Math.max(1, Math.round(w / 4));
    for (let i = 0; i < strutCount; i++) {
        const strut = shadowed(new Mesh(
            new BoxGeometry(0.18, 0.9, 0.18),
            solidColor('pipeStrut', 0x4a7f8a),
        ));
        strut.position.set(
            -w / 2 + (i + 0.5) * (w / strutCount),
            -radius - 0.4,
            -0.8,
        );
        group.add(strut);
    }

    return group;
}

/** Solid green brick wall block. */
export function createWallBlock(w: number, h: number): Group {
    const group = new Group();
    const mat = wallMaterial().clone();
    mat.map = mat.map!.clone();
    mat.map.needsUpdate = true;
    mat.map.repeat.set(Math.max(1, w / 3), Math.max(1, h / 3));

    const body = shadowed(new Mesh(new BoxGeometry(w, h, SOLID_DEPTH), mat));
    group.add(body);

    // Capstone lip so ledge grabs read clearly.
    const cap = shadowed(new Mesh(
        new BoxGeometry(w + 0.18, 0.22, SOLID_DEPTH + 0.18),
        solidColor('wallCap', 0x35583f),
    ));
    cap.position.y = h / 2;
    group.add(cap);

    return group;
}

/**
 * Background cooler / extractor fan. The rotor is returned as a child named 'rotor'
 * so the animation system can spin it — these are what make the backdrop feel alive.
 */
export function createCooler(radius: number): Group {
    const group = new Group();

    // Recessed housing
    const housing = new Mesh(
        new BoxGeometry(radius * 2.5, radius * 2.5, 0.5),
        panelMaterial(),
    );
    housing.receiveShadow = true;
    group.add(housing);

    const ring = new Mesh(
        new TorusGeometry(radius, radius * 0.12, 8, 28),
        solidColor('coolerRing', 0x9fd0e8),
    );
    ring.position.z = 0.32;
    group.add(ring);

    // Dark cavity behind the blades
    const cavity = new Mesh(
        new CircleGeometry(radius * 0.96, 24),
        solidColor('coolerCavity', 0x123448),
    );
    cavity.position.z = 0.1;
    group.add(cavity);

    const rotor = new Group();
    rotor.name = 'rotor';
    rotor.position.z = 0.26;

    const hub = new Mesh(
        new SphereGeometry(radius * 0.17, 10, 8),
        solidColor('coolerHub', 0x7fb4d4),
    );
    rotor.add(hub);

    const bladeGeom = new PlaneGeometry(radius * 0.92, radius * 0.52);
    const bladeMat = solidColor('coolerBlade', 0xa8ccd8).clone();
    bladeMat.side = DoubleSide;
    for (let i = 0; i < 4; i++) {
        const blade = new Mesh(bladeGeom, bladeMat);
        const angle = (i / 4) * Math.PI * 2;
        blade.position.set(Math.cos(angle) * radius * 0.5, Math.sin(angle) * radius * 0.5, 0);
        blade.rotation.z = angle;
        blade.rotation.x = 0.42; // pitch the blades so the spin reads
        rotor.add(blade);
    }
    group.add(rotor);

    return group;
}

/** Vertical machinery column with indicator lights (background dressing). */
export function createMachineColumn(w: number, h: number): Group {
    const group = new Group();

    const body = new Mesh(new BoxGeometry(w, h, 0.7), panelMaterial());
    body.receiveShadow = true;
    group.add(body);

    // Readout strip
    const panel = new Mesh(
        new PlaneGeometry(w * 0.55, h * 0.35),
        solidColor('readout', 0x11303f),
    );
    panel.position.set(0, h * 0.1, 0.38);
    group.add(panel);

    for (let i = 0; i < 4; i++) {
        const bar = new Mesh(
            new PlaneGeometry(w * 0.4, 0.05),
            glow('readoutBar', 0xdfeef5, 0.85),
        );
        bar.position.set(0, h * 0.22 - i * 0.14, 0.4);
        group.add(bar);
    }

    // Blue-lit access hatch at the base
    const hatch = new Mesh(
        new PlaneGeometry(w * 0.6, h * 0.22),
        glow('hatch', 0x4fb8e8, 0.6),
    );
    hatch.position.set(0, -h * 0.32, 0.38);
    group.add(hatch);

    return group;
}

/** Deep parallax backdrop panel. */
export function createBackdropPanel(w: number, h: number): Mesh {
    const mat = backdropMaterial().clone();
    mat.map = mat.map!.clone();
    mat.map.needsUpdate = true;
    mat.map.repeat.set(Math.max(1, w / 12), 1);
    const mesh = new Mesh(new PlaneGeometry(w, h), mat);
    mesh.position.z = WORLD.layers.backdrop;
    return mesh;
}

/** The sewer grate Sonic climbs out of at the level start. */
export function createSewerGrate(w: number): Group {
    const group = new Group();

    const frame = shadowed(new Mesh(
        new BoxGeometry(w, 0.16, 1.6),
        metal('grateFrame', 0x5d6a70),
    ));
    group.add(frame);

    const hole = new Mesh(
        new BoxGeometry(w * 0.72, 0.12, 1.1),
        grateMaterial(),
    );
    hole.position.y = -0.03;
    group.add(hole);

    // Open hatch lid, flipped back
    const lid = shadowed(new Mesh(
        new BoxGeometry(w * 0.72, 0.1, 1.1),
        metal('grateLid', 0x6f7d84),
    ));
    lid.position.set(w * 0.72, 0.28, 0);
    lid.rotation.z = -1.15;
    group.add(lid);

    return group;
}

/** Spike column — stacked gold segments with metal barbs. Breakable. */
export function createSpikeColumn(height: number): Group {
    const group = new Group();

    const post = shadowed(new Mesh(
        new CylinderGeometry(0.13, 0.15, height, 8),
        solidColor('spikePost', PALETTE.pipeWhite),
    ));
    post.position.y = height / 2;
    group.add(post);

    const segments = Math.max(1, Math.round(height / 0.55));
    for (let i = 0; i < segments; i++) {
        const y = 0.35 + i * 0.55;
        const drum = shadowed(new Mesh(
            new CylinderGeometry(0.24, 0.24, 0.34, 10),
            solidColor('spikeDrum', PALETTE.spikeGold),
        ));
        drum.position.y = y;
        group.add(drum);

        // Barbs radiating from the drum
        for (let b = 0; b < 6; b++) {
            const angle = (b / 6) * Math.PI * 2 + (i % 2) * 0.5;
            const barb = shadowed(new Mesh(
                new ConeGeometry(0.09, 0.3, 6),
                solidColor('spikeBarb', PALETTE.spikeTip),
            ));
            barb.position.set(Math.cos(angle) * 0.3, y, Math.sin(angle) * 0.3);
            barb.rotation.z = -Math.PI / 2;
            barb.rotation.y = -angle;
            group.add(barb);
        }
    }

    // Crown
    const crown = shadowed(new Mesh(
        new ConeGeometry(0.22, 0.38, 8),
        solidColor('spikeCrown', PALETTE.spikeGold),
    ));
    crown.position.y = height + 0.1;
    group.add(crown);

    return group;
}

/** A collectable ring: gold torus that spins on Y. */
export function createRing(): Group {
    const group = new Group();
    const ring = new Mesh(
        new TorusGeometry(0.26, 0.075, 8, 20),
        solidColor('ring', PALETTE.ringGold, { emissive: PALETTE.ringGold, emissiveIntensity: 0.45 }),
    );
    ring.castShadow = true;
    group.add(ring);

    // Inner highlight band so it catches the eye when spinning edge-on.
    const shine = new Mesh(
        new TorusGeometry(0.26, 0.03, 6, 20),
        glow('ringShine', PALETTE.ringGoldLight, 0.9),
    );
    shine.position.z = 0.03;
    group.add(shine);

    return group;
}

/** Ring monitor: box on a post with a glowing green screen. */
export function createRingMonitor(): Group {
    const group = new Group();

    const post = shadowed(new Mesh(
        new BoxGeometry(0.12, 0.42, 0.12),
        metal('monitorPost', 0x6b7780),
    ));
    post.position.y = 0.21;
    group.add(post);

    const box = shadowed(new Mesh(
        new BoxGeometry(0.72, 0.68, 0.6),
        metal('monitorBox', 0xc9d2d8, 0.4),
    ));
    box.position.y = 0.76;
    group.add(box);

    const screen = new Mesh(new PlaneGeometry(0.56, 0.5), monitorScreenMaterial());
    screen.position.set(0, 0.76, 0.31);
    group.add(screen);

    return group;
}

/** The level-end blast door. Panels are named for the sequence system. */
export function createBlastDoor(w: number, h: number): Group {
    const group = new Group();

    // Dark hallway behind the panels
    const cavity = new Mesh(
        new PlaneGeometry(w, h),
        new MeshBasicMaterial({ color: 0x05070a }),
    );
    cavity.position.z = -0.35;
    group.add(cavity);

    const frame = shadowed(new Mesh(
        new BoxGeometry(w + 0.6, h + 0.4, 0.4),
        solidColor('doorFrame', 0x3c6b4e),
    ));
    frame.position.z = -0.5;
    group.add(frame);

    const panelGeom = new BoxGeometry(w / 2, h, 0.3);
    const left = shadowed(new Mesh(panelGeom, metal('doorPanel', 0x7d8b95, 0.45)));
    left.name = 'doorLeft';
    left.position.x = -w / 4;
    group.add(left);

    const right = shadowed(new Mesh(panelGeom, metal('doorPanel', 0x7d8b95, 0.45)));
    right.name = 'doorRight';
    right.position.x = w / 4;
    group.add(right);

    return group;
}

/**
 * Small blue tray platform bolted to a wall — the descent ledges from the
 * reference frames. Brackets reach toward +X (walls sit on the right of shafts).
 */
export function createWallLedge(w: number): Group {
    const group = new Group();

    const tray = shadowed(new Mesh(
        new BoxGeometry(w, 0.18, 1.15),
        solidColor('ledgeTray', PALETTE.pipeBlue),
    ));
    group.add(tray);

    const plate = shadowed(new Mesh(
        new BoxGeometry(w * 0.94, 0.05, 1.02),
        solidColor('ledgePlate', 0x9fc6e8),
    ));
    plate.position.y = 0.1;
    group.add(plate);

    // front lip pipe
    const lip = shadowed(new Mesh(
        new CylinderGeometry(0.07, 0.07, w, 8),
        solidColor('ledgeLip', PALETTE.pipeWhite),
    ));
    lip.rotation.z = Math.PI / 2;
    lip.position.set(0, 0.04, 0.56);
    group.add(lip);

    // wall brackets
    for (const dz of [-0.35, 0.35]) {
        const bracket = shadowed(new Mesh(
            new BoxGeometry(0.5, 0.12, 0.12),
            metal('ledgeBracket', 0x6b7780),
        ));
        bracket.position.set(w / 2 + 0.2, -0.08, dz);
        group.add(bracket);
    }

    return group;
}

/** Dark oval pit-hole decal laid on a deck's top face (frame 2's foreground holes). */
export function createPitHole(size: number): Group {
    const group = new Group();

    const hole = new Mesh(
        new CircleGeometry(size * 0.5, 22),
        glow('holeDark', 0x05080c, 1),
    );
    hole.rotation.x = -Math.PI / 2;
    hole.scale.set(1.25, 1, 0.7);
    hole.position.y = 0.025;
    group.add(hole);

    const rim = new Mesh(
        new RingGeometry(size * 0.5, size * 0.5 + 0.07, 22),
        solidColor('holeRim', 0x35606c),
    );
    rim.rotation.x = -Math.PI / 2;
    rim.scale.set(1.25, 1, 0.7);
    rim.position.y = 0.02;
    group.add(rim);

    return group;
}

/** Blue pipe handle bolted to a wall face — the descent-shaft grab dressing. */
export function createHandle(): Group {
    const group = new Group();

    const bar = shadowed(new Mesh(
        new CylinderGeometry(0.055, 0.055, 0.85, 8),
        solidColor('handleBar', PALETTE.pipeBlue),
    ));
    bar.rotation.x = Math.PI / 2;
    group.add(bar);

    for (const dz of [-0.32, 0.32]) {
        const stub = shadowed(new Mesh(
            new CylinderGeometry(0.05, 0.05, 0.35, 8),
            solidColor('handleStub', 0x4e7d9e),
        ));
        stub.rotation.z = Math.PI / 2;
        stub.position.set(0.16, 0, dz);
        group.add(stub);
    }

    return group;
}

/** Soft contact shadow decal, laid flat under an actor. */
export function createBlobShadow(radius: number): Mesh {
    const mesh = new Mesh(new PlaneGeometry(radius * 2, radius * 2), blobShadowMaterial());
    mesh.rotation.x = -Math.PI / 2;
    mesh.renderOrder = -1;
    return mesh;
}

/** Expanding shockwave ring for the spike blast. */
export function createShockwave(): Mesh {
    const mat = glow('shockwave', 0xbfe8ff, 0.85).clone();
    mat.transparent = true;
    const mesh = new Mesh(new RingGeometry(0.3, 0.45, 24), mat);
    mesh.rotation.x = -Math.PI / 2;
    return mesh;
}

/** Small debris chunk used when spikes/monitors shatter. */
export function createDebris(color: number, size: number): Mesh {
    return shadowed(new Mesh(new BoxGeometry(size, size, size), solidColor(`debris${color}`, color)), true, false);
}

/** Utility: recursively enable shadows on an imported/composed group. */
export function enableShadows(root: Object3D, cast = true, receive = false): void {
    root.traverse((child) => {
        if ((child as Mesh).isMesh) {
            child.castShadow = cast;
            child.receiveShadow = receive;
        }
    });
}
