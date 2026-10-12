import { Link, Navigate, useParams } from 'react-router-dom';
import { UtensilsIcon } from 'lucide-react';
import { Group, Row } from '@/components/hig/List';
import { Screen } from '@/components/hig/Screen';
import { cardsForTopic, DISCLAIMER, getTopic, topicsFor, type TopicId } from '@/content';
import { Lead } from './parts';
import { useGuide } from './useGuide';

/** One topic: its answers as rows, and Meal ideas where food is the subject. */
export default function TopicScreen() {
  const { topicId = '' } = useParams();
  const { ctx } = useGuide();
  const topic = getTopic(topicId);
  if (!topic) return <Navigate to="/guide" replace />;

  const cards = cardsForTopic(topic.id as TopicId, ctx);
  const because = topicsFor(ctx).forYou.find(f => f.topic.id === topic.id)?.because;

  return (
    <Screen title={topic.title} back={{ to: '/guide', label: 'Guide' }}>
      <Lead>
        {because && <span className="font-semibold text-foreground">For you · {because}. </span>}
        {topic.summary}.
      </Lead>
      {topic.meals && (
        <Group>
          <Row
            as={Link}
            to="/guide/meals"
            viewTransition
            icon={<UtensilsIcon aria-hidden />}
            label="Meal ideas"
            detail="A sample week of Indian meals to adapt"
            chevron
          />
        </Group>
      )}
      <Group footer={DISCLAIMER}>
        {cards.map(card => (
          <Row key={card.id} as={Link} to={`/guide/card/${card.id}`} viewTransition label={card.title} detail={card.question} chevron />
        ))}
      </Group>
    </Screen>
  );
}
