import { Scene } from 'phaser';
import { EventBus } from '@/game/EventBus';
import { drawAngledBar, FONT_HEAVY, THEME } from '@/game/ui/ManiaTheme';

/**
 * The in-game overlay: ring count, timer, contextual prompts and the level-end card.
 * Runs on Phaser's transparent canvas, above the 3D world.
 */
export class HudScene extends Scene {
    private ringText!: Phaser.GameObjects.Text;
    private timeText!: Phaser.GameObjects.Text;
    private promptText!: Phaser.GameObjects.Text;
    private promptBg!: Phaser.GameObjects.Graphics;
    private ringIcon!: Phaser.GameObjects.Graphics;
    private flash!: Phaser.GameObjects.Rectangle;

    private ringPulse = 0;
    private ringIconPhase = 0;

    constructor() {
        super('Hud');
    }

    create(): void {
        const { width, height } = this.scale;

        // ── top-left plate
        const plate = this.add.graphics();
        drawAngledBar(plate, 18, 16, 260, 44, THEME.bar, 0.82);
        drawAngledBar(plate, 18, 66, 200, 36, THEME.bar, 0.72);

        this.ringIcon = this.add.graphics();

        this.ringText = this.add.text(96, 38, '0', {
            fontFamily: FONT_HEAVY,
            fontSize: '30px',
            color: '#ffd23f',
            stroke: '#101014',
            strokeThickness: 4,
        }).setOrigin(0, 0.5);

        this.add.text(58, 84, 'TIME', {
            fontFamily: FONT_HEAVY,
            fontSize: '15px',
            color: '#b8b8c4',
        }).setOrigin(0, 0.5);

        this.timeText = this.add.text(120, 84, '0:00', {
            fontFamily: FONT_HEAVY,
            fontSize: '20px',
            color: '#ffffff',
        }).setOrigin(0, 0.5);

        // ── contextual prompt, centred low
        this.promptBg = this.add.graphics().setAlpha(0);
        this.promptText = this.add.text(width / 2, height - 92, '', {
            fontFamily: FONT_HEAVY,
            fontSize: '19px',
            color: '#ffffff',
        }).setOrigin(0.5).setAlpha(0);

        // ── damage flash
        this.flash = this.add.rectangle(0, 0, width, height, 0xff3b30, 0)
            .setOrigin(0, 0)
            .setDepth(50);

        this.bindEvents();

        this.scale.on('resize', this.handleResize, this);
        this.sys.events.once('shutdown', () => {
            this.scale.off('resize', this.handleResize, this);
            this.unbindEvents();
        });
    }

    private handleResize(size: Phaser.Structs.Size): void {
        this.promptText.setPosition(size.width / 2, size.height - 92);
        this.flash.setSize(size.width, size.height);
        this.redrawPromptBg();
    }

    // ─────────────────────────────────────────────────────────────── events

    private onRings = (rings: number) => {
        this.ringText.setText(String(rings));
        this.ringPulse = 1;
    };

    private onTime = (seconds: number) => {
        const total = Math.floor(seconds);
        const mm = Math.floor(total / 60);
        const ss = total % 60;
        this.timeText.setText(`${mm}:${ss.toString().padStart(2, '0')}`);
    };

    private onPrompt = (text: string | null) => {
        if (!text) {
            this.tweens.add({ targets: [this.promptText, this.promptBg], alpha: 0, duration: 220 });
            return;
        }
        this.promptText.setText(text);
        this.redrawPromptBg();
        this.tweens.add({ targets: [this.promptText, this.promptBg], alpha: 1, duration: 220 });
    };

    private onHurt = () => {
        this.flash.setAlpha(0.35);
        this.tweens.add({ targets: this.flash, alpha: 0, duration: 320 });
    };

    private onDied = () => {
        this.flash.setFillStyle(0x000000);
        this.flash.setAlpha(0.55);
        this.tweens.add({
            targets: this.flash,
            alpha: 0,
            duration: 900,
            onComplete: () => this.flash.setFillStyle(0xff3b30),
        });
    };

    private onCheckpoint = () => {
        const { width } = this.scale;
        const text = this.add.text(width / 2, 150, 'CHECKPOINT', {
            fontFamily: FONT_HEAVY,
            fontSize: '30px',
            color: '#ffd23f',
            stroke: '#101014',
            strokeThickness: 6,
        }).setOrigin(0.5).setAlpha(0);

        this.tweens.add({
            targets: text,
            alpha: 1,
            y: 130,
            duration: 260,
            yoyo: true,
            hold: 900,
            onComplete: () => text.destroy(),
        });
    };

    private onLevelComplete = (payload: { time: number; rings: number }) => {
        const { width, height } = this.scale;

        const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0)
            .setOrigin(0, 0)
            .setDepth(60);
        this.tweens.add({ targets: overlay, fillAlpha: 0.72, duration: 600 });

        const total = Math.floor(payload.time);
        const mm = Math.floor(total / 60);
        const ss = total % 60;

        const card = this.add.container(width / 2, height / 2).setDepth(61).setAlpha(0);

        const plate = this.add.graphics();
        drawAngledBar(plate, -260, -110, 520, 220, THEME.bar, 0.95);
        card.add(plate);

        card.add(this.add.text(0, -62, 'ACT CLEAR', {
            fontFamily: FONT_HEAVY,
            fontSize: '44px',
            color: THEME.titleFill,
            stroke: '#101014',
            strokeThickness: 7,
        }).setOrigin(0.5));

        card.add(this.add.text(0, 4, `TIME   ${mm}:${ss.toString().padStart(2, '0')}`, {
            fontFamily: FONT_HEAVY,
            fontSize: '24px',
            color: '#ffffff',
        }).setOrigin(0.5));

        card.add(this.add.text(0, 40, `RINGS   ${payload.rings}`, {
            fontFamily: FONT_HEAVY,
            fontSize: '24px',
            color: '#ffffff',
        }).setOrigin(0.5));

        card.add(this.add.text(0, 84, 'PRESS  ENTER  FOR THE MENU', {
            fontFamily: FONT_HEAVY,
            fontSize: '15px',
            color: THEME.textDim,
        }).setOrigin(0.5));

        this.tweens.add({ targets: card, alpha: 1, duration: 500, delay: 300 });

        this.input.keyboard?.once('keydown-ENTER', () => {
            this.scene.stop('Game');
            this.scene.stop('Hud');
            this.scene.start('Menu');
        });
    };

    private bindEvents(): void {
        EventBus.on('hud:rings', this.onRings);
        EventBus.on('hud:time', this.onTime);
        EventBus.on('hud:prompt', this.onPrompt);
        EventBus.on('hud:hurt', this.onHurt);
        EventBus.on('hud:died', this.onDied);
        EventBus.on('hud:checkpoint', this.onCheckpoint);
        EventBus.on('hud:levelComplete', this.onLevelComplete);
    }

    private unbindEvents(): void {
        EventBus.off('hud:rings', this.onRings);
        EventBus.off('hud:time', this.onTime);
        EventBus.off('hud:prompt', this.onPrompt);
        EventBus.off('hud:hurt', this.onHurt);
        EventBus.off('hud:died', this.onDied);
        EventBus.off('hud:checkpoint', this.onCheckpoint);
        EventBus.off('hud:levelComplete', this.onLevelComplete);
    }

    // ───────────────────────────────────────────────────────────── drawing

    private redrawPromptBg(): void {
        const { width, height } = this.scale;
        const textWidth = Math.max(200, this.promptText.width + 60);
        this.promptBg.clear();
        drawAngledBar(
            this.promptBg,
            width / 2 - textWidth / 2,
            height - 112,
            textWidth,
            40,
            THEME.bar,
            0.85,
        );
    }

    update(_time: number, delta: number): void {
        // Spinning ring icon, matching the collectables in the world.
        this.ringIconPhase += delta / 1000 * 3.2;
        const squash = Math.abs(Math.cos(this.ringIconPhase));

        this.ringIcon.clear();
        this.ringIcon.lineStyle(6, 0xffc61e, 1);
        this.ringIcon.strokeEllipse(60, 38, 14 + 14 * squash, 30);
        this.ringIcon.lineStyle(2, 0xfff3a8, 0.9);
        this.ringIcon.strokeEllipse(58, 36, 9 + 9 * squash, 22);

        // Ring counter pop on change.
        if (this.ringPulse > 0) {
            this.ringPulse = Math.max(0, this.ringPulse - delta / 220);
            this.ringText.setScale(1 + this.ringPulse * 0.22);
        }
    }
}
