/**
 * Starting a walk (B-01, motion M10), in one order:
 * 1. in the tap's own handler, ask for motion and unlock audio, synchronously,
 *    because iOS accepts both only there (A-53, L-02);
 * 2. wait for both answers: a person may take a while over the system prompt;
 * 3. ask the gate again: the decision may have changed meanwhile (J§4.1);
 * 4. start once.
 * Refused, nothing starts and the new answer is shown instead.
 */
import type { Permission } from '@/engine/permission';
import type { WalkPlan } from './clock';
import { allowsMovement } from './gate';

export type MotionAnswer = 'granted' | 'denied' | 'unsupported';

export interface StartPorts {
  /** iOS's motion permission. Must be called from the tap. */
  requestMotion(): Promise<MotionAnswer>;
  /** The cue player's one audio element, unlocked. Must be called from the tap. */
  unlockAudio(): Promise<boolean>;
  /** The final gate, asked once the answers are in, never cached from the screen. */
  gate(): Permission;
  go(plan: WalkPlan): void;
}

export type StartOutcome =
  | { kind: 'started'; plan: WalkPlan }
  | { kind: 'refused'; permission: Permission }
  | { kind: 'busy' };

export function createStarter(ports: StartPorts): { tap(plan: WalkPlan, wants: { voice: boolean }): Promise<StartOutcome> } {
  let busy = false;
  return {
    tap(plan, wants) {
      if (busy) return Promise.resolve({ kind: 'busy' });
      busy = true;
      // (1) Before anything is awaited.
      const motion = plan.steps ? ports.requestMotion() : Promise.resolve<MotionAnswer>('unsupported');
      const audio = wants.voice ? ports.unlockAudio() : Promise.resolve(false);
      // (2), (3), (4).
      return Promise.all([motion.catch((): MotionAnswer => 'denied'), audio.catch(() => false)]).then(([m]): StartOutcome => {
        const permission = ports.gate();
        if (!allowsMovement(permission)) {
          busy = false;
          return { kind: 'refused', permission };
        }
        const started: WalkPlan = m === 'denied' ? { ...plan, steps: false, stepsDenied: true } : plan;
        ports.go(started);
        return { kind: 'started', plan: started };
      });
    },
  };
}
