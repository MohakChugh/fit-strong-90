import { Navigate, Route, Routes, useSearchParams } from 'react-router-dom';
import { ChapterEditor } from '@/screens/setup/ChapterEditor';
import { ProfileHealthScreen } from '@/screens/setup/ProfileHealthScreen';
import { useSetupSession } from '@/setup/draft';
import { setupStateOf } from '@/setup/state';
import { useStore } from '@/store/useStore';
import { CHAPTER_IDS } from '@/types/setup';
import { DataScreen } from './DataScreen';
import { DisplayScreen } from './DisplayScreen';
import { FoodScreen } from './FoodScreen';
import { GoalsScreen } from './GoalsScreen';
import { HabitsScreen } from './HabitsScreen';
import { MeHome } from './MeHome';
import { VoiceScreen } from './VoiceScreen';

/**
 * `/me/profile`, Profile & health (journey §16): the chapters' answers, and
 * `?chapter=…` for a chapter's own pages (§19.2). While setup is unfinished,
 * it is setup itself, carrying on where it stopped (L-20, board D80).
 */
function Profile() {
  const [params] = useSearchParams();
  const { settings, profile } = useStore();
  const session = useSetupSession();
  if (!profile || session.entered || setupStateOf(settings, profile).stage !== 'done') return <Navigate to="/setup" replace />;
  const chapter = params.get('chapter');
  const known = CHAPTER_IDS.find(c => c === chapter && c !== 'welcome');
  return known ? <ChapterEditor key={known} chapter={known} /> : <ProfileHealthScreen />;
}

/** Me, the fourth tab (journey §16): its root and its sections. */
export default function YouRoutes() {
  return (
    <Routes>
      <Route index element={<MeHome />} />
      <Route path="profile" element={<Profile />} />
      <Route path="goals" element={<GoalsScreen />} />
      <Route path="food" element={<FoodScreen />} />
      <Route path="reminders" element={<HabitsScreen />} />
      <Route path="voice" element={<VoiceScreen />} />
      <Route path="display" element={<DisplayScreen />} />
      <Route path="data" element={<DataScreen />} />
      <Route path="*" element={<Navigate to="/me" replace />} />
    </Routes>
  );
}
