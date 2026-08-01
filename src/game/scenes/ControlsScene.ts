import { Scene } from 'phaser';
import { drawAngledBar, drawBanner, drawRainbowRule, FONT_HEAVY, THEME, titleStyle } from '@/game/ui/ManiaTheme';

const ROWS: [string, string][] = [
    ['MOVE', '← →  /  A D'],
    ['LOOK UP / CROUCH', '↑ ↓  /  W S'],
    ['JUMP', 'SPACE  /  K'],
    ['THROW RING', 'J  /  F'],
    ['BUZZSAW', 'HOLD ↓ + SPACE, RELEASE'],
    ['SPIKE BLAST', '↓  IN MID-AIR'],
    ['CORNER PEEK', 'HOLD Q  AT AN EDGE'],
    ['LEDGE GRAB', 'AUTOMATIC WHILE FALLING'],
    ['CLIMB UP / DROP', '↑  /  ↓  WHILE HANGING'],
    ['RIDE A SKIFF', 'JUMP INTO ITS GRAB BAR'],
    ['PAUSE', 'ESC  /  P'],
];

/** Move list, reachable from the main menu. */
export class ControlsScene extends Scene {
    constructor() {
        super('Controls');
    }

    create(): void {
        const { width, height } = this.scale;
        this.cameras.main.setBackgroundColor(THEME.bg);

        const header = this.add.graphics();
        drawBanner(header, width / 2, 26, Math.min(560, width * 0.5), 70, THEME.bannerEdge);
        drawBanner(header, width / 2, 22, Math.min(550, width * 0.49), 66, THEME.banner);
        drawRainbowRule(header, width / 2, 92, Math.min(500, width * 0.45), 9);

        this.add.text(width / 2, 54, 'CONTROLS', titleStyle(42)).setOrigin(0.5);

        const startY = 132;
        const rowH = Math.min(46, (height - startY - 90) / ROWS.length);
        const barW = Math.min(760, width * 0.78);
        const barX = (width - barW) / 2;

        const bars = this.add.graphics();
        ROWS.forEach(([action, binding], i) => {
            const y = startY + i * rowH;
            drawAngledBar(bars, barX, y, barW, rowH - 6, i % 2 === 0 ? THEME.bar : THEME.barSelected, 0.9);

            this.add.text(barX + 40, y + (rowH - 6) / 2, action, {
                fontFamily: FONT_HEAVY,
                fontSize: `${Math.round(rowH * 0.4)}px`,
                color: '#ffffff',
            }).setOrigin(0, 0.5);

            this.add.text(barX + barW - 40, y + (rowH - 6) / 2, binding, {
                fontFamily: FONT_HEAVY,
                fontSize: `${Math.round(rowH * 0.36)}px`,
                color: THEME.textSelected,
            }).setOrigin(1, 0.5);
        });

        this.add.text(width / 2, height - 44, 'ESC  /  ENTER  —  BACK', {
            fontFamily: FONT_HEAVY,
            fontSize: '18px',
            color: '#5a4408',
        }).setOrigin(0.5);

        const back = () => this.scene.start('Menu');
        this.input.keyboard?.once('keydown-ESC', back);
        this.input.keyboard?.once('keydown-ENTER', back);
        this.input.keyboard?.once('keydown-SPACE', back);
    }
}
