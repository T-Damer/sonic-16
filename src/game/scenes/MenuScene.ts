import { Scene } from 'phaser';
import {
    drawAngledBar,
    drawBanner,
    drawPromptPip,
    drawRainbowRule,
    FONT_HEAVY,
    THEME,
    titleStyle,
} from '@/game/ui/ManiaTheme';

interface MenuEntry {
    label: string;
    action: () => void;
    enabled?: boolean;
}

/**
 * The front-end: a rotating arc field in SEGA yellow, a chevron banner, a starfield
 * preview panel and a fan of angled option bars.
 *
 * Entirely vector-drawn — there are no menu image assets in this project.
 */
export class MenuScene extends Scene {
    private arcGraphics!: Phaser.GameObjects.Graphics;
    private barGraphics!: Phaser.GameObjects.Graphics;
    private entryTexts: Phaser.GameObjects.Text[] = [];
    private entries: MenuEntry[] = [];
    private selected = 0;
    private arcPhase = 0;
    private stars: { sprite: Phaser.GameObjects.Arc; speed: number }[] = [];
    private previewTitle!: Phaser.GameObjects.Text;
    private previewBlurb!: Phaser.GameObjects.Text;

    constructor() {
        super('Menu');
    }

    create(): void {
        const { width, height } = this.scale;

        this.entries = [
            { label: 'START GAME', action: () => this.startGame() },
            { label: 'TIME ATTACK', action: () => this.startGame(true) },
            { label: 'CONTROLS', action: () => this.showControls() },
            { label: 'OPTIONS', action: () => this.flashUnavailable() },
            { label: 'EXTRAS', action: () => this.scene.start('Extras') },
        ];

        this.drawBackground(width, height);
        this.drawPreviewPanel(width, height);
        this.drawHeader(width);
        this.buildEntries(width, height);
        this.drawPrompts(width, height);

        this.bindInput();
        this.refreshSelection();

        this.scale.on('resize', this.handleResize, this);
        this.events.once('shutdown', () => this.scale.off('resize', this.handleResize, this));
    }

    private handleResize(): void {
        this.scene.restart();
    }

    // ────────────────────────────────────────────────────────────── background

    private drawBackground(width: number, height: number): void {
        this.cameras.main.setBackgroundColor(THEME.bg);

        this.arcGraphics = this.add.graphics();
        this.arcGraphics.setDepth(0);

        // A soft vignette so the yellow doesn't flatten the whole screen.
        const vignette = this.add.graphics().setDepth(1);
        vignette.fillStyle(THEME.bgDeep, 0.35);
        vignette.fillRect(0, height * 0.82, width, height * 0.18);
    }

    /** Concentric ribbons sweeping out from the lower-left, slowly rotating. */
    private redrawArcs(width: number, height: number): void {
        const g = this.arcGraphics;
        g.clear();

        const cx = width * 0.34;
        const cy = height * 0.52;
        const maxRadius = Math.hypot(width, height) * 0.9;

        for (let i = THEME.arcs.length - 1; i >= 0; i--) {
            const color = THEME.arcs[i];
            const radius = maxRadius * (0.32 + i * 0.13);
            const thickness = maxRadius * 0.035;
            const wobble = Math.sin(this.arcPhase * 0.6 + i * 0.8) * 0.09;

            g.lineStyle(thickness, color, 0.85);
            g.beginPath();
            g.arc(cx, cy, radius, -Math.PI * 0.15 + wobble, Math.PI * 0.95 + wobble, false);
            g.strokePath();
        }
    }

    // ─────────────────────────────────────────────────────────── preview panel

    /** Left-hand panel: a starfield with the characters silhouetted on tiles. */
    private drawPreviewPanel(width: number, height: number): void {
        const panelX = width * 0.06;
        const panelY = height * 0.26;
        const panelW = width * 0.46;
        const panelH = height * 0.46;

        const panel = this.add.graphics().setDepth(2);
        panel.fillStyle(0x000000, 0.35);
        panel.fillRect(panelX + 8, panelY + 10, panelW, panelH);
        panel.fillStyle(THEME.panelSpace, 1);
        panel.fillRect(panelX, panelY, panelW, panelH);

        // starfield
        for (let i = 0; i < 46; i++) {
            const x = panelX + Math.random() * panelW;
            const y = panelY + Math.random() * (panelH * 0.72);
            const r = Math.random() * 1.8 + 0.6;
            const star = this.add.circle(x, y, r, THEME.panelStar, 0.5 + Math.random() * 0.5);
            star.setDepth(3);
            this.stars.push({ sprite: star, speed: 4 + Math.random() * 14 });
        }

        // a couple of nebula smudges
        const neb = this.add.graphics().setDepth(3);
        neb.fillStyle(0x5b3fb0, 0.35);
        neb.fillEllipse(panelX + panelW * 0.62, panelY + panelH * 0.3, 130, 60);
        neb.fillStyle(0x2f6fd0, 0.25);
        neb.fillEllipse(panelX + panelW * 0.28, panelY + panelH * 0.42, 110, 48);

        // tiled floor the cast stands on
        const floorY = panelY + panelH * 0.72;
        const floor = this.add.graphics().setDepth(4);
        const tileW = panelW / 5;
        for (let i = 0; i < 5; i++) {
            floor.fillStyle(i % 2 === 0 ? 0x8a6a2a : 0x6f5320, 1);
            floor.fillRect(panelX + i * tileW, floorY, tileW, panelH * 0.28);
            floor.fillStyle(0x3f8f5f, 1);
            floor.fillRect(panelX + i * tileW + 6, floorY + 8, tileW - 12, 6);
        }

        // simple standing silhouettes of the cast
        const castColors = [0x2f5fd0, 0xd9a01e, 0xd42b2b, 0x3fa64b];
        castColors.forEach((color, i) => {
            const cx = panelX + panelW * (0.24 + i * 0.17);
            const cy = floorY - 6;
            const body = this.add.graphics().setDepth(5);
            body.fillStyle(color, 1);
            body.fillEllipse(cx, cy - 26, 34, 40);
            body.fillCircle(cx, cy - 56, 22);
            body.fillStyle(0x000000, 0.25);
            body.fillEllipse(cx, cy + 2, 40, 10);
        });

        // panel border
        const border = this.add.graphics().setDepth(6);
        border.lineStyle(4, 0x101014, 1);
        border.strokeRect(panelX, panelY, panelW, panelH);

        // caption under the panel
        this.previewTitle = this.add.text(panelX, panelY + panelH + 18, '', {
            fontFamily: FONT_HEAVY,
            fontSize: '26px',
            color: '#101014',
        }).setDepth(6);

        this.previewBlurb = this.add.text(panelX, panelY + panelH + 50, '', {
            fontFamily: FONT_HEAVY,
            fontSize: '17px',
            color: '#5a4408',
            wordWrap: { width: panelW },
        }).setDepth(6);
    }

    // ─────────────────────────────────────────────────────────────── header

    private drawHeader(width: number): void {
        const g = this.add.graphics().setDepth(7);

        drawBanner(g, width / 2, 26, Math.min(620, width * 0.55), 74, THEME.bannerEdge);
        drawBanner(g, width / 2, 22, Math.min(610, width * 0.54), 70, THEME.banner);
        drawRainbowRule(g, width / 2, 96, Math.min(560, width * 0.5), 10);

        this.add.text(width / 2, 56, 'MAIN MENU', titleStyle(50))
            .setOrigin(0.5)
            .setDepth(8);

        this.add.text(width / 2, 118, 'SONIC-16  ·  FAN PROTOTYPE', {
            fontFamily: FONT_HEAVY,
            fontSize: '15px',
            color: '#7a5c07',
        }).setOrigin(0.5).setDepth(8);
    }

    // ───────────────────────────────────────────────────────── option bars

    private buildEntries(width: number, height: number): void {
        this.barGraphics = this.add.graphics().setDepth(9);
        this.entryTexts = [];

        const barH = Math.min(64, height * 0.085);
        const gap = barH * 0.22;
        const startY = height * 0.28;
        const barW = width * 0.42;
        const baseX = width * 0.56;

        this.entries.forEach((entry, i) => {
            const y = startY + i * (barH + gap);
            const text = this.add.text(baseX + 42, y + barH / 2, entry.label, {
                fontFamily: FONT_HEAVY,
                fontSize: `${Math.round(barH * 0.52)}px`,
                color: THEME.textPrimary,
            }).setOrigin(0, 0.5).setDepth(10);

            text.setInteractive({ useHandCursor: true });
            text.on('pointerover', () => {
                this.selected = i;
                this.refreshSelection();
            });
            text.on('pointerdown', () => this.confirm());

            this.entryTexts.push(text);
        });

        this.layoutBars(barW, barH, gap, startY, baseX);
    }

    private layoutBars(barW: number, barH: number, gap: number, startY: number, baseX: number): void {
        this.barGraphics.clear();
        this.entries.forEach((_, i) => {
            const y = startY + i * (barH + gap);
            const selected = i === this.selected;
            const offset = selected ? -18 : 0;

            // drop shadow
            drawAngledBar(this.barGraphics, baseX + offset + 6, y + 6, barW, barH, 0x000000, 0.25);
            drawAngledBar(
                this.barGraphics,
                baseX + offset,
                y,
                barW,
                barH,
                selected ? THEME.barSelected : THEME.bar,
                1,
            );

            if (selected) {
                // highlight sliver on the leading edge
                drawAngledBar(this.barGraphics, baseX + offset - 10, y, 12, barH, THEME.titleFillHex, 1);
            }

            const text = this.entryTexts[i];
            if (text) {
                text.x = baseX + offset + 42;
                text.y = y + barH / 2;
                text.setColor(selected ? THEME.textSelected : THEME.textPrimary);
                text.setScale(selected ? 1.06 : 1);
            }
        });
    }

    private refreshSelection(): void {
        const { width, height } = this.scale;
        const barH = Math.min(64, height * 0.085);
        const gap = barH * 0.22;
        this.layoutBars(width * 0.42, barH, gap, height * 0.28, width * 0.56);

        const blurbs = [
            'Climb out of the sewers and cut a path through the refinery.',
            'Same act, clock running. Beat your best time.',
            'Review the full move list and key bindings.',
            'Audio, video and accessibility settings.',
            'The asset library — every 3D model and animation in the build.',
        ];
        this.previewTitle.setText(this.entries[this.selected].label);
        this.previewBlurb.setText(blurbs[this.selected] ?? '');
    }

    // ───────────────────────────────────────────────────────────── prompts

    private drawPrompts(width: number, height: number): void {
        drawPromptPip(this, 54, height - 46, '↺', THEME.promptRing, 'BACK').setDepth(11);
        const confirm = drawPromptPip(this, width - 210, height - 46, '✕', THEME.promptCross, 'CONFIRM');
        confirm.setDepth(11);

        this.add.text(width / 2, height - 20,
            'Sonic the Hedgehog and related characters are trademarks of SEGA. ' +
            'Non-commercial fan project — all art generated procedurally.', {
            fontFamily: FONT_HEAVY,
            fontSize: '11px',
            color: '#8a6a10',
        }).setOrigin(0.5).setDepth(11);
    }

    // ─────────────────────────────────────────────────────────────── input

    private bindInput(): void {
        const keyboard = this.input.keyboard;
        if (!keyboard) return;

        keyboard.on('keydown-UP', () => this.move(-1));
        keyboard.on('keydown-W', () => this.move(-1));
        keyboard.on('keydown-DOWN', () => this.move(1));
        keyboard.on('keydown-S', () => this.move(1));
        keyboard.on('keydown-ENTER', () => this.confirm());
        keyboard.on('keydown-SPACE', () => this.confirm());
        keyboard.on('keydown-X', () => this.confirm());
    }

    private move(delta: number): void {
        this.selected = (this.selected + delta + this.entries.length) % this.entries.length;
        this.refreshSelection();
        this.cameras.main.shake(60, 0.0012);
    }

    private confirm(): void {
        const entry = this.entries[this.selected];
        this.cameras.main.flash(140, 255, 210, 63);
        this.time.delayedCall(90, () => entry.action());
    }

    private startGame(timeAttack = false): void {
        this.scene.start('Game', { timeAttack });
    }

    private showControls(): void {
        this.scene.start('Controls');
    }

    private flashUnavailable(): void {
        this.previewBlurb.setText('Not implemented in this prototype build.');
        this.cameras.main.shake(120, 0.004);
    }

    update(_time: number, delta: number): void {
        const { width, height } = this.scale;
        this.arcPhase += delta / 1000;
        this.redrawArcs(width, height);

        // drift the starfield
        const panelX = width * 0.06;
        const panelW = width * 0.46;
        for (const star of this.stars) {
            star.sprite.x -= (star.speed * delta) / 1000;
            if (star.sprite.x < panelX) star.sprite.x = panelX + panelW;
        }
    }
}
