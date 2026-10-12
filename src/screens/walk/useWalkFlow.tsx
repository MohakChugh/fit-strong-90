import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useGuided } from '@/hooks/useGuided';
import { getState, setWalkSettings } from '@/store/useStore';
import { requestMotion } from '@/walk/browser';
import type { WalkPlan } from '@/walk/clock';
import { answered, answerOf, preflightPages, walkSettings, withConsent, type PreflightAnswer, type WalkSettings } from '@/walk/consent';
import { storeStartPermission } from '@/walk/gate';
import { originOf } from '@/walk/plan';
import { startedHref } from '@/walk/started';
import { createStarter } from '@/walk/start';
import { walkVoice } from '@/walk/voice';
import { PreflightSheet, type PreflightStage } from './PreflightSheet';

/**
 * A walk's start, from the tap that asked for it (journey §9.1, B-01): the
 * first-walk questions while any are unanswered, then the start sequence in
 * the tap that finally starts the walk. `useStartMovement` hands it every
 * start to `/walk/live`, so every screen that starts a walk gets the same.
 */
export function useWalkFlow(onCheckIn: (plan: WalkPlan) => void): { begin(plan: WalkPlan): void; ui: ReactNode } {
  const navigate = useNavigate();
  const { pathname, key } = useLocation();
  const { profile } = useGuided();
  const [stage, setStage] = useState<PreflightStage | null>(null);
  const pack = profile.voice.pack ?? 'af_heart';

  const starter = useMemo(() => createStarter({
    requestMotion,
    unlockAudio: () => walkVoice().unlock(pack),
    dropAudio: () => walkVoice().cancel(),
    gate: () => storeStartPermission(),
    // The one way a new walk reaches the live screen (H6-04).
    go: plan => navigate(startedHref(plan), { viewTransition: true }),
  }), [navigate, pack]);
  // A start given up while its answers are pending — another screen, or this
  // one gone — never navigates later (H6-08). Close gives it up below.
  useEffect(() => () => starter.cancel(), [starter, key]);

  /**
   * The tap that finally starts the walk: B-01's sequence, inside this
   * handler. `walk` is this walk's answers, passed on rather than read back
   * from the store, which may not have written the last one yet.
   */
  const final = (plan: WalkPlan, walk: WalkSettings) => {
    const ready = withConsent({ ...plan, from: plan.from ?? originOf(pathname) }, walk);
    void starter.tap(ready, { voice: profile.voice.muted !== true }).then(outcome => {
      if (outcome.kind === 'refused') setStage({ plan, walk, refusal: outcome.permission });
      if (outcome.kind === 'started') setStage(null);
    });
  };

  const begin = (plan: WalkPlan) => {
    const walk = walkSettings(getState().settings);
    if (preflightPages(walk, plan).length > 0) setStage({ plan, walk });
    else final(plan, walk);
  };

  const answer = (a: PreflightAnswer) => {
    if (!stage) return;
    const next = answered(stage.walk, a);
    // Stored at once, whatever the gate says next: a refused start never asks again (Review Focus 5).
    // Only the answer given, against this phone's settings as stored then: nothing else in this sheet's copy is written back (H6R-07).
    void setWalkSettings(answerOf(a));
    if (preflightPages(next, stage.plan).length > 0) setStage({ plan: stage.plan, walk: next });
    else final(stage.plan, next);
  };

  const ui = (
    <PreflightSheet
      stage={stage}
      onAnswer={answer}
      onCheckIn={() => { const s = stage; setStage(null); if (s) onCheckIn(s.plan); }}
      onClose={() => { starter.cancel(); setStage(null); }}
    />
  );
  return { begin, ui };
}
