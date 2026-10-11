import type { ReactNode } from 'react';
import { Group } from '@/components/hig/List';
import { CheckRows } from '@/screens/you/controls';
import { cn } from '@/lib/utils';
import { factsOf } from '@/setup/facts';
import type { PainArea } from '@/types/profile';
import { AREAS, TRI } from '../choices';
import { Ask, Missing, type PageProps } from '../controls';

/**
 * A body seen from behind, its areas tappable (journey §6.2 ch. 5). A picture
 * only: the list beside it is the control, for screen readers and for any
 * area too small to tap with confidence.
 */
function BodyPicture({ chosen, onToggle }: { chosen: readonly PainArea[]; onToggle: (area: PainArea) => void }) {
  const area = (id: PainArea, shape: ReactNode) => (
    <g key={id} onClick={() => onToggle(id)} className={cn('cursor-pointer transition-colors', chosen.includes(id) ? 'fill-tint/70' : 'fill-tint/10')}>{shape}</g>
  );
  return (
    <svg aria-hidden viewBox="0 0 120 230" className="mx-auto h-56 w-auto">
      <g className="fill-muted">
        <circle cx="60" cy="18" r="13" />
        <rect x="38" y="34" width="44" height="78" rx="14" />
        <rect x="20" y="40" width="14" height="66" rx="7" />
        <rect x="86" y="40" width="14" height="66" rx="7" />
        <rect x="40" y="108" width="18" height="110" rx="8" />
        <rect x="62" y="108" width="18" height="110" rx="8" />
      </g>
      {area('neck', <rect x="52" y="30" width="16" height="8" rx="3" />)}
      {area('shoulder', <><circle cx="38" cy="42" r="7" /><circle cx="82" cy="42" r="7" /></>)}
      {area('lowerBack', <rect x="44" y="84" width="32" height="18" rx="6" />)}
      {area('hip', <><circle cx="47" cy="112" r="7" /><circle cx="73" cy="112" r="7" /></>)}
      {area('sciatica', <rect x="42" y="120" width="5" height="62" rx="2.5" />)}
      {area('hamstring', <><rect x="49" y="124" width="8" height="34" rx="3" /><rect x="63" y="124" width="14" height="34" rx="4" /></>)}
      {area('knee', <><circle cx="49" cy="166" r="6" /><circle cx="71" cy="166" r="6" /></>)}
      {area('calf', <><rect x="43" y="176" width="12" height="30" rx="5" /><rect x="65" y="176" width="12" height="30" rx="5" /></>)}
    </svg>
  );
}

export function BackFeetWhere({ a, set, tried }: PageProps) {
  const areas = a.painAreas;
  const toggle = (x: PainArea) => {
    const now = areas ?? [];
    set({ painAreas: now.includes(x) ? now.filter(y => y !== x) : [...now, x] });
  };
  return (
    <>
      <BodyPicture chosen={areas ?? []} onToggle={toggle} />
      <Group>
        <CheckRows label="Where does it hurt?" options={AREAS} value={areas ?? []} onChange={painAreas => set({ painAreas })} />
      </Group>
      <Group>
        <CheckRows label="None of these right now" options={[{ value: 'none', label: 'None of these right now' }]}
          value={areas !== undefined && areas.length === 0 ? ['none'] : []} onChange={v => set({ painAreas: v.length > 0 ? [] : undefined })} />
      </Group>
      <Missing show={tried && areas === undefined}>Tick where it hurts, or “None of these right now”.</Missing>
    </>
  );
}

export function BackFeetSide({ a, set, tried }: PageProps) {
  const sciatica = (a.painAreas ?? []).includes('sciatica');
  return (
    <>
      {sciatica && (
        <Ask label="Which leg?" header="Which leg?" tried={tried} value={a.sciaticaSide} onChange={sciaticaSide => set({ sciaticaSide })}
          options={[{ value: 'left', label: 'Left leg' }, { value: 'right', label: 'Right leg' }, { value: 'both', label: 'Both legs' }]} />
      )}
      {sciatica && a.sciaticaSide === 'both' && (
        <p role="alert" className="rounded-xl bg-stop/10 p-4 text-[length:var(--text-body)] leading-snug">
          Sciatica in both legs should be checked by a doctor promptly. If it came on suddenly, or comes with numbness around the groin or bladder or bowel changes, get emergency care.
        </p>
      )}
      <Ask label="What makes it worse?" header="What makes it worse?" tried={tried} value={a.worseWith} onChange={worseWith => set({ worseWith })}
        options={[{ value: 'flexion', label: 'Sitting or bending forward' }, { value: 'extension', label: 'Standing, walking or arching back' }, { value: 'unknown', label: 'Not sure' }]}
        footer="This sets which back stretches you start with. The app keeps learning from your check-ins." />
      <Group header="What helps? (optional)">
        <CheckRows label="What helps? (optional)" value={a.helps ?? []} onChange={helps => set({ helps })}
          options={[
            { value: 'moving', label: 'Moving about' }, { value: 'lying', label: 'Lying down' }, { value: 'heat', label: 'Heat' },
            { value: 'bendingForward', label: 'Bending forward' }, { value: 'archingBack', label: 'Arching back' },
          ]} />
      </Group>
    </>
  );
}

export function BackFeetHistory({ a, set, tried, mode }: PageProps) {
  const f = factsOf(a);
  return (
    <>
      {/* With pain now, a history kept, or Your back and feet opened in Me: a past nerve injury is history, not pain (H5-19). */}
      {(f.pain || a.neuroHistory !== undefined || mode === 'edit') && (
        <Ask label="Has a doctor ever said a nerve in your back or leg was damaged?" header="Has a doctor ever said a nerve in your back or leg was damaged?"
          options={TRI} value={a.neuroHistory} onChange={neuroHistory => set({ neuroHistory })} tried={tried} footer="For example, foot drop after sciatica." />
      )}
      {(f.feet || f.footLimit) && (
        <Ask label="Has a clinician told you to keep weight off a foot?" header="Has a clinician told you to keep weight off a foot?" options={TRI}
          value={a.footRestriction} onChange={footRestriction => set({ footRestriction })} tried={tried}
          footer="Yes, or “Not sure”, keeps walks off until they say it’s fine." />
      )}
    </>
  );
}
