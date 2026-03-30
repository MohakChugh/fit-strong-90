import { useState } from 'react';
import { useAppData } from '@/hooks/useLocalStorage';
import { useTheme } from '@/hooks/useTheme';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn, formatDateFull, getWeekNumber, getPhaseForWeek } from '@/lib/utils';
import { PHASES } from '@/data/program';
import { DumbbellIcon, CheckCircleIcon, InfoIcon } from 'lucide-react';

export default function OnboardingPage() {
  const [, update] = useAppData();
  const { theme, setTheme } = useTheme();
  const [step, setStep] = useState(1);

  // Form state
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [currentWeight, setCurrentWeight] = useState('');
  const [targetGoal, setTargetGoal] = useState('');
  const [useMetric, setUseMetric] = useState(true);
  const [defaultRestSeconds, setDefaultRestSeconds] = useState(90);
  const [selectedTheme, setSelectedTheme] = useState<'light' | 'dark' | 'system'>(theme);

  const totalSteps = 4;
  const progress = (step / totalSteps) * 100;

  const handleNext = () => {
    if (step < totalSteps) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleComplete = () => {
    // Save all settings
    update(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        startDate,
        currentWeight: parseFloat(currentWeight) || 0,
        targetGoal,
        defaultRestSeconds,
        useMetric,
        theme: selectedTheme,
        onboardingComplete: true,
      },
    }));

    // Apply theme
    setTheme(selectedTheme);

    // Full reload so App re-reads onboardingComplete from localStorage
    window.location.replace('#/dashboard');
    window.location.reload();
  };

  const canProceedStep2 = startDate && currentWeight && parseFloat(currentWeight) > 0;

  const weekNumber = getWeekNumber(startDate, new Date().toISOString().split('T')[0]);
  const currentPhase = getPhaseForWeek(weekNumber);
  const phaseInfo = PHASES.find(p => p.phase === currentPhase);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-lg">
        {/* Progress Bar */}
        <div className="mb-6">
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between mt-2">
            {[1, 2, 3, 4].map(num => (
              <div
                key={num}
                className={cn(
                  'size-8 rounded-full flex items-center justify-center text-xs font-medium transition-colors',
                  step >= num
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {num}
              </div>
            ))}
          </div>
        </div>

        {/* Step 1: Welcome */}
        {step === 1 && (
          <Card className="p-4 sm:p-6">
            <div className="flex flex-col items-center text-center gap-6">
              <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center">
                <DumbbellIcon className="size-8 text-primary" />
              </div>
              <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold">Welcome to FitStrong 90</h1>
                <p className="text-lg text-muted-foreground">
                  Your 90-day fitness transformation starts here
                </p>
              </div>

              <Alert>
                <InfoIcon className="size-4" />
                <AlertDescription className="text-left">
                  This app is for general fitness tracking only, not medical advice. Please consult your
                  doctor for diabetes management and any health concerns.
                </AlertDescription>
              </Alert>

              <Button size="lg" className="w-full h-12" onClick={handleNext}>
                Get Started
              </Button>
            </div>
          </Card>
        )}

        {/* Step 2: Basic Info */}
        {step === 2 && (
          <Card className="p-4 sm:p-6">
            <div className="flex flex-col gap-6">
              <div>
                <h2 className="text-2xl font-bold mb-2">Basic Information</h2>
                <p className="text-sm text-muted-foreground">
                  Let's set up your fitness profile
                </p>
              </div>

              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="start-date">Program Start Date</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="h-11"
                  />
                  <span className="text-xs text-muted-foreground">
                    Choose today or a future date to begin
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex flex-col gap-2 flex-1">
                    <Label htmlFor="weight">Current Weight</Label>
                    <Input
                      id="weight"
                      type="number"
                      inputMode="numeric"
                      step="0.1"
                      placeholder="70"
                      value={currentWeight}
                      onChange={(e) => setCurrentWeight(e.target.value)}
                      className="h-11"
                    />
                  </div>
                  <div className="flex flex-col gap-2 w-24 mt-6">
                    <Select value={useMetric ? 'kg' : 'lbs'} onValueChange={(v) => setUseMetric(v === 'kg')}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="kg">kg</SelectItem>
                        <SelectItem value="lbs">lbs</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="goal">Target Goal</Label>
                  <Input
                    id="goal"
                    type="text"
                    placeholder="e.g., Lose 5kg fat, build strength"
                    value={targetGoal}
                    onChange={(e) => setTargetGoal(e.target.value)}
                    className="h-11"
                  />
                  <span className="text-xs text-muted-foreground">
                    What do you want to achieve? (optional)
                  </span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={handleBack}>
                  Back
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleNext}
                  disabled={!canProceedStep2}
                >
                  Next
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Step 3: Preferences */}
        {step === 3 && (
          <Card className="p-4 sm:p-6">
            <div className="flex flex-col gap-6">
              <div>
                <h2 className="text-2xl font-bold mb-2">Preferences</h2>
                <p className="text-sm text-muted-foreground">
                  Customize your workout experience
                </p>
              </div>

              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="rest-timer">
                    Default Rest Timer: {defaultRestSeconds}s
                  </Label>
                  <Slider
                    id="rest-timer"
                    min={30}
                    max={180}
                    step={15}
                    value={[defaultRestSeconds]}
                    onValueChange={(values) => {
                      const val = Array.isArray(values) ? values[0] : values;
                      setDefaultRestSeconds(val);
                    }}
                  />
                  <span className="text-xs text-muted-foreground">
                    Time between sets (can be adjusted per exercise)
                  </span>
                </div>

                <div className="flex flex-col gap-2">
                  <Label>Theme Preference</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      variant={selectedTheme === 'light' ? 'default' : 'outline'}
                      onClick={() => setSelectedTheme('light')}
                    >
                      Light
                    </Button>
                    <Button
                      variant={selectedTheme === 'dark' ? 'default' : 'outline'}
                      onClick={() => setSelectedTheme('dark')}
                    >
                      Dark
                    </Button>
                    <Button
                      variant={selectedTheme === 'system' ? 'default' : 'outline'}
                      onClick={() => setSelectedTheme('system')}
                    >
                      System
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={handleBack}>
                  Back
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleNext}
                >
                  Next
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Step 4: Ready */}
        {step === 4 && (
          <Card className="p-4 sm:p-6">
            <div className="flex flex-col items-center text-center gap-6">
              <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center">
                <CheckCircleIcon className="size-8 text-primary" />
              </div>

              <div className="flex flex-col gap-2">
                <h2 className="text-2xl font-bold">You're All Set!</h2>
                <p className="text-muted-foreground">
                  Here's a summary of your program
                </p>
              </div>

              <div className="w-full flex flex-col gap-3 text-left">
                <Card className="p-3 bg-muted/50">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Start Date</span>
                    <span className="font-medium">{formatDateFull(startDate)}</span>
                  </div>
                </Card>

                <Card className="p-3 bg-muted/50">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Current Weight</span>
                    <span className="font-medium">
                      {currentWeight} {useMetric ? 'kg' : 'lbs'}
                    </span>
                  </div>
                </Card>

                {targetGoal && (
                  <Card className="p-3 bg-muted/50">
                    <div className="flex flex-col gap-1">
                      <span className="text-sm text-muted-foreground">Goal</span>
                      <span className="font-medium">{targetGoal}</span>
                    </div>
                  </Card>
                )}

                <Card className="p-3 bg-muted/50">
                  <div className="flex flex-col gap-1">
                    <span className="text-sm text-muted-foreground">Starting Phase</span>
                    <span className="font-medium">
                      Week {weekNumber}: {phaseInfo?.name}
                    </span>
                    <span className="text-xs text-muted-foreground mt-1">
                      {phaseInfo?.description}
                    </span>
                  </div>
                </Card>
              </div>

              <div className="w-full flex flex-col gap-2">
                <Button size="lg" className="w-full h-12" onClick={handleComplete}>
                  Begin Your Journey
                </Button>
                <Button variant="ghost" size="sm" onClick={handleBack}>
                  Go Back
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
