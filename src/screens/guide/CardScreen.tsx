import { Link, Navigate, useLocation, useParams } from 'react-router-dom';
import { Group, Row } from '@/components/hig/List';
import { Screen } from '@/components/hig/Screen';
import {
  cardBlocks, getCard, getTopic, idsShown, isCardVisible, relatedCards, type CardBlock, type GuidanceCard,
} from '@/content';
import { ActionLink, ClaimGroup, ClaimText, Disclaimer, FurtherReadingGroup, Lead, Reviewed, SourcesGroup } from './parts';
import { useGuide } from './useGuide';

/** Headers for the sections of a card, in the order `cardBlocks` gives them. */
const HEADER: Partial<Record<CardBlock['kind'], string>> = {
  emergency: 'Get help now',
  soon: 'Don’t wait for a routine visit',
  notes: 'Good to know',
  actions: 'What you can do',
  cautions: 'When to check with your doctor',
};

/**
 * One answer, in the order `cardBlocks` gives: on a card that invites movement
 * the red flags lead, before the answer; otherwise the answer comes first and
 * large, then anything that needs help without waiting. Then what to do, when
 * to check with a doctor, and the sources behind every sentence shown.
 */
export default function CardScreen() {
  const { cardId = '' } = useParams();
  const { state } = useLocation();
  const { ctx } = useGuide();
  const card = getCard(cardId);
  // A card the person's answers hide (generic water advice with a fluid
  // limit) is not reachable by address either.
  if (!card || !isCardVisible(card, ctx)) return <Navigate to="/guide" replace />;

  const home = getTopic(card.topics[0])!;
  const back = (state as { from?: string } | null)?.from === 'search'
    ? { to: '/guide', label: 'Guide' }
    : { to: `/guide/topic/${home.id}`, label: home.title };
  const blocks = cardBlocks(card, ctx);
  // Sources and the review date cover exactly what this person sees.
  const shown = idsShown(blocks.flatMap(b => ('claims' in b ? [b.claims] : [])));

  return (
    <Screen title={card.title} back={back}>
      <Lead>{card.question}</Lead>
      {blocks.map(block => {
        if (block.kind === 'answer') {
          return (
            <section key="answer" aria-label="Answer" className="flex flex-col gap-3 px-1">
              {block.claims.map(s => (
                <ClaimText key={s.claim.id} shown={s} ctx={ctx} className="text-[length:var(--text-title-2)] leading-snug" />
              ))}
              <Disclaimer />
            </section>
          );
        }
        if (block.kind === 'action') return <ActionLink key="action" action={block.action} />;
        return <ClaimGroup key={block.kind} header={HEADER[block.kind]} claims={block.claims} ctx={ctx} />;
      })}
      <SourcesGroup claimIds={shown} />
      <FurtherReadingGroup ids={card.furtherReading ?? []} />
      <RelatedGroup cards={relatedCards(card, ctx)} from={card} />
      <Reviewed claimIds={shown} />
    </Screen>
  );
}

/**
 * Answers worth reading next. Each names this card as its opener, so its Back
 * returns here — not to the related card's own topic, which the person may
 * never have opened (scan S-11).
 */
function RelatedGroup({ cards, from }: { cards: GuidanceCard[]; from: GuidanceCard }) {
  if (cards.length === 0) return null;
  return (
    <Group header="Related">
      {cards.map(c => (
        <Row key={c.id} as={Link} to={`/guide/card/${c.id}`} state={{ path: `/guide/card/${from.id}`, label: from.title }} viewTransition label={c.title} detail={c.question} chevron />
      ))}
    </Group>
  );
}
