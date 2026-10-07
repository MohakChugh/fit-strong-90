import { useNavigate } from 'react-router-dom';
import { useAppData } from '@/hooks/useLocalStorage';
import { ProfileWizard } from '@/components/profile/ProfileWizard';
import { createDefaultProfile } from '@/profile/defaults';
import { toast } from 'sonner';

/** Edit the profile and health answers (same three screens as onboarding). */
export default function ProfilePage() {
  const [data, update] = useAppData();
  const navigate = useNavigate();
  return (
    <ProfileWizard
      mode="edit"
      initial={{
        profile: data.profile ?? createDefaultProfile({ weightKg: data.settings.currentWeight || 0 }),
        startDate: data.settings.startDate,
        useMetric: data.settings.useMetric,
      }}
      onCancel={() => navigate(-1)}
      onComplete={r => {
        update(prev => ({
          ...prev,
          profile: r.profile,
          settings: { ...prev.settings, currentWeight: r.profile.weightKg, useMetric: r.useMetric },
        }));
        toast.success('Profile saved. Today’s plan has been rebuilt.');
        navigate('/dashboard', { viewTransition: true });
      }}
    />
  );
}
