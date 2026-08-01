import { Scene } from 'phaser';
import { drawAngledBar, FONT_HEAVY, THEME } from '@/game/ui/ManiaTheme';

/** Overlay shown while the simulation is frozen. */
export class PauseScene extends Scene {
    constructor() {
        super('Pause');
    }

    create(): void {
        const { width, height } = this.scale;

        this.add.rectangle(0, 0, width, height, 0x000000, 0.6).setOrigin(0, 0);

        const plate = this.add.graphics();
        drawAngledBar(plate, width / 2 - 200, height / 2 - 90, 400, 180, THEME.bar, 0.95);

        this.add.text(width / 2, height / 2 - 44, 'PAUSED', {
            fontFamily: FONT_HEAVY,
            fontSize: '42px',
            color: THEME.titleFill,
            stroke: '#101014',
            strokeThickness: 7,
        }).setOrigin(0.5);

        this.add.text(width / 2, height / 2 + 14, 'ESC — RESUME', {
            fontFamily: FONT_HEAVY,
            fontSize: '18px',
            color: '#ffffff',
        }).setOrigin(0.5);

        this.add.text(width / 2, height / 2 + 46, 'M — QUIT TO MENU', {
            fontFamily: FONT_HEAVY,
            fontSize: '18px',
            color: THEME.textDim,
        }).setOrigin(0.5);

        this.input.keyboard?.on('keydown-M', () => {
            this.scene.stop('Game');
            this.scene.stop('Hud');
            this.scene.stop('Pause');
            this.scene.start('Menu');
        });
    }
}
