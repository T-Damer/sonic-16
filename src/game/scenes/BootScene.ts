import { Scene } from 'phaser';
import { CLIP_NAMES } from '@/game/render/rig/Clips';
import {
    backdropTexture,
    blobShadowTexture,
    brickTexture,
    grateTexture,
    groundTexture,
    monitorScreenTexture,
    plateTexture,
    slabSideTexture,
    sparkTexture,
} from '@/game/render/TextureFactory';
import { FONT_HEAVY, THEME } from '@/game/ui/ManiaTheme';

/**
 * Warms the procedural texture cache before the first frame so the opening beat
 * doesn't hitch while canvases are rasterised.
 */
export class BootScene extends Scene {
    constructor() {
        super('Boot');
    }

    create(): void {
        const { width, height } = this.scale;
        this.cameras.main.setBackgroundColor(THEME.bg);

        const label = this.add.text(width / 2, height / 2, 'SONIC-16', {
            fontFamily: FONT_HEAVY,
            fontSize: '54px',
            color: THEME.titleFill,
            stroke: '#1c1c1c',
            strokeThickness: 8,
        }).setOrigin(0.5);

        this.add.text(width / 2, height / 2 + 52, 'GENERATING ASSETS…', {
            fontFamily: FONT_HEAVY,
            fontSize: '16px',
            color: '#7a5c07',
        }).setOrigin(0.5);

        // Build every canvas texture up front.
        groundTexture();
        slabSideTexture();
        brickTexture();
        plateTexture();
        backdropTexture();
        grateTexture();
        monitorScreenTexture();
        blobShadowTexture();
        sparkTexture();

        // Touching the clip table forces the degree→radian conversion pass.
        void CLIP_NAMES.length;

        this.tweens.add({
            targets: label,
            scale: 1.06,
            duration: 320,
            yoyo: true,
            onComplete: () => this.scene.start('Menu'),
        });
    }
}
