import { Sheet } from '@/components/hig/Sheet';
import { PERMISSION_TEXT, type Permission } from '@/engine/permission';
import { holdHeadline } from '@/screens/home/tileLine';
import type { WalkPlan } from '@/walk/clock';
import { CONSENT, preflightPages, type PreflightAnswer, type WalkSettings } from '@/walk/consent';
import { PrimaryButton, SecondaryButton } from './parts';

const refusalTitle = (p: Permission) => holdHeadline(p) ?? (p.disposition === 'emergency' ? PERMISSION_TEXT.emergencyTitle : 'Not now');
const TEXT = 'text-[length:var(--text-body)] leading-snug';

export interface PreflightStage {
  plan: WalkPlan;
  /** This walk's answers so far: the store may not have written the last one yet. */
  walk: WalkSettings;
  refusal?: Permission;
}

/**
 * The first walk's questions, one page at a time (journey §9.1), and the
 * gate's own answer in their place when it refuses the start (J§4.1). Each
 * page's title is the sheet's name, so VoiceOver reads the question first.
 */
export function PreflightSheet({ stage, onAnswer, onCheckIn, onClose }: {
  /** The walk asked for, the answers given so far, and the gate's refusal if it refused. */
  stage: PreflightStage | null;
  onAnswer: (a: PreflightAnswer) => void;
  onCheckIn: () => void;
  onClose: () => void;
}) {
  const page = stage && !stage.refusal ? preflightPages(stage.walk, stage.plan)[0] : undefined;
  const title = stage?.refusal ? refusalTitle(stage.refusal) : page ? CONSENT[page].title : 'Walk';
  return (
    <Sheet open={stage !== null} onOpenChange={o => { if (!o) onClose(); }} title={title} detent="large">
      {stage?.refusal ? (
        <div role="status" className={`flex flex-col gap-3 ${TEXT}`}>
          {stage.refusal.reasons.map(r => <p key={r}>{r}</p>)}
          {stage.refusal.release && <p className="text-muted-foreground">{stage.refusal.release}</p>}
          {stage.refusal.needsCheckIn
            ? <PrimaryButton onClick={onCheckIn}>Check in</PrimaryButton>
            : <PrimaryButton onClick={onClose}>Close</PrimaryButton>}
        </div>
      ) : page === 'keepRoute' ? (
        <div className="flex flex-col gap-3">
          <p className={TEXT}>{CONSENT.keepRoute.detail}</p>
          {/* Both answers the same weight: neither is the one to tap without reading (§24, K6R-06). */}
          <SecondaryButton onClick={() => onAnswer({ page, keep: true })}>{CONSENT.keepRoute.yes}</SecondaryButton>
          <SecondaryButton onClick={() => onAnswer({ page, keep: false })}>{CONSENT.keepRoute.no}</SecondaryButton>
        </div>
      ) : page === 'mapPictures' ? (
        <div className="flex flex-col gap-3">
          <p className={TEXT}>{CONSENT.mapPictures.detail}</p>
          {/* Map privacy is off until chosen, and neither answer leans (§24, K6R-06). */}
          <SecondaryButton onClick={() => onAnswer({ page, show: true })}>{CONSENT.mapPictures.yes}</SecondaryButton>
          <SecondaryButton onClick={() => onAnswer({ page, show: false })}>{CONSENT.mapPictures.no}</SecondaryButton>
        </div>
      ) : page === 'stepCard' ? (
        <div className="flex flex-col gap-3">
          <p className={TEXT}>{CONSENT.stepCard.detail}</p>
          <PrimaryButton onClick={() => onAnswer({ page })}>{CONSENT.stepCard.go}</PrimaryButton>
        </div>
      ) : null}
    </Sheet>
  );
}
