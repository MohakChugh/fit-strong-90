import { Navigate, Route, Routes, useSearchParams } from 'react-router-dom';
import { AppearanceScreen } from './AppearanceScreen';
import { DataScreen } from './DataScreen';
import { FocusScreen } from './FocusScreen';
import { FoodScreen } from './FoodScreen';
import { HabitsScreen } from './HabitsScreen';
import { MeHome } from './MeHome';
import { ProfileScreen } from './ProfileScreen';
import { VoiceScreen } from './VoiceScreen';

/**
 * `/me/profile`, Profile & health: the seam Plan 5 replaces with the setup
 * chapters' own pages (journey §16). Until then v1's screens hold the
 * answers. The movement chapter (`?chapter=movement`, §19.2) is v1's "What
 * you'd like more of"; every other chapter is v1's Profile & health
 * (`HREF` in `src/setup/progress.ts`).
 */
function Profile() {
  const [params] = useSearchParams();
  return params.get('chapter') === 'movement' ? <FocusScreen /> : <ProfileScreen />;
}

/** Me, the fourth tab (journey §16): its root and its sections. */
export default function YouRoutes() {
  return (
    <Routes>
      <Route index element={<MeHome />} />
      <Route path="profile" element={<Profile />} />
      <Route path="food" element={<FoodScreen />} />
      <Route path="reminders" element={<HabitsScreen />} />
      <Route path="voice" element={<VoiceScreen />} />
      <Route path="display" element={<AppearanceScreen />} />
      <Route path="data" element={<DataScreen />} />
      <Route path="*" element={<Navigate to="/me" replace />} />
    </Routes>
  );
}
