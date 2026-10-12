import { Screen } from '@/components/hig/Screen';
import { FURTHER_READING, SOURCES } from '@/content';
import { FurtherReadingGroup, Lead, SourceList } from './parts';

const asCited = (kind: (k: string) => boolean) =>
  SOURCES.filter(s => kind(s.kind)).map(source => ({ source, locators: [source.locator] }));

/** Every document the Guide cites: who wrote it, for whom, and where in it. */
export default function SourcesScreen() {
  return (
    <Screen title="Sources" back={{ to: '/guide', label: 'Guide' }}>
      <Lead>Every fact in Guide comes from one of these. Each answer lists the exact sections it relies on.</Lead>
      <SourceList header="Guidelines, fact sheets and labels" cited={asCited(k => k !== 'study')} audience />
      <SourceList header="Studies" cited={asCited(k => k === 'study')} audience />
      <FurtherReadingGroup ids={FURTHER_READING.map(f => f.id)} />
    </Screen>
  );
}
