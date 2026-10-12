import { useEffect, useRef } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
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
 * You: the person's own settings, opened from the person button on every
 * root screen. This component stays mounted while the person moves between
 * You's screens, which is what lets "Done" find the screen You was opened from.
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
    if (delta === undefined) navigate('/today', { replace: true, viewTransition: true });
    else navigate(delta);
  };

  return (
    <Routes>
      <Route index element={<YouHome onDone={done} />} />
      <Route path="profile" element={<ProfileScreen />} />
      <Route path="food" element={<FoodScreen />} />
      <Route path="focus" element={<FocusScreen />} />
      <Route path="habits" element={<HabitsScreen />} />
      <Route path="voice" element={<VoiceScreen />} />
      <Route path="appearance" element={<AppearanceScreen />} />
      <Route path="data" element={<DataScreen />} />
      <Route path="*" element={<Navigate to="/you" replace />} />
    </Routes>
  );
}
