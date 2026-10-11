import { Group, Row } from '@/components/hig/List';
import { Screen } from '@/components/hig/Screen';
import { FURTHER_READING, SOURCES } from '@/content';
import { ATTRIBUTION } from '@/walk/tiles';
import { ExternalRow, FurtherReadingGroup, Lead, SourceList } from './parts';

/**
 * What the app is built from besides its sources, each under its own licence
 * (kiro KH-17): only what this repository confirms (scripts/character,
 * scripts/voice, the map's attribution).
 */
const LICENCES: { title: string; lines: string[]; href?: string }[] = [
  { title: 'The coach figure', lines: ['Built from MakeHuman (MPFB2) assets', 'CC0 1.0'], href: 'https://github.com/makehumancommunity/mpfb2/blob/master/LICENSE.md' },
  { title: 'The coach’s voice', lines: ['Recorded with the Kokoro-82M speech model', 'Apache License 2.0'] },
  { title: 'Map pictures', lines: [ATTRIBUTION.text, 'Map data under the Open Database Licence (ODbL)'], href: ATTRIBUTION.href },
];

const asCited = (kind: (k: string) => boolean) =>
  SOURCES.filter(s => kind(s.kind)).map(source => ({ source, locators: [source.locator] }));

/** Every document the Guide cites: who wrote it, for whom, and where in it; then the licences of what the app is built from. */
export default function SourcesScreen() {
  return (
    <Screen title="Sources" back={{ to: '/hub/learn', label: 'Learn' }}>
      <Lead>Every fact in Learn comes from one of these. Each answer lists the exact sections it relies on.</Lead>
      <SourceList header="Guidelines, fact sheets and labels" cited={asCited(k => k !== 'study' && k !== 'dataset')} audience />
      <SourceList header="Studies" cited={asCited(k => k === 'study')} audience />
      <SourceList header="Food data" cited={asCited(k => k === 'dataset')} audience />
      <FurtherReadingGroup ids={FURTHER_READING.map(f => f.id)} />
      <Group header="Licences">
        {LICENCES.map(l => (l.href
          ? <ExternalRow key={l.title} href={l.href} title={l.title} lines={l.lines} />
          : <Row key={l.title} label={l.title} detail={l.lines.join(' · ')} />))}
      </Group>
    </Screen>
  );
}
