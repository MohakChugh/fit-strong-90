import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAppData } from '@/hooks/useLocalStorage';
import { useTimer } from '@/hooks/useTimer';
import { useSupersetTimer } from '@/hooks/useSupersetTimer';
import {
  getDayOfWeekFromDate,
  getWeekNumber,
  getPhaseForWeek,
  generateId,
  formatWeight,
  formatDate,
  calculateVolume,
  detectPR,
  cn,
} from '@/lib/utils';
import {
  getDayPlan,
  getDayPlanByMuscleGroup,
  getTrainingDays,
  getActiveExercisesForPhase,
  getExerciseSetsAndReps,
  getPhaseInfo,
} from '@/data/program';
import { getExerciseById } from '@/data/exercises';
import type { WorkoutSession, SetStatus, MuscleGroup, WarmupCooldownEntry, WorkoutPhase, SupersetGroup } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Dumbbell,
  ExternalLink,
  PlayCircle,
  PauseCircle,
  CheckCircle2,
  Clock,
  Trophy,
  SkipForward,
  Timer,
  UndoIcon,
  ArrowLeftRight,
  Flame,
  Snowflake,
  Link2,
  Link2Off,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';

export default function WorkoutPage() {
  const [data, updateData] = useAppData();
  const { settings, sessions, personalRecords } = data;
  const [searchParams, setSearchParams] = useSearchParams();

  // Support ?date=YYYY-MM-DD and ?override=<muscleGroup>
  const actualToday = new Date().toISOString().split('T')[0];
  const workoutDate = searchParams.get('date') || actualToday;
  const overrideMuscle = searchParams.get('override') as MuscleGroup | null;
  const isPastWorkout = workoutDate !== actualToday;

  // Resolve the day plan: override muscle group or default for the date
  const dayOfWeek = getDayOfWeekFromDate(workoutDate);
  const defaultDayPlan = getDayPlan(dayOfWeek);
  const dayPlan = overrideMuscle
    ? getDayPlanByMuscleGroup(overrideMuscle) || defaultDayPlan
    : defaultDayPlan;
  const weekNumber = getWeekNumber(settings.startDate, workoutDate);
  const phase = getPhaseForWeek(weekNumber);
  const phaseInfo = getPhaseInfo(weekNumber);

  // Get active exercises
  const activeExercises = getActiveExercisesForPhase(dayPlan, phase);

  // State
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [showSummaryDialog, setShowSummaryDialog] = useState(false);
  const [showRedoDialog, setShowRedoDialog] = useState(false);
  const [showSwapDialog, setShowSwapDialog] = useState(false);
  const [activeExerciseId, setActiveExerciseId] = useState<string | null>(null);
  const [workoutNotes, setWorkoutNotes] = useState('');

  // Warmup/Cooldown state
  const [workoutPhase, setWorkoutPhase] = useState<WorkoutPhase>('main');
  const [warmupEntries, setWarmupEntries] = useState<WarmupCooldownEntry[]>([]);
  const [cooldownEntries, setCooldownEntries] = useState<WarmupCooldownEntry[]>([]);

  // Superset state
  const [supersetGroups, setSupersetGroups] = useState<SupersetGroup[]>([]);
  const [showSupersetDialog, setShowSupersetDialog] = useState(false);
  const [supersetSelection, setSupersetSelection] = useState<string[]>([]);
  const supersetTimer = useSupersetTimer();

  // Ref for stable access to activeExerciseId in handlers
  const activeExerciseIdRef = useRef(activeExerciseId);
  activeExerciseIdRef.current = activeExerciseId;

  // Rest timer
  const timer = useTimer(settings.defaultRestSeconds);
  const [showTimer, setShowTimer] = useState(false);

  // Check if target date is a rest day (only when no override)
  if (dayPlan.isRestDay && !overrideMuscle) {
    return <RestDayView />;
  }

  // Build a stable key for the current plan to detect when we need to create a new session
  const planKey = `${workoutDate}-${dayPlan.muscleGroup}`;

  // Initialize or restore session
  useEffect(() => {
    const existingSession = sessions.find(
      (s) => s.date === workoutDate && s.muscleGroup === dayPlan.muscleGroup
    );

    if (existingSession) {
      setSession(existingSession);
      setWorkoutNotes(existingSession.notes || '');
    } else {
      // Remove any old session for this date with a different muscle group (swap scenario)
      const oldSessionForDate = sessions.find((s) => s.date === workoutDate);
      if (oldSessionForDate) {
        updateData((prev) => ({
          ...prev,
          sessions: prev.sessions.filter((s) => s.date !== workoutDate),
        }));
      }

      const newSession: WorkoutSession = {
        id: generateId(),
        date: workoutDate,
        dayOfWeek: dayOfWeek,
        muscleGroup: dayPlan.muscleGroup,
        phase: phase,
        week: weekNumber,
        status: 'not_started',
        sets: [],
        startedAt: null,
        completedAt: null,
        notes: '',
        totalVolume: 0,
      };

      activeExercises.forEach((exercise) => {
        const { sets, reps } = getExerciseSetsAndReps(exercise, phase);
        for (let i = 1; i <= sets; i++) {
          newSession.sets.push({
            id: generateId(),
            exerciseId: exercise.exerciseId,
            setNumber: i,
            plannedReps: reps,
            actualReps: null,
            weight: null,
            status: 'pending',
            rpe: null,
          });
        }
      });

      setSession(newSession);
      setWorkoutNotes('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planKey]);

  // Initialize warmup/cooldown entries from session or defaults
  useEffect(() => {
    if (!session) return;
    if (session.warmup && session.warmup.length > 0) {
      setWarmupEntries(session.warmup);
    } else {
      const defaultIds = settings.defaultWarmupExercises ?? ['hip-opener-stretch', 'hamstring-stretch', 'treadmill-walk'];
      setWarmupEntries(defaultIds.map(id => ({ exerciseId: id, completed: false })));
    }
    if (session.cooldown && session.cooldown.length > 0) {
      setCooldownEntries(session.cooldown);
    } else {
      const defaultIds = settings.defaultCooldownExercises ?? ['thoracic-opener', 'breathing-cooldown'];
      setCooldownEntries(defaultIds.map(id => ({ exerciseId: id, completed: false })));
    }
    // Initialize superset groups
    if (session.supersetGroups && session.supersetGroups.length > 0) {
      setSupersetGroups(session.supersetGroups);
    } else {
      setSupersetGroups([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id]);

  // Helper: get superset group for an exercise
  const getSupersetForExercise = (exerciseId: string): SupersetGroup | undefined => {
    return supersetGroups.find(g => g.exerciseIds.includes(exerciseId));
  };

  // Create a superset from selected exercises
  const handleCreateSuperset = () => {
    if (supersetSelection.length < 2) {
      toast.error('Select at least 2 exercises for a superset');
      return;
    }
    const restSeconds = settings.supersetRestSeconds ?? 20;
    const newGroup: SupersetGroup = {
      id: generateId(),
      exerciseIds: supersetSelection,
      restBetweenSeconds: restSeconds,
      restAfterRoundSeconds: restSeconds * 2,
    };
    const updatedGroups = [...supersetGroups, newGroup];
    setSupersetGroups(updatedGroups);
    if (session) {
      const updatedSession = { ...session, supersetGroups: updatedGroups };
      setSession(updatedSession);
      saveSession(updatedSession);
    }
    setSupersetSelection([]);
    setShowSupersetDialog(false);
    toast.success('Superset created!');
  };

  // Remove a superset group
  const handleRemoveSuperset = (groupId: string) => {
    const updatedGroups = supersetGroups.filter(g => g.id !== groupId);
    setSupersetGroups(updatedGroups);
    if (session) {
      const updatedSession = { ...session, supersetGroups: updatedGroups };
      setSession(updatedSession);
      saveSession(updatedSession);
    }
    if (supersetTimer.activeGroup?.id === groupId) {
      supersetTimer.endSuperset();
    }
    toast.info('Superset removed');
  };

  // Save session to storage
  const saveSession = (updatedSession: WorkoutSession) => {
    updateData((prev) => ({
      ...prev,
      sessions: prev.sessions.some((s) => s.id === updatedSession.id)
        ? prev.sessions.map((s) => (s.id === updatedSession.id ? updatedSession : s))
        : [...prev.sessions, updatedSession],
    }));
  };

  // Start workout (may route through warmup first)
  const handleStartWorkout = () => {
    if (!session) return;
    const now = new Date().toISOString();
    const updatedSession = {
      ...session,
      status: 'in_progress' as const,
      startedAt: now,
    };
    setSession(updatedSession);
    saveSession(updatedSession);

    if (settings.warmupEnabled) {
      setWorkoutPhase('warmup');
      toast.success('Warmup started! Get your body ready.');
    } else {
      setWorkoutPhase('main');
      toast.success("Workout started! Let's do this!");
    }
  };

  // Complete warmup → transition to main workout
  const handleCompleteWarmup = () => {
    if (!session) return;
    const updatedSession = { ...session, warmup: warmupEntries };
    setSession(updatedSession);
    saveSession(updatedSession);
    setWorkoutPhase('main');
    toast.success("Warmup done! Let's lift!");
  };

  // Skip warmup
  const handleSkipWarmup = () => {
    setWorkoutPhase('main');
    toast.info('Warmup skipped');
  };

  // Complete cooldown → finish workout
  const handleCompleteCooldown = () => {
    finishWorkout();
  };

  // Skip cooldown
  const handleSkipCooldown = () => {
    setWorkoutPhase('main');
    finishWorkout();
  };

  // Complete set
  const handleSetComplete = (setId: string, exerciseId: string, checked: boolean) => {
    if (!session) return;
    const updatedSets = session.sets.map((set) =>
      set.id === setId
        ? { ...set, status: (checked ? 'completed' : 'pending') as SetStatus }
        : set
    );
    const updatedSession = { ...session, sets: updatedSets };
    setSession(updatedSession);
    saveSession(updatedSession);

    // Start rest timer using the exerciseId directly (avoids stale closure)
    if (checked) {
      const supersetGroup = getSupersetForExercise(exerciseId);
      if (supersetGroup && supersetTimer.isActive) {
        // Use superset timer — auto-advance to next exercise
        supersetTimer.completeSet();
      } else {
        const exercise = activeExercises.find((ex) => ex.exerciseId === exerciseId);
        if (exercise) {
          timer.reset(exercise.restSeconds);
          timer.start();
          setShowTimer(true);
        }
      }
    }
  };

  // Update set data
  const handleSetUpdate = (
    setId: string,
    field: 'actualReps' | 'weight' | 'rpe',
    value: number | null
  ) => {
    if (!session) return;
    const updatedSets = session.sets.map((set) =>
      set.id === setId ? { ...set, [field]: value } : set
    );
    const updatedSession = { ...session, sets: updatedSets };
    setSession(updatedSession);
    saveSession(updatedSession);
  };

  // Skip exercise
  const handleSkipExercise = (exerciseId: string) => {
    if (!session) return;
    const updatedSets = session.sets.map((set) =>
      set.exerciseId === exerciseId ? { ...set, status: 'skipped' as SetStatus } : set
    );
    const updatedSession = { ...session, sets: updatedSets };
    setSession(updatedSession);
    saveSession(updatedSession);
    toast.info('Exercise skipped');
  };

  // Complete workout (may route through cooldown first)
  const handleCompleteWorkout = () => {
    if (!session) return;

    if (settings.cooldownEnabled && workoutPhase === 'main') {
      setWorkoutPhase('cooldown');
      toast.info('Time for cooldown! Stretch it out.');
      return;
    }

    finishWorkout();
  };

  // Finalize the workout (called after cooldown or directly)
  const finishWorkout = () => {
    if (!session) return;

    const completedSets = session.sets.filter((s) => s.status === 'completed');
    const totalVolume = calculateVolume(completedSets);

    const newPRs: string[] = [];
    completedSets.forEach((set) => {
      if (set.weight !== null && set.actualReps !== null) {
        const isPR = detectPR(set.exerciseId, set.weight, set.actualReps, personalRecords);
        if (isPR) {
          const exercise = getExerciseById(set.exerciseId);
          if (exercise) {
            newPRs.push(exercise.name);
            updateData((prev) => {
              const existingPR = prev.personalRecords.find(
                (pr) => pr.exerciseId === set.exerciseId
              );
              const volume = set.weight! * set.actualReps!;
              const newPR = {
                exerciseId: set.exerciseId,
                weight: set.weight!,
                reps: set.actualReps!,
                date: workoutDate,
                volume,
              };
              return {
                ...prev,
                personalRecords: existingPR
                  ? prev.personalRecords.map((pr) =>
                      pr.exerciseId === set.exerciseId ? newPR : pr
                    )
                  : [...prev.personalRecords, newPR],
              };
            });
          }
        }
      }
    });

    const updatedSession: WorkoutSession = {
      ...session,
      status: 'completed',
      completedAt: new Date().toISOString(),
      notes: workoutNotes,
      totalVolume,
      warmup: warmupEntries.some(e => e.completed) ? warmupEntries : session.warmup,
      cooldown: cooldownEntries.some(e => e.completed) ? cooldownEntries : session.cooldown,
    };

    setSession(updatedSession);
    saveSession(updatedSession);
    setShowSummaryDialog(true);
    setWorkoutPhase('main');

    if (newPRs.length > 0) {
      toast.success(`New PR${newPRs.length > 1 ? 's' : ''}! ${newPRs.join(', ')}`, {
        icon: <Trophy className="h-4 w-4" />,
      });
    }
  };

  // Redo workout
  const handleRedoWorkout = () => {
    if (!session) return;
    const resetSession: WorkoutSession = {
      ...session,
      status: 'not_started',
      startedAt: null,
      completedAt: null,
      totalVolume: 0,
      notes: '',
      sets: session.sets.map((set) => ({
        ...set,
        status: 'pending' as const,
        actualReps: null,
        weight: null,
        rpe: null,
      })),
    };
    setSession(resetSession);
    saveSession(resetSession);
    setWorkoutNotes('');
    setShowRedoDialog(false);
    toast.success('Workout reset — start fresh!');
  };

  // Swap workout to a different muscle group
  const handleSwapWorkout = (muscleGroup: string) => {
    // Remove existing session for this date before swapping
    if (session) {
      updateData((prev) => ({
        ...prev,
        sessions: prev.sessions.filter((s) => s.id !== session.id),
      }));
    }

    const params = new URLSearchParams(searchParams);
    params.set('override', muscleGroup);
    if (workoutDate !== actualToday) {
      params.set('date', workoutDate);
    }
    setSearchParams(params, { replace: true });
    setSession(null);
    setShowSwapDialog(false);
    toast.success(`Switched to ${muscleGroup.charAt(0).toUpperCase() + muscleGroup.slice(1)} workout`);
  };

  if (!session) {
    return (
      <div className="container mx-auto px-4 py-6">
        <p>Loading workout...</p>
      </div>
    );
  }

  const completedSetsCount = session.sets.filter((s) => s.status === 'completed').length;
  const totalSets = session.sets.length;
  const progress = totalSets > 0 ? (completedSetsCount / totalSets) * 100 : 0;
  const isSwapped = overrideMuscle && overrideMuscle !== defaultDayPlan.muscleGroup;

  return (
    <div className="space-y-4 pb-4">
      <div className="space-y-4">
        {/* Banners */}
        <div className="space-y-2">
          {isPastWorkout && (
            <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 text-sm">
              <Clock className="h-4 w-4 text-amber-500 flex-shrink-0" />
              <span className="text-amber-700 dark:text-amber-400">
                Logging workout for <strong>{formatDate(workoutDate)}</strong>
              </span>
            </div>
          )}
          {isSwapped && (
            <div className="flex items-center gap-2 rounded-lg bg-blue-500/10 border border-blue-500/30 p-3 text-sm">
              <ArrowLeftRight className="h-4 w-4 text-blue-500 flex-shrink-0" />
              <span className="text-blue-700 dark:text-blue-400">
                Swapped from {defaultDayPlan.label} → <strong>{dayPlan.label}</strong>
              </span>
            </div>
          )}
        </div>

        {/* Header */}
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{dayPlan.label}</h1>
              <p className="text-muted-foreground">
                {formatDate(workoutDate)} • Week {weekNumber} • {phaseInfo?.name} Phase
              </p>
            </div>
            {session.status !== 'completed' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSwapDialog(true)}
                className="flex-shrink-0"
              >
                <ArrowLeftRight className="h-4 w-4 mr-1" />
                Swap
              </Button>
            )}
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {completedSetsCount} of {totalSets} sets completed
              </span>
              <span className="font-medium">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {/* Control Buttons */}
          <div className="flex flex-wrap gap-3">
            {session.status === 'not_started' && (
              <Button onClick={handleStartWorkout} size="lg" className="w-full h-12">
                <PlayCircle className="mr-2 h-5 w-5" />
                Start Workout
              </Button>
            )}
            {session.status === 'in_progress' && (
              <Button
                onClick={handleCompleteWorkout}
                size="lg"
                variant="default"
                className="w-full h-12"
              >
                <CheckCircle2 className="mr-2 h-5 w-5" />
                Complete Workout
              </Button>
            )}
            {session.status === 'completed' && (
              <div className="flex items-center gap-3 w-full">
                <Badge variant="default" className="px-4 py-2">
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Completed
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={() => setShowRedoDialog(true)}
                >
                  <UndoIcon className="mr-2 h-4 w-4" />
                  Redo Workout
                </Button>
              </div>
            )}
          </div>

          {/* Superset Controls */}
          {session.status === 'in_progress' && (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSupersetSelection([]);
                  setShowSupersetDialog(true);
                }}
              >
                <Link2 className="h-4 w-4 mr-1" />
                Create Superset
              </Button>
              {supersetGroups.map((group) => {
                const names = group.exerciseIds
                  .map(id => getExerciseById(id)?.name?.split(' ')[0] ?? id)
                  .join(' + ');
                const isActive = supersetTimer.activeGroup?.id === group.id;
                return (
                  <div key={group.id} className="flex items-center gap-1">
                    <Button
                      variant={isActive ? 'default' : 'secondary'}
                      size="sm"
                      onClick={() => {
                        if (isActive) {
                          supersetTimer.endSuperset();
                        } else {
                          supersetTimer.startSuperset(group);
                        }
                      }}
                    >
                      <Zap className="h-3 w-3 mr-1" />
                      {names}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleRemoveSuperset(group.id)}
                    >
                      <Link2Off className="h-3 w-3" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Warmup Section */}
        {workoutPhase === 'warmup' && session.status === 'in_progress' && (
          <Card className="border-2 border-orange-500/30 bg-orange-500/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Flame className="h-5 w-5 text-orange-500" />
                Warmup
              </CardTitle>
              <CardDescription>Get your body ready before lifting</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {warmupEntries.map((entry, idx) => {
                const exercise = getExerciseById(entry.exerciseId);
                if (!exercise) return null;
                const isTimed = exercise.category === 'cardio';
                return (
                  <div key={entry.exerciseId} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                    <Checkbox
                      checked={entry.completed}
                      onCheckedChange={(checked) => {
                        setWarmupEntries(prev => prev.map((e, i) =>
                          i === idx ? { ...e, completed: checked as boolean } : e
                        ));
                      }}
                      className="h-5 w-5"
                    />
                    <div className="flex-1">
                      <span className="text-sm font-medium">{exercise.name}</span>
                      {isTimed && (
                        <div className="flex items-center gap-2 mt-1">
                          <Input
                            type="number"
                            inputMode="numeric"
                            placeholder="5"
                            value={entry.durationSeconds ? Math.round(entry.durationSeconds / 60) : ''}
                            onChange={(e) => {
                              const mins = parseInt(e.target.value) || 0;
                              setWarmupEntries(prev => prev.map((en, i) =>
                                i === idx ? { ...en, durationSeconds: mins * 60 } : en
                              ));
                            }}
                            className="h-8 w-16 text-sm"
                          />
                          <span className="text-xs text-muted-foreground">min</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              <div className="flex gap-2 pt-2">
                <Button onClick={handleCompleteWarmup} className="flex-1">
                  Done, Start Workout
                </Button>
                <Button variant="outline" onClick={handleSkipWarmup}>
                  Skip
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Cooldown Section */}
        {workoutPhase === 'cooldown' && session.status === 'in_progress' && (
          <Card className="border-2 border-blue-500/30 bg-blue-500/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Snowflake className="h-5 w-5 text-blue-500" />
                Cooldown
              </CardTitle>
              <CardDescription>Wind down and stretch</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {cooldownEntries.map((entry, idx) => {
                const exercise = getExerciseById(entry.exerciseId);
                if (!exercise) return null;
                return (
                  <div key={entry.exerciseId} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                    <Checkbox
                      checked={entry.completed}
                      onCheckedChange={(checked) => {
                        setCooldownEntries(prev => prev.map((e, i) =>
                          i === idx ? { ...e, completed: checked as boolean } : e
                        ));
                      }}
                      className="h-5 w-5"
                    />
                    <span className="text-sm font-medium">{exercise.name}</span>
                  </div>
                );
              })}
              <div className="flex gap-2 pt-2">
                <Button onClick={handleCompleteCooldown} className="flex-1">
                  Finish Workout
                </Button>
                <Button variant="outline" onClick={handleSkipCooldown}>
                  Skip
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Exercise List */}
        <Accordion
          className="space-y-4"
          value={activeExerciseId ? [activeExerciseId] : []}
          onValueChange={(value) => {
            const newValue = Array.isArray(value) && value.length > 0 ? value[value.length - 1] : null;
            setActiveExerciseId(newValue);
          }}
        >
          {activeExercises.map((workoutExercise) => {
            const exercise = getExerciseById(workoutExercise.exerciseId);
            if (!exercise) return null;

            const exerciseSets = session.sets.filter((s) => s.exerciseId === exercise.id);
            const completedExerciseSets = exerciseSets.filter(
              (s) => s.status === 'completed'
            ).length;

            // Get the highest RPE set for this exercise to show in the slider
            const exerciseRpe =
              exerciseSets.find((s) => s.rpe !== null)?.rpe ?? null;

            const inSuperset = getSupersetForExercise(exercise.id);
            const isSupersetActive = supersetTimer.isActive && supersetTimer.currentExerciseId === exercise.id;

            return (
              <AccordionItem
                key={exercise.id}
                value={exercise.id}
                className={cn(
                  'border rounded-lg px-4 bg-card scroll-mt-20',
                  inSuperset && 'border-l-4 border-l-violet-500',
                  isSupersetActive && 'ring-2 ring-violet-500/50'
                )}
              >
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-3 text-left">
                    <div className="rounded-full bg-primary/10 p-2">
                      <Dumbbell className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold">{exercise.name}</span>
                        {completedExerciseSets === exerciseSets.length &&
                          exerciseSets.length > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              <CheckCircle2 className="mr-1 h-3 w-3" />
                              Done
                            </Badge>
                          )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {workoutExercise.targetMuscles.map((muscle) => (
                          <Badge key={muscle} variant="outline" className="text-xs capitalize">
                            {muscle}
                          </Badge>
                        ))}
                        <Badge variant="outline" className="text-xs capitalize">
                          {exercise.difficulty}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </AccordionTrigger>

                <AccordionContent className="pt-4 space-y-4">
                  {/* YouTube Link */}
                  <a
                    href={`https://www.youtube.com/results?search_query=${encodeURIComponent(exercise.youtubeSearchQuery)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Watch demo on YouTube
                  </a>

                  {/* Sets */}
                  <div className="space-y-3">
                    {exerciseSets.map((set) => (
                      <div
                        key={set.id}
                        className="flex flex-col sm:grid sm:grid-cols-[auto_1fr_1fr_1fr_auto] gap-2 p-3 rounded-lg border bg-muted/30"
                      >
                        <div className="flex items-center justify-between sm:contents">
                          <div className="text-sm font-semibold text-muted-foreground">
                            Set {set.setNumber}
                          </div>
                          <div className="text-xs text-muted-foreground sm:hidden">
                            Target: {set.plannedReps} reps
                          </div>
                          <div className="hidden sm:block text-sm text-muted-foreground">
                            Target: {set.plannedReps}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 sm:contents">
                          <div className="space-y-1">
                            <Label className="text-xs sm:hidden">Reps</Label>
                            <Input
                              type="number"
                              inputMode="numeric"
                              placeholder={set.plannedReps.toString()}
                              value={set.actualReps ?? ''}
                              onChange={(e) =>
                                handleSetUpdate(
                                  set.id,
                                  'actualReps',
                                  e.target.value ? parseInt(e.target.value) : null
                                )
                              }
                              className="h-11 sm:h-9 text-base sm:text-sm"
                              disabled={session.status === 'completed'}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs sm:hidden">Weight</Label>
                            <Input
                              type="number"
                              inputMode="numeric"
                              placeholder="0"
                              value={set.weight ?? ''}
                              onChange={(e) =>
                                handleSetUpdate(
                                  set.id,
                                  'weight',
                                  e.target.value ? parseFloat(e.target.value) : null
                                )
                              }
                              className="h-11 sm:h-9 text-base sm:text-sm"
                              disabled={session.status === 'completed'}
                            />
                          </div>
                        </div>
                        <div className="flex items-center justify-between sm:justify-center">
                          <Label className="text-xs sm:hidden">Completed</Label>
                          <Checkbox
                            checked={set.status === 'completed'}
                            onCheckedChange={(checked) =>
                              handleSetComplete(set.id, exercise.id, checked as boolean)
                            }
                            disabled={session.status === 'completed'}
                            className="h-6 w-6 sm:h-4 sm:w-4"
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* RPE Slider (per exercise) */}
                  {session.status !== 'completed' && (
                    <div className="space-y-2 pt-2">
                      <Label className="text-sm">
                        RPE: {exerciseRpe ?? '—'}/10
                      </Label>
                      <Slider
                        min={1}
                        max={10}
                        step={1}
                        value={[exerciseRpe ?? 5]}
                        onValueChange={(values) => {
                          const rpe = Array.isArray(values) ? values[0] : values;
                          // Apply RPE to all sets of this exercise
                          if (!session) return;
                          const updatedSets = session.sets.map((s) =>
                            s.exerciseId === exercise.id ? { ...s, rpe } : s
                          );
                          const updatedSession = { ...session, sets: updatedSets };
                          setSession(updatedSession);
                          saveSession(updatedSession);
                        }}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Easy (1)</span>
                        <span>Moderate (5)</span>
                        <span>Max (10)</span>
                      </div>
                    </div>
                  )}

                  {/* Exercise Notes */}
                  <div className="space-y-2">
                    <Label className="text-sm">Exercise Notes</Label>
                    <Textarea
                      placeholder={workoutExercise.notes}
                      className="resize-none text-sm"
                      rows={2}
                      disabled={session.status === 'completed'}
                    />
                  </div>

                  {/* Skip Button */}
                  {session.status !== 'completed' && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSkipExercise(exercise.id)}
                      >
                        <SkipForward className="mr-2 h-4 w-4" />
                        Skip Exercise
                      </Button>
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>

        {/* Workout Notes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Workout Notes</CardTitle>
            <CardDescription>How did you feel? Any observations?</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="This workout felt..."
              value={workoutNotes}
              onChange={(e) => setWorkoutNotes(e.target.value)}
              className="resize-none"
              rows={4}
              disabled={session.status === 'completed'}
            />
          </CardContent>
        </Card>
      </div>

      {/* Rest Timer */}
      {showTimer && timer.isRunning && (
        <div className="fixed bottom-20 lg:bottom-4 left-0 right-0 lg:left-auto lg:right-4 lg:w-auto z-50 px-4 lg:px-0">
          <Card className="shadow-lg border-2">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="rounded-full bg-primary/10 p-2">
                <Timer className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Rest Timer</p>
                <p className="text-2xl font-bold font-mono">{timer.formatted}</p>
              </div>
              <div className="flex gap-2">
                <Button size="icon" variant="ghost" onClick={timer.pause}>
                  <PauseCircle className="h-5 w-5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    timer.reset();
                    setShowTimer(false);
                  }}
                >
                  <SkipForward className="h-5 w-5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Superset Timer */}
      {supersetTimer.isActive && supersetTimer.isResting && (
        <div className="fixed bottom-20 lg:bottom-4 left-0 right-0 lg:left-auto lg:right-4 lg:w-auto z-50 px-4 lg:px-0">
          <Card className="shadow-lg border-2 border-violet-500/50">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="rounded-full bg-violet-500/10 p-2">
                <Zap className="h-5 w-5 text-violet-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Superset Rest</p>
                <p className="text-2xl font-bold font-mono">{supersetTimer.formatted}</p>
                {supersetTimer.nextExerciseId && (
                  <p className="text-xs text-violet-600 dark:text-violet-400">
                    Next: {getExerciseById(supersetTimer.nextExerciseId)?.name}
                  </p>
                )}
              </div>
              <Button size="sm" variant="outline" onClick={supersetTimer.skipRest}>
                <SkipForward className="h-4 w-4 mr-1" />
                Skip
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Superset Creation Dialog */}
      <Dialog open={showSupersetDialog} onOpenChange={setShowSupersetDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Create Superset
            </DialogTitle>
            <DialogDescription>
              Select 2-3 exercises to perform back-to-back with short rest between them.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 py-2 max-h-[60vh] overflow-y-auto">
            {activeExercises.map((workoutExercise) => {
              const exercise = getExerciseById(workoutExercise.exerciseId);
              if (!exercise) return null;
              const alreadyInSuperset = getSupersetForExercise(exercise.id);
              const isSelected = supersetSelection.includes(exercise.id);
              return (
                <Button
                  key={exercise.id}
                  variant={isSelected ? 'default' : 'outline'}
                  className="w-full justify-start h-12 text-left"
                  disabled={!!alreadyInSuperset}
                  onClick={() => {
                    if (isSelected) {
                      setSupersetSelection(prev => prev.filter(id => id !== exercise.id));
                    } else if (supersetSelection.length < 3) {
                      setSupersetSelection(prev => [...prev, exercise.id]);
                    }
                  }}
                >
                  <Dumbbell className="h-4 w-4 mr-2 flex-shrink-0" />
                  <span className="truncate">{exercise.name}</span>
                  {alreadyInSuperset && (
                    <Badge variant="outline" className="ml-auto text-xs">In superset</Badge>
                  )}
                  {isSelected && (
                    <Badge variant="secondary" className="ml-auto text-xs">
                      #{supersetSelection.indexOf(exercise.id) + 1}
                    </Badge>
                  )}
                </Button>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSupersetDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateSuperset} disabled={supersetSelection.length < 2}>
              Create ({supersetSelection.length} selected)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Summary Dialog */}
      <WorkoutSummaryDialog
        open={showSummaryDialog}
        onOpenChange={setShowSummaryDialog}
        session={session}
        useMetric={settings.useMetric}
      />

      {/* Redo Confirmation */}
      <Dialog open={showRedoDialog} onOpenChange={setShowRedoDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redo This Workout?</DialogTitle>
            <DialogDescription>
              This will clear all your recorded sets, weights, and reps so you can start over.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRedoDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRedoWorkout}>
              Redo Workout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Swap Workout Dialog */}
      <SwapWorkoutDialog
        open={showSwapDialog}
        onOpenChange={setShowSwapDialog}
        currentMuscleGroup={dayPlan.muscleGroup}
        onSwap={handleSwapWorkout}
        hasExistingProgress={session.status !== 'not_started'}
      />
    </div>
  );
}

// ─── Swap Workout Dialog ────────────────────────────────────────────────────

function SwapWorkoutDialog({
  open,
  onOpenChange,
  currentMuscleGroup,
  onSwap,
  hasExistingProgress,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentMuscleGroup: MuscleGroup;
  onSwap: (muscleGroup: string) => void;
  hasExistingProgress: boolean;
}) {
  const trainingDays = getTrainingDays();

  const muscleGroupIcons: Record<string, string> = {
    back: '🔙',
    chest: '💪',
    legs: '🦵',
    shoulders: '🏋️',
    arms: '💪',
    core: '🧘',
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5" />
            Swap Workout
          </DialogTitle>
          <DialogDescription>
            {hasExistingProgress
              ? 'Swapping will discard your current progress for this workout.'
              : 'Choose a different workout for today.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 py-2">
          {trainingDays.map((day) => {
            const isCurrent = day.muscleGroup === currentMuscleGroup;
            return (
              <Button
                key={day.muscleGroup}
                variant={isCurrent ? 'secondary' : 'outline'}
                className="w-full justify-start h-12 text-left"
                disabled={isCurrent}
                onClick={() => onSwap(day.muscleGroup)}
              >
                <span className="mr-3 text-lg">{muscleGroupIcons[day.muscleGroup] || '🏋️'}</span>
                <div className="flex flex-col items-start">
                  <span className="font-medium">{day.label}</span>
                  <span className="text-xs text-muted-foreground capitalize">
                    {day.exercises.length} exercises
                  </span>
                </div>
                {isCurrent && (
                  <Badge variant="outline" className="ml-auto text-xs">
                    Current
                  </Badge>
                )}
              </Button>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Rest Day View ──────────────────────────────────────────────────────────

function RestDayView() {
  return (
    <div className="space-y-6 pb-4">
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Rest & Recovery</h1>
          <p className="text-muted-foreground">{formatDate(new Date())}</p>
        </div>

        <Card className="border-2">
          <CardContent className="pt-6 space-y-4">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center justify-center rounded-full bg-primary/10 p-4 mb-2">
                <Clock className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-xl font-semibold">Today is your rest day</h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                Your body needs time to recover and rebuild. Use today to recharge, hydrate, and
                prepare for your next workout.
              </p>
            </div>

            <Separator className="my-6" />

            <div className="space-y-3">
              <h3 className="font-medium">Optional Recovery Activities</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Light stretching or yoga (10-15 minutes)</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Foam rolling for tight muscles</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Gentle walk (20-30 minutes)</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Stay hydrated and eat nutritious meals</span>
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Workout Summary Dialog ─────────────────────────────────────────────────

function WorkoutSummaryDialog({
  open,
  onOpenChange,
  session,
  useMetric,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: WorkoutSession;
  useMetric: boolean;
}) {
  const completedSets = session.sets.filter((s) => s.status === 'completed');
  const totalReps = completedSets.reduce((sum, set) => sum + (set.actualReps || 0), 0);
  const uniqueExercises = new Set(completedSets.map((s) => s.exerciseId)).size;

  const duration =
    session.startedAt && session.completedAt
      ? Math.round(
          (new Date(session.completedAt).getTime() - new Date(session.startedAt).getTime()) /
            60000
        )
      : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Workout Complete!
          </DialogTitle>
          <DialogDescription>Great work! Here's your summary:</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Exercises</p>
            <p className="text-2xl font-bold">{uniqueExercises}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Sets</p>
            <p className="text-2xl font-bold">{completedSets.length}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Reps</p>
            <p className="text-2xl font-bold">{totalReps}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Volume</p>
            <p className="text-2xl font-bold">{formatWeight(session.totalVolume, useMetric)}</p>
          </div>
          {duration > 0 && (
            <div className="space-y-1 col-span-2">
              <p className="text-sm text-muted-foreground">Duration</p>
              <p className="text-2xl font-bold">{duration} minutes</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} className="w-full">
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
