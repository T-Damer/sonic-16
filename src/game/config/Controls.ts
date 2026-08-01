/** Logical actions the game reads. Input devices map onto these. */
export type Action =
    | 'left'
    | 'right'
    | 'up'
    | 'down'
    | 'jump'
    | 'throw'
    | 'peek'
    | 'pause';

export const ACTIONS: readonly Action[] = [
    'left', 'right', 'up', 'down', 'jump', 'throw', 'peek', 'pause',
];

/** KeyboardEvent.code → action. Multiple keys may map to one action. */
export const KEYBOARD_BINDINGS: Record<string, Action> = {
    ArrowLeft: 'left',
    KeyA: 'left',
    ArrowRight: 'right',
    KeyD: 'right',
    ArrowUp: 'up',
    KeyW: 'up',
    ArrowDown: 'down',
    KeyS: 'down',
    Space: 'jump',
    KeyK: 'jump',
    KeyJ: 'throw',
    KeyF: 'throw',
    KeyQ: 'peek',
    ShiftLeft: 'peek',
    Escape: 'pause',
    KeyP: 'pause',
};

/** Standard gamepad button index → action. */
export const GAMEPAD_BINDINGS: Record<number, Action> = {
    0: 'jump',   // A / cross
    2: 'throw',  // X / square
    4: 'peek',   // LB
    9: 'pause',  // start
    12: 'up',
    13: 'down',
    14: 'left',
    15: 'right',
};

export const GAMEPAD_AXIS_DEADZONE = 0.45;

/** Human-readable prompts for the HUD. */
export const ACTION_LABELS: Record<Action, string> = {
    left: '←',
    right: '→',
    up: '↑',
    down: '↓',
    jump: 'SPACE',
    throw: 'J',
    peek: 'Q',
    pause: 'ESC',
};
