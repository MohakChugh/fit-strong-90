import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRightIcon } from 'lucide-react';
import { Group } from '@/components/hig/List';
import {
  DISCLAIMER, getReading, isForYou, reviewedOn, sourcesFor,
  type CitedSource, type GuideContext, type InAppAction, type ShownClaim,
} from '@/content';
import { cn } from '@/lib/utils';
import { longDate, SOURCE_LINK_NOTE } from './format';

/**
 * Marks a claim that is about this person. Words, not colour alone, and in
 * the text's own colour: the tint is for things you can tap (D12, scan S-23).
 */
function ForYou() {
  return <span className="mr-1.5 font-semibold">For you ·</span>;
}

/**
 * One claim, as written, with the cautions that travel with it beneath. An
 * urgent one says "Get help:" in the stop ink, a caution "Caution:" in the
 * caution ink; words carry the meaning, not colour alone. Claims are full
 * sentences, so they wrap; a list row would truncate them.
 */
export function ClaimText({ shown, ctx, className }: { shown: ShownClaim; ctx: GuideContext; className?: string }) {
  const { claim, attached } = shown;
  return (
    <div className={className}>
      <p>
        {isForYou(claim, ctx) && <ForYou />}
        {claim.statement}
      </p>
      {attached.map(c => (
        <p
          key={c.id}
          className={cn('mt-1.5 text-[length:var(--text-subhead)] leading-snug', c.urgency ? 'text-stop' : 'text-caution')}
        >
          <span className="font-semibold">{c.urgency ? 'Get help: ' : 'Caution: '}</span>
          {isForYou(c, ctx) && <ForYou />}
          {c.statement}
        </p>
      ))}
    </div>
  );
}

/** A grouped list of claims: "What you can do", "Good to know"… */
export function ClaimGroup({ header, claims, ctx, footer }: { header?: string; claims: ShownClaim[]; ctx: GuideContext; footer?: ReactNode }) {
  if (claims.length === 0) return null;
  return (
    <Group header={header} footer={footer}>
      {claims.map(s => (
        <ClaimText key={s.claim.id} shown={s} ctx={ctx} className="px-4 py-3 text-[length:var(--text-body)] leading-snug" />
      ))}
    </Group>
  );
}

/**
 * A tappable row that opens a page outside the app, in a new tab. Like a
 * `Row`, it lays itself out by its own width: long names ("Exercise/Physical
 * Activity") wrap clear of the arrow, and a narrow row halves its padding.
 */
function ExternalRow({ href, title, lines }: { href: string; title: string; lines: string[] }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="@container press-feedback block transition-colors active:bg-muted/60"
    >
      <span className="flex min-h-11 items-start gap-3 px-4 py-3 @max-[16rem]:gap-2 @max-[16rem]:px-2">
        <span className="min-w-0 flex-1">
          <span className="block text-[length:var(--text-body)] leading-snug [overflow-wrap:break-word]">{title}</span>
          {lines.filter(Boolean).map(line => (
            <span key={line} className="block text-[length:var(--text-subhead)] leading-snug text-muted-foreground [overflow-wrap:break-word]">{line}</span>
          ))}
        </span>
        <ArrowUpRightIcon className="mt-0.5 size-5 shrink-0 text-tint" aria-hidden />
      </span>
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}

/**
 * The sources behind the claims on a screen, each once, with the exact places
 * those claims rely on. The original opens on a tap, with nothing about the
 * person in the address.
 */
export function SourcesGroup({ claimIds }: { claimIds: readonly string[] }) {
  return <SourceList header="Sources" cited={sourcesFor(claimIds)} />;
}

/** Sources as rows, with the attribution any of their licences asks for. */
export function SourceList({ header, cited, audience }: {
  header: string;
  cited: CitedSource[];
  /** Also say who and where the source is written for. */
  audience?: boolean;
}) {
  if (cited.length === 0) return null;
  const licences = [...new Set(cited.flatMap(c => (c.source.licence ? [c.source.licence] : [])))];
  return (
    <Group
      header={header}
      footer={[SOURCE_LINK_NOTE, ...licences].join(' ')}
    >
      {cited.map(({ source, locators }) => (
        <ExternalRow
          key={source.id}
          href={source.url}
          title={source.title}
          lines={[
            `${source.organisation} · ${source.edition}`,
            locators.join('; '),
            audience ? `Written for: ${source.population} (${source.jurisdiction})` : '',
          ]}
        />
      ))}
    </Group>
  );
}

/** Pages worth reading that are not the basis of anything shown here. */
export function FurtherReadingGroup({ ids }: { ids: readonly string[] }) {
  const readings = ids.flatMap(id => getReading(id) ?? []);
  if (readings.length === 0) return null;
  return (
    <Group header="Further reading" footer="We did not write these pages and do not rely on them for anything above.">
      {readings.map(r => <ExternalRow key={r.id} href={r.url} title={r.title} lines={[r.organisation, r.note]} />)}
    </Group>
  );
}

/** "General information, not medical advice." — beside the guidance itself. */
export function Disclaimer({ className }: { className?: string }) {
  return <p className={cn('text-[length:var(--text-footnote)] leading-snug text-muted-foreground', className)}>{DISCLAIMER}</p>;
}

/** When the claims on a screen were last checked against their sources. */
export function Reviewed({ claimIds }: { claimIds: readonly string[] }) {
  const date = reviewedOn(claimIds);
  if (!date) return null;
  return (
    <p className="px-4 text-[length:var(--text-footnote)] leading-snug text-muted-foreground">
      Checked against its sources on {longDate(date)}. {DISCLAIMER}
    </p>
  );
}

/** The one primary action a card may hand off to. */
export function ActionLink({ action }: { action: InAppAction }) {
  return (
    <Link
      to={action.to}
      viewTransition
      className="press-feedback flex min-h-[3.125rem] items-center justify-center rounded-xl bg-tint px-4 text-[length:var(--text-body)] font-semibold text-on-tint"
    >
      {action.label}
    </Link>
  );
}

/** A short paragraph under the title, in the subdued supporting style. */
export function Lead({ children }: { children: ReactNode }) {
  return <p className="-mt-2 px-1 text-[length:var(--text-subhead)] leading-snug text-muted-foreground">{children}</p>;
}
