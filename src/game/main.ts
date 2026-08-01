import { AUTO, Core, Game, Scale, type Types } from 'phaser';
import { BootScene } from '@/game/scenes/BootScene';
import { ControlsScene } from '@/game/scenes/ControlsScene';
import { ExtrasScene } from '@/game/scenes/ExtrasScene';
import { GameScene } from '@/game/scenes/GameScene';
import { HudScene } from '@/game/scenes/HudScene';
import { MenuScene } from '@/game/scenes/MenuScene';
import { PauseScene } from '@/game/scenes/PauseScene';

/**
 * Phaser runs *transparent*: it owns the 2D layers (menus, HUD, fades) while the
 * three.js canvas sits behind it rendering the 3D world. See docs/ARCHITECTURE.md.
 */
const config: Types.Core.GameConfig = {
    type: AUTO,
    parent: 'game-container',
    transparent: true,
    // Sizing must live inside `scale`. Passing top-level width/height *alongside*
    // a scale block makes Phaser boot the canvas at 0x0, so StartGame injects
    // measured pixels below and RESIZE mode tracks the container from then on.
    scale: {
        mode: Scale.RESIZE,
        parent: 'game-container',
        autoCenter: Scale.NO_CENTER,
    },
    render: {
        antialias: true,
        pixelArt: false,
    },
    scene: [BootScene, MenuScene, ControlsScene, ExtrasScene, GameScene, HudScene, PauseScene],
};

/** Best available pixel size for the game surface, with sane fallbacks. */
function measure(host: HTMLElement | null): { width: number; height: number } {
    const rect = host?.getBoundingClientRect();
    const width = Math.floor(host?.clientWidth || rect?.width || window.innerWidth || 1280);
    const height = Math.floor(host?.clientHeight || rect?.height || window.innerHeight || 720);
    return { width: Math.max(1, width), height: Math.max(1, height) };
}

const StartGame = (parent: string) => {
    const host = document.getElementById(parent);
    const { width, height } = measure(host);

    const game = new Game({
        ...config,
        parent,
        scale: { ...config.scale, parent, width, height },
    });

    /**
     * Self-healing sizing.
     *
     * A game booted into a container that is still 0x0 (hidden tab, layout not yet
     * flushed, an embedding host that lays out late) never recovers on its own —
     * Phaser stays at zero and no scene ever renders. Watching the container and
     * re-applying a real size fixes that case without affecting the normal one.
     */
    if (host && typeof ResizeObserver !== 'undefined') {
        let lastWidth = 0;
        let lastHeight = 0;

        const apply = () => {
            const size = measure(host);
            if (size.width <= 1 || size.height <= 1) return;
            if (size.width === lastWidth && size.height === lastHeight) return;
            lastWidth = size.width;
            lastHeight = size.height;
            game.scale.resize(size.width, size.height);
        };

        new ResizeObserver(apply).observe(host);
        game.events.once(Core.Events.READY, apply);
    }

    // Handy for poking at the running game from the devtools console.
    (window as unknown as Record<string, unknown>).__SONIC16 = game;

    return game;
};

export default StartGame;
