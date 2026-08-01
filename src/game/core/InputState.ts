import {
    ACTIONS,
    GAMEPAD_AXIS_DEADZONE,
    GAMEPAD_BINDINGS,
    KEYBOARD_BINDINGS,
    type Action,
} from '@/game/config/Controls';

interface ButtonState {
    down: boolean;
    pressedAt: number;
    releasedAt: number;
    /** true only for the frame it went down */
    justPressed: boolean;
    justReleased: boolean;
}

/**
 * Device-agnostic input snapshot.
 *
 * Owns its own DOM listeners so it survives Phaser scene restarts, and polls the
 * Gamepad API each frame. `beginFrame()` must be called once per rendered frame.
 */
export class InputState {
    private readonly states = new Map<Action, ButtonState>();
    private readonly heldKeys = new Set<string>();
    private time = 0;
    private disposed = false;
    /** Set while a menu owns input, so gameplay ignores it. */
    blocked = false;

    private readonly onKeyDown = (e: KeyboardEvent) => {
        const action = KEYBOARD_BINDINGS[e.code];
        if (!action) return;
        if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
        if (this.heldKeys.has(e.code)) return;
        this.heldKeys.add(e.code);
        this.press(action);
    };

    private readonly onKeyUp = (e: KeyboardEvent) => {
        const action = KEYBOARD_BINDINGS[e.code];
        if (!action) return;
        this.heldKeys.delete(e.code);
        // only release the action if no other bound key still holds it
        for (const code of this.heldKeys) {
            if (KEYBOARD_BINDINGS[code] === action) return;
        }
        this.release(action);
    };

    private readonly onBlur = () => {
        this.heldKeys.clear();
        for (const action of ACTIONS) this.release(action);
    };

    constructor() {
        for (const action of ACTIONS) {
            this.states.set(action, {
                down: false,
                pressedAt: -Infinity,
                releasedAt: -Infinity,
                justPressed: false,
                justReleased: false,
            });
        }
        window.addEventListener('keydown', this.onKeyDown);
        window.addEventListener('keyup', this.onKeyUp);
        window.addEventListener('blur', this.onBlur);
    }

    private state(action: Action): ButtonState {
        return this.states.get(action)!;
    }

    private press(action: Action): void {
        const s = this.state(action);
        if (s.down) return;
        s.down = true;
        s.justPressed = true;
        s.pressedAt = this.time;
    }

    private release(action: Action): void {
        const s = this.state(action);
        if (!s.down) return;
        s.down = false;
        s.justReleased = true;
        s.releasedAt = this.time;
    }

    /** Call once per rendered frame, before systems run. */
    beginFrame(elapsed: number): void {
        this.time = elapsed;
        for (const s of this.states.values()) {
            s.justPressed = false;
            s.justReleased = false;
        }
        this.pollGamepad();
    }

    private pollGamepad(): void {
        const pads = navigator.getGamepads?.();
        if (!pads) return;
        const pad = Array.from(pads).find((p) => p && p.connected);
        if (!pad) return;

        for (const [indexStr, action] of Object.entries(GAMEPAD_BINDINGS)) {
            const button = pad.buttons[Number(indexStr)];
            if (!button) continue;
            if (button.pressed) this.press(action);
            else if (!this.keyboardHolds(action)) this.release(action);
        }

        const ax = pad.axes[0] ?? 0;
        const ay = pad.axes[1] ?? 0;
        this.axisToAction(ax < -GAMEPAD_AXIS_DEADZONE, 'left');
        this.axisToAction(ax > GAMEPAD_AXIS_DEADZONE, 'right');
        this.axisToAction(ay < -GAMEPAD_AXIS_DEADZONE, 'up');
        this.axisToAction(ay > GAMEPAD_AXIS_DEADZONE, 'down');
    }

    private axisToAction(active: boolean, action: Action): void {
        if (active) this.press(action);
        else if (!this.keyboardHolds(action) && !this.padButtonHolds(action)) this.release(action);
    }

    private keyboardHolds(action: Action): boolean {
        for (const code of this.heldKeys) {
            if (KEYBOARD_BINDINGS[code] === action) return true;
        }
        return false;
    }

    private padButtonHolds(action: Action): boolean {
        const pads = navigator.getGamepads?.();
        const pad = pads ? Array.from(pads).find((p) => p && p.connected) : null;
        if (!pad) return false;
        for (const [indexStr, mapped] of Object.entries(GAMEPAD_BINDINGS)) {
            if (mapped !== action) continue;
            if (pad.buttons[Number(indexStr)]?.pressed) return true;
        }
        return false;
    }

    // ------------------------------------------------------------------ queries

    down(action: Action): boolean {
        return !this.blocked && this.state(action).down;
    }

    pressed(action: Action): boolean {
        return !this.blocked && this.state(action).justPressed;
    }

    released(action: Action): boolean {
        return !this.blocked && this.state(action).justReleased;
    }

    /** Was `action` pressed within the last `window` seconds? (jump buffering) */
    pressedWithin(action: Action, window: number): boolean {
        return !this.blocked && this.time - this.state(action).pressedAt <= window;
    }

    consume(action: Action): void {
        this.state(action).pressedAt = -Infinity;
        this.state(action).justPressed = false;
    }

    /** -1, 0 or 1 */
    get moveAxis(): number {
        return (this.down('right') ? 1 : 0) - (this.down('left') ? 1 : 0);
    }

    get verticalAxis(): number {
        return (this.down('up') ? 1 : 0) - (this.down('down') ? 1 : 0);
    }

    dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
        window.removeEventListener('keydown', this.onKeyDown);
        window.removeEventListener('keyup', this.onKeyUp);
        window.removeEventListener('blur', this.onBlur);
    }
}
