import { useEffect, useRef } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { AppearanceScreen } from './AppearanceScreen';
import { DataScreen } from './DataScreen';
import { FocusScreen } from './FocusScreen';
import { FoodScreen } from './FoodScreen';
import { HabitsScreen } from './HabitsScreen';
import { earliest, historyIndex, leaveDelta } from './leave';
import { ProfileScreen } from './ProfileScreen';
import { VoiceScreen } from './VoiceScreen';
import { YouHome } from './YouHome';

/**
 * `/me/profile`. Its movement chapter (`?chapter=movement`, journey §19.2) is
 * v1's "What you'd like more of" until Plan 4 gives Me its chapters.
 */
function Profile() {
  const [params] = useSearchParams();
  return params.get('chapter') === 'movement' ? <FocusScreen /> : <ProfileScreen />;
}

/**
 * Me, the fourth tab: v1 You's screens, under Me's own names (`reminders`,
 * `display`), until Plan 4 rebuilds them. This component stays mounted while
 * the person moves between Me's screens, which is what lets "Done" find the
 * screen Me was opened from.
 */
export default function YouRoutes() {
  const navigate = useNavigate();
  const { key } = useLocation();
  const entry = useRef<number | undefined>(undefined);

  useEffect(() => {
    entry.current = earliest(entry.current, historyIndex());
  }, [key]);

  const done = () => {
    const delta = leaveDelta(entry.current, historyIndex());
    if (delta === undefined) navigate('/home', { replace: true, viewTransition: true });
    else navigate(delta);
  };

  return (
    <Routes>
      <Route index element={<YouHome onDone={done} />} />
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
