import { useState } from 'react';
import { useAppData } from '@/hooks/useLocalStorage';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { importData } from '@/services/storage';
import { ProfileWizard, type WizardResult } from '@/components/profile/ProfileWizard';
import { DumbbellIcon, UploadIcon, ShieldCheckIcon } from 'lucide-react';
import { toast } from 'sonner';

export default function OnboardingPage() {
  const [, update] = useAppData();
  const [started, setStarted] = useState(false);

  const complete = (r: WizardResult) => {
    update(prev => ({
      ...prev,
      profile: r.profile,
      settings: {
        ...prev.settings,
        startDate: r.startDate,
        currentWeight: r.profile.weightKg,
        useMetric: r.useMetric,
        onboardingComplete: true,
      },
    }));
    // Full reload so App re-reads onboardingComplete from localStorage.
    window.location.replace('#/dashboard');
    window.location.reload();
  };

  const handleImportData = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = async e => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        if (importData(await file.text())) {
          toast.success('Data imported! Redirecting...');
          window.location.replace('#/dashboard');
          window.location.reload();
        } else {
          toast.error('Invalid data format');
        }
      } catch {
        toast.error('Failed to import data');
      }
    };
    input.click();
  };

  if (started) return <ProfileWizard mode="onboarding" onComplete={complete} onCancel={() => setStarted(false)} />;

  return (
    <div className="min-h-dvh flex items-center justify-center bg-background p-4 pt-safe pb-safe">
      <Card className="w-full max-w-lg p-5 sm:p-8 animate-scale-in">
        <div className="flex flex-col items-center text-center gap-5">
          <div className="size-16 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center">
            <DumbbellIcon className="size-8" />
          </div>
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold tracking-tight">FitStrong 90</h1>
            <p className="text-base text-muted-foreground">
              One button, one guided hour: stretch, lift and cardio, coached by voice and built around your body.
            </p>
          </div>
          <ul className="w-full flex flex-col gap-2 text-left text-sm">
            {[
              ['Back- and sciatica-safe', 'Exercises and stretches adapt to how your back feels each morning.'],
              ['Glucose- and blood-pressure-aware', 'Safety checks are built into every session.'],
              ['Voice-guided', 'Put in your earphones; every step is explained and timed for you.'],
            ].map(([t, d]) => (
              <li key={t} className="flex gap-3 rounded-xl bg-muted/50 p-3">
                <ShieldCheckIcon className="size-5 shrink-0 text-[var(--block-mobility)]" />
                <span><span className="font-semibold">{t}.</span> {d}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            General information, not medical advice. Check with your clinician before starting, especially if you have diabetes, heart, kidney or eye disease.
          </p>
          <Button className="w-full h-14 text-base" onClick={() => setStarted(true)}>Get started</Button>
          <Button variant="outline" className="w-full h-12 text-base" onClick={handleImportData}>
            <UploadIcon /> Import existing data
          </Button>
        </div>
      </Card>
    </div>
  );
}
