import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppData } from '@/hooks/useLocalStorage';
import { useTheme } from '@/hooks/useTheme';
import { exportData, importData, resetData } from '@/services/storage';
import { todayString } from '@/lib/utils';
import { createDefaultProfile } from '@/profile/defaults';
import { packName } from '@/voice/packs';
import type { VoiceSettings } from '@/types/profile';
import { VoiceSettingsCard } from '@/components/profile/VoiceSettingsCard';
import { ChipGroup } from '@/components/profile/ChipGroup';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from 'sonner';
import {
  SettingsIcon,
  PaletteIcon,
  DatabaseIcon,
  InfoIcon,
  DownloadIcon,
  UploadIcon,
  TrashIcon,
  AlertTriangleIcon,
  FlameIcon,
  HeartPulseIcon,
  ChevronRightIcon,
} from 'lucide-react';

export default function SettingsPage() {
  const [data, update] = useAppData();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const voice = (data.profile ?? createDefaultProfile()).voice;

  // Voice settings live on the profile; a legacy user without one gets a default
  // profile that still asks for the health review on Today.
  const handleVoiceChange = (patch: Partial<VoiceSettings>) => {
    update(prev => {
      const profile = prev.profile ?? createDefaultProfile({ weightKg: prev.settings.currentWeight || 0, needsHealthReview: true });
      return { ...prev, profile: { ...profile, voice: { ...profile.voice, ...patch } } };
    });
    if (patch.pack) toast.success(`Coach voice: ${packName(patch.pack)}`);
  };

  const handleStartDateChange = (value: string) => {
    update(prev => ({
      ...prev,
      settings: { ...prev.settings, startDate: value },
    }));
    toast.success('Start date updated');
  };

  const handleCurrentWeightChange = (value: string) => {
    const weight = parseFloat(value);
    if (!isNaN(weight)) {
      update(prev => ({
        ...prev,
        settings: { ...prev.settings, currentWeight: weight },
      }));
      toast.success('Weight updated');
    }
  };

  const handleTargetGoalChange = (value: string) => {
    update(prev => ({
      ...prev,
      settings: { ...prev.settings, targetGoal: value },
    }));
    toast.success('Goal updated');
  };

  const handleRestTimerChange = (value: number | readonly number[]) => {
    const seconds = Array.isArray(value) ? value[0] : value;
    if (typeof seconds === 'number') {
      update(prev => ({
        ...prev,
        settings: { ...prev.settings, defaultRestSeconds: seconds },
      }));
    }
  };

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme);
    update(prev => ({
      ...prev,
      settings: { ...prev.settings, theme: newTheme },
    }));
    toast.success('Theme updated');
  };

  const handleMetricToggle = (checked: boolean) => {
    update(prev => ({
      ...prev,
      settings: { ...prev.settings, useMetric: checked },
    }));
    toast.success(checked ? 'Using metric units' : 'Using imperial units');
  };

  const handleExport = () => {
    setExportDialogOpen(false);
    try {
      const json = exportData();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fitstrong90-backup-${todayString()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Data exported successfully');
    } catch (error) {
      toast.error('Failed to export data');
      console.error(error);
    }
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const success = importData(text);
        if (success) {
          // Reload data by forcing a page refresh
          window.location.reload();
        } else {
          toast.error('Invalid data format');
        }
      } catch (error) {
        toast.error('Failed to import data');
        console.error(error);
      }
    };
    input.click();
  };

  const handleReset = () => {
    resetData();
    toast.success('All data has been reset');
    navigate('/onboarding');
  };

  return (
    <div className="flex flex-col gap-6 pb-4 stagger-children">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your app preferences and data
        </p>
      </div>

      {/* Profile & health */}
      <Link to="/profile" viewTransition className="press-feedback">
        <Card className="flex flex-row items-center gap-3 p-4">
          <HeartPulseIcon className="size-5 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold">Profile & health</h2>
            <p className="text-sm text-muted-foreground">
              Training days, equipment, back and nerve symptoms, diabetes and blood pressure
            </p>
          </div>
          <ChevronRightIcon className="size-5 shrink-0 text-muted-foreground" />
        </Card>
      </Link>

      <VoiceSettingsCard voice={voice} onChange={handleVoiceChange} />

      <Card className="p-4">
        <ChipGroup label="Demo figure" hint="The body the 3D form demos use."
          options={[{ value: 'female', label: 'Female' }, { value: 'male', label: 'Male' }]}
          value={[data.profile?.figure ?? 'male']}
          onChange={([figure]) => update(prev => {
            const profile = prev.profile ?? createDefaultProfile({ weightKg: prev.settings.currentWeight || 0, needsHealthReview: true });
            return { ...prev, profile: { ...profile, figure: figure as 'male' | 'female' } };
          })} />
      </Card>

      {/* Program Settings */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <SettingsIcon className="size-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Program Settings</h2>
        </div>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="start-date">Program Start Date</Label>
            <Input
              id="start-date"
              type="date"
              value={data.settings.startDate}
              onChange={(e) => handleStartDateChange(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="current-weight">
              Current Weight ({data.settings.useMetric ? 'kg' : 'lbs'})
            </Label>
            <Input
              id="current-weight"
              type="number"
              step="0.1"
              value={data.settings.currentWeight}
              onChange={(e) => handleCurrentWeightChange(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="target-goal">Target Goal</Label>
            <Input
              id="target-goal"
              type="text"
              placeholder="e.g., Lose 5kg fat, build strength"
              value={data.settings.targetGoal}
              onChange={(e) => handleTargetGoalChange(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="rest-timer">
              Default Rest Timer: {data.settings.defaultRestSeconds}s
            </Label>
            <Slider
              id="rest-timer"
              min={30}
              max={300}
              step={15}
              value={[data.settings.defaultRestSeconds]}
              onValueChange={handleRestTimerChange}
            />
            <span className="text-sm text-muted-foreground">
              Used when an exercise has no rest time of its own. The program sets
              longer rests for heavy compound lifts.
            </span>
          </div>
        </div>
      </Card>

      {/* Warmup & Cooldown Settings */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <FlameIcon className="size-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Warmup & Cooldown</h2>
        </div>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <Label htmlFor="warmup-toggle">Enable Warmup Routine</Label>
              <span className="text-sm text-muted-foreground">Stretching & light cardio before workout</span>
            </div>
            <Switch
              id="warmup-toggle"
              checked={data.settings.warmupEnabled ?? false}
              onCheckedChange={(checked) => {
                update(prev => ({
                  ...prev,
                  settings: { ...prev.settings, warmupEnabled: checked },
                }));
                toast.success(checked ? 'Warmup enabled' : 'Warmup disabled');
              }}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <Label htmlFor="cooldown-toggle">Enable Cooldown Routine</Label>
              <span className="text-sm text-muted-foreground">Stretching after workout</span>
            </div>
            <Switch
              id="cooldown-toggle"
              checked={data.settings.cooldownEnabled ?? false}
              onCheckedChange={(checked) => {
                update(prev => ({
                  ...prev,
                  settings: { ...prev.settings, cooldownEnabled: checked },
                }));
                toast.success(checked ? 'Cooldown enabled' : 'Cooldown disabled');
              }}
            />
          </div>
        </div>
      </Card>

      {/* Display Settings */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <PaletteIcon className="size-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Display Settings</h2>
        </div>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <Label>Theme</Label>
              <span className="text-sm text-muted-foreground">Choose your preferred color scheme</span>
            </div>
            <Select value={theme} onValueChange={(value) => handleThemeChange(value as typeof theme)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <Label htmlFor="metric-toggle">Use Metric Units</Label>
              <span className="text-sm text-muted-foreground">kg instead of lbs</span>
            </div>
            <Switch
              id="metric-toggle"
              checked={data.settings.useMetric}
              onCheckedChange={handleMetricToggle}
            />
          </div>
        </div>
      </Card>

      {/* Data Management */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <DatabaseIcon className="size-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Data Management</h2>
        </div>
        <div className="flex flex-col gap-3">
          <Button variant="outline" className="w-full justify-start" onClick={() => setExportDialogOpen(true)}>
            <DownloadIcon className="size-4" />
            Export Data
          </Button>

          <Button variant="outline" className="w-full justify-start" onClick={handleImport}>
            <UploadIcon className="size-4" />
            Import Data
          </Button>

          <Button
            variant="destructive"
            className="w-full justify-start"
            onClick={() => setResetDialogOpen(true)}
          >
            <TrashIcon className="size-4" />
            Reset All Data
          </Button>
        </div>
      </Card>

      {/* Disclaimer */}
      <Alert>
        <AlertTriangleIcon className="size-4" />
        <AlertTitle>Health Disclaimer</AlertTitle>
        <AlertDescription>
          <ul className="list-disc space-y-1 pl-4">
            <li>General information, not medical advice.</li>
            <li>Stop and get help for chest pain, faintness or severe breathlessness; the app can’t detect emergencies.</li>
            <li>The app never changes medication or insulin doses.</li>
            <li>Meters, CGMs and cuffs can be wrong (CGMs lag during exercise), so treat symptoms.</li>
            <li>Clinician-set targets replace the defaults (the profile has fields for them).</li>
          </ul>
        </AlertDescription>
      </Alert>

      {/* About */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <InfoIcon className="size-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">About</h2>
        </div>
        <div className="flex flex-col gap-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">App Name</span>
            <span className="font-medium">FitStrong 90</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Version</span>
            <span className="font-medium">1.0.0</span>
          </div>
          <p className="text-muted-foreground mt-2">
            Your 90-day fitness transformation program. Build strength, improve health, and track your progress.
          </p>
        </div>
      </Card>

      {/* Export warning: the file leaves the device unencrypted (spec §10.2) */}
      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export your data?</DialogTitle>
            <DialogDescription>
              The file holds your profile, your health answers (back and nerve symptoms,
              diabetes, blood pressure), every daily check-in and every session.
              It is plain, unencrypted JSON, so keep it somewhere you trust and
              think twice before sharing it or putting it in cloud storage.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExportDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleExport}>
              <DownloadIcon className="size-4" />
              Download
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Confirmation Dialog */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset All Data?</DialogTitle>
            <DialogDescription>
              This permanently deletes everything this app stores on the device: your
              profile and health answers, check-ins, workout history, body metrics,
              personal records and any session still in progress. It cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleReset}>
              Reset Everything
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
