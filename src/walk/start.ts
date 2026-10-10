/**
 * Starting a walk (B-01, motion M10), in one order:
 * 1. in the tap's own handler, ask for motion and unlock audio, synchronously,
 *    because iOS accepts both only there (A-53, L-02);
 * 2. wait for both answers: a person may take a while over the system prompt;
 * 3. ask the gate again: the decision may have changed meanwhile (J§4.1);
 * 4. start once.
 * Refused, nothing starts and the new answer is shown instead. Given up while
 * the answers are pending — Close, another screen, this one gone — the
 * attempt never navigates, and its audio is dropped (H6-08).
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
  /** Stop whatever the unlock started playing: the attempt it was for is given up. */
  dropAudio(): void;
}

export type StartOutcome =
  | { kind: 'started'; plan: WalkPlan }
  | { kind: 'refused'; permission: Permission }
  | { kind: 'busy' }
  /** Given up before its answers were in (H6-08): nothing was asked or started. */
  | { kind: 'cancelled' };

export interface Starter {
  tap(plan: WalkPlan, wants: { voice: boolean }): Promise<StartOutcome>;
  /** Give up the attempt in flight, if there is one: it never navigates, and its audio stops. */
  cancel(): void;
}

export function createStarter(ports: StartPorts): Starter {
  let busy = false;
  // Each attempt's number: only the current one may go on once its answers are in.
  let attempt = 0;
  return {
    tap(plan, wants) {
      if (busy) return Promise.resolve({ kind: 'busy' });
      busy = true;
      const mine = ++attempt;
      // (1) Before anything is awaited.
      const motion = plan.steps ? ports.requestMotion() : Promise.resolve<MotionAnswer>('unsupported');
      const audio = wants.voice ? ports.unlockAudio() : Promise.resolve(false);
      // (2), (3), (4).
      return Promise.all([motion.catch((): MotionAnswer => 'denied'), audio.catch(() => false)]).then(([m]): StartOutcome => {
        if (mine !== attempt) return { kind: 'cancelled' };
        // From here to the end nothing is awaited, so no tap comes in between,
        // and Start answers again after a start that came back or threw (KH-14).
        busy = false;
        const permission = ports.gate();
        if (!allowsMovement(permission)) return { kind: 'refused', permission };
        const started: WalkPlan = m === 'denied' ? { ...plan, steps: false, stepsDenied: true } : plan;
        ports.go(started);
        return { kind: 'started', plan: started };
      });
    },
    cancel() {
      if (!busy) return;
      attempt++;
      busy = false;
      ports.dropAudio();
    },
  };
}
