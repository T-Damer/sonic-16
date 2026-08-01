import { Scene } from 'phaser';
import { loadGltfLibrary } from '@/game/render/GltfLibrary';
import { ModelViewer } from '@/game/render/ModelViewer';
import { ASSET_CATALOG, type AssetEntry, type ClipDriver } from '@/game/ui/AssetCatalog';
import {
    drawAngledBar,
    drawBanner,
    drawRainbowRule,
    FONT_HEAVY,
    THEME,
    titleStyle,
} from '@/game/ui/ManiaTheme';

/**
 * EXTRAS — the 3D asset library.
 *
 * A ModelViewer canvas sits behind Phaser's transparent one; this scene draws the
 * Mania-styled chrome on top and drives navigation, clip playback and the turntable.
 */
export class ExtrasScene extends Scene {
    private viewer!: ModelViewer;
    /** Procedural catalog plus any generated GLBs found in the manifest. */
    private catalog: AssetEntry[] = [];
    private index = 0;
    private clipIndex = 0;
    private driver: ClipDriver | null = null;

    private nameText!: Phaser.GameObjects.Text;
    private categoryText!: Phaser.GameObjects.Text;
    private descText!: Phaser.GameObjects.Text;
    private indexText!: Phaser.GameObjects.Text;
    private clipText!: Phaser.GameObjects.Text;

    constructor() {
        super('Extras');
    }

    create(): void {
        const parent = this.game.canvas.parentElement;
        if (!parent) throw new Error('ExtrasScene needs a parent element for the viewer canvas');

        this.viewer = new ModelViewer(parent);
        this.viewer.resize(this.scale.width, this.scale.height);

        this.catalog = [...ASSET_CATALOG];
        this.buildChrome();
        this.bindInput();
        this.setAsset(0);

        // Generated GLBs join the catalog asynchronously (docs/ASSET_GEN_PIPELINE.md).
        let alive = true;
        loadGltfLibrary().then((entries) => {
            if (!alive || entries.length === 0) return;
            this.catalog.push(...entries);
            this.indexText.setText(`${this.index + 1} / ${this.catalog.length}`);
        });

        this.scale.on('resize', this.handleResize, this);
        this.sys.events.once('shutdown', () => {
            alive = false;
            this.scale.off('resize', this.handleResize, this);
            this.viewer.dispose();
        });
    }

    private handleResize(size: Phaser.Structs.Size): void {
        this.viewer.resize(size.width, size.height);
    }

    // ─────────────────────────────────────────────────────────────── chrome

    private buildChrome(): void {
        const { width, height } = this.scale;

        const header = this.add.graphics();
        drawBanner(header, width / 2, 22, Math.min(560, width * 0.5), 66, THEME.bannerEdge);
        drawBanner(header, width / 2, 18, Math.min(550, width * 0.49), 62, THEME.banner);
        drawRainbowRule(header, width / 2, 84, Math.min(500, width * 0.45), 8);

        this.add.text(width / 2, 48, 'ASSET LIBRARY', titleStyle(38)).setOrigin(0.5);

        this.indexText = this.add.text(width - 30, 44, '', {
            fontFamily: FONT_HEAVY,
            fontSize: '22px',
            color: '#ffffff',
            stroke: '#101014',
            strokeThickness: 5,
        }).setOrigin(1, 0.5);

        // ── bottom info plate
        const plate = this.add.graphics();
        drawAngledBar(plate, 18, height - 132, Math.min(620, width * 0.55), 44, THEME.bar, 0.9);
        drawAngledBar(plate, 18, height - 82, Math.min(720, width * 0.62), 36, THEME.barSelected, 0.85);

        this.nameText = this.add.text(56, height - 110, '', {
            fontFamily: FONT_HEAVY,
            fontSize: '26px',
            color: THEME.textSelected,
        }).setOrigin(0, 0.5);

        this.categoryText = this.add.text(60, height - 148, '', {
            fontFamily: FONT_HEAVY,
            fontSize: '14px',
            color: '#101014',
            backgroundColor: '#ffd23f',
            padding: { x: 8, y: 3 },
        }).setOrigin(0, 0.5);

        this.descText = this.add.text(56, height - 64, '', {
            fontFamily: FONT_HEAVY,
            fontSize: '15px',
            color: '#ffffff',
        }).setOrigin(0, 0.5);

        // ── clip readout + help
        this.clipText = this.add.text(width - 30, height - 110, '', {
            fontFamily: FONT_HEAVY,
            fontSize: '18px',
            color: '#8ff2ff',
            stroke: '#101014',
            strokeThickness: 4,
        }).setOrigin(1, 0.5);

        this.add.text(width - 30, height - 64,
            '◄ ► ASSET   ▲ ▼ ANIM   DRAG ROTATE   R SPIN   B SILHOUETTE   ESC BACK', {
            fontFamily: FONT_HEAVY,
            fontSize: '13px',
            color: '#b8b8c4',
            stroke: '#101014',
            strokeThickness: 3,
        }).setOrigin(1, 0.5);
    }

    // ─────────────────────────────────────────────────────────────── input

    private bindInput(): void {
        const keyboard = this.input.keyboard;
        if (!keyboard) return;

        keyboard.on('keydown-LEFT', () => this.setAsset(this.index - 1));
        keyboard.on('keydown-A', () => this.setAsset(this.index - 1));
        keyboard.on('keydown-RIGHT', () => this.setAsset(this.index + 1));
        keyboard.on('keydown-D', () => this.setAsset(this.index + 1));
        keyboard.on('keydown-UP', () => this.cycleClip(-1));
        keyboard.on('keydown-W', () => this.cycleClip(-1));
        keyboard.on('keydown-DOWN', () => this.cycleClip(1));
        keyboard.on('keydown-S', () => this.cycleClip(1));
        keyboard.on('keydown-R', () => {
            this.viewer.autoRotate = !this.viewer.autoRotate;
        });
        keyboard.on('keydown-B', () => {
            this.viewer.toggleSilhouette();
        });
        keyboard.on('keydown-ESC', () => this.scene.start('Menu'));

        // drag to rotate the turntable
        this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
            if (!pointer.isDown) return;
            this.viewer.autoRotate = false;
            this.viewer.addYaw((pointer.position.x - pointer.prevPosition.x) * 0.008);
        });
    }

    // ──────────────────────────────────────────────────────────── selection

    private setAsset(index: number): void {
        const count = this.catalog.length;
        this.index = ((index % count) + count) % count;

        const entry = this.catalog[this.index];
        const built = entry.build();

        this.viewer.setObject(built.object);
        this.driver = built.driver ?? null;
        this.clipIndex = 0;

        if (this.driver && this.driver.clips.length > 0) {
            this.driver.play(this.driver.clips[0]);
        }

        this.nameText.setText(entry.name);
        this.categoryText.setText(entry.category);
        this.descText.setText(entry.description);
        this.indexText.setText(`${this.index + 1} / ${count}`);
        this.refreshClipLabel();
    }

    private cycleClip(delta: number): void {
        if (!this.driver || this.driver.clips.length === 0) return;
        const count = this.driver.clips.length;
        this.clipIndex = ((this.clipIndex + delta) % count + count) % count;
        this.driver.play(this.driver.clips[this.clipIndex]);
        this.refreshClipLabel();
    }

    private refreshClipLabel(): void {
        if (!this.driver || this.driver.clips.length === 0) {
            this.clipText.setText('');
            return;
        }
        const clips = this.driver.clips;
        this.clipText.setText(`CLIP  ${clips[this.clipIndex].toUpperCase()}  (${this.clipIndex + 1}/${clips.length})`);
    }

    update(_time: number, delta: number): void {
        const dt = Math.min(delta / 1000, 0.1);
        this.driver?.update(dt);
        this.viewer.update(dt);
    }
}
