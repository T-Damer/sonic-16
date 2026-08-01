import { Intent, PlayerState } from '@/game/components';
import { System } from '@/game/core/ecs';
import type { InputState } from '@/game/core/InputState';

/**
 * Translates the raw device snapshot into per-entity Intent.
 *
 * Nothing downstream ever touches the keyboard, so replays, cutscenes and AI-driven
 * players all work by writing Intent directly.
 */
export class InputSystem extends System {
    private input!: InputState;

    protected init(): void {
        this.input = this.world.getResource<InputState>('input');
    }

    update(): void {
        for (const [entity, intent] of this.world.each(Intent)) {
            // A scripted sequence owns this entity's intent this frame.
            if (intent.scripted) continue;

            const state = this.world.get(entity, PlayerState);
            const controlLocked = (state?.controlLock ?? 0) > 0;

            intent.moveX = controlLocked ? 0 : this.input.moveAxis;
            intent.lookY = controlLocked ? 0 : this.input.verticalAxis;
            intent.jumpPressed = this.input.pressed('jump');
            intent.jumpHeld = this.input.down('jump');
            intent.throwPressed = this.input.pressed('throw');
            intent.peekHeld = this.input.down('peek');
        }
    }
}
