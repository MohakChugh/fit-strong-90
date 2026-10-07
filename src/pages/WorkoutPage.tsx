import { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAppData } from '@/hooks/useLocalStorage';
import { useTimer } from '@/hooks/useTimer';
import { useSupersetTimer } from '@/hooks/useSupersetTimer';
import {
  getDayOfWeekFromDate,
  parseDateString,
  todayString,
  generateId,
  formatWeight,
  formatDate,
  calculateVolume,
  detectPR,
  cn,
} from '@/lib/utils';
import { getPhaseInfo } from '@/data/program';
import { getExerciseById } from '@/data/exercises';
import { buildSessionPlan } from '@/engine/session';
import { focusLabel, weekFocus } from '@/engine/templates';
import { createDefaultProfile } from '@/profile/defaults';
import { manualDayPlan, swapOptions } from '@/session/manual';
import { ExerciseFigure } from '@/components/exercise/ExerciseFigure';
import type { WorkoutSession, SetStatus, WarmupCooldownEntry, WorkoutPhase, SupersetGroup, WorkoutExercise, DayOfWeek } from '@/types';
import type { DayFocus, SessionPlan } from '@/types/plan';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
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
  Headphones,
  BookOpen,
} from 'lucide-react';
import { toast } from 'sonner';

export default function WorkoutPage() {
  const [data, updateData] = useAppData();
  const { settings, sessions, personalRecords } = data;
  const [searchParams, setSearchParams] = useSearchParams();

  // Support ?date=YYYY-MM-DD and ?focus=<DayFocus> (a swapped workout)
  const actualToday = todayString();
  // The URL is user-editable: accept only a real YYYY-MM-DD that isn't in the future.
  const dateParam = searchParams.get('date') ?? '';
  const workoutDate = /^\d{4}-\d{2}-\d{2}$/.test(dateParam) && !isNaN(parseDateString(dateParam).getTime()) && dateParam <= actualToday
    ? dateParam
    : actualToday;
  const isPastWorkout = workoutDate !== actualToday;

  // The day's generated plan, the same one the guided session runs.
  const profile = useMemo(
    () => data.profile ?? createDefaultProfile({ weightKg: settings.currentWeight || 0 }),
    [data.profile, settings.currentWeight],
  );
  const options = swapOptions(profile);
  // Likewise, only accept a focus the swap dialog offers.
  const overrideFocus = options.find(o => o.focus === searchParams.get('focus'))?.focus ?? null;
  const defaultFocus = weekFocus(profile)[getDayOfWeekFromDate(workoutDate)];
  const checkIn = data.checkIns?.find(c => c.date === workoutDate);
  const plan = useMemo(
    () => buildSessionPlan({
      profile, date: workoutDate, startDate: settings.startDate,
      sessions: sessions.filter(s => s.date < workoutDate),
      recentCheckIns: (data.checkIns ?? []).filter(c => c.date < workoutDate),
      ...(checkIn ? { checkIn } : {}),
      ...(overrideFocus ? { focusOverride: overrideFocus } : {}),
    }),
    // Built once per date and focus: logging sets must never reshuffle today's exercises.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [profile, workoutDate, overrideFocus, settings.startDate, checkIn],
  );
  const dayPlan = useMemo(() => manualDayPlan(plan, settings.useMetric), [plan, settings.useMetric]);
  const dayOfWeek = dayPlan.dayOfWeek;
  const weekNumber = plan.week;
  const phase = plan.phase;
  const phaseInfo = getPhaseInfo(weekNumber);
  const activeExercises = dayPlan.exercises;

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

  // Per-exercise notes, keyed by exerciseId
  const [exerciseNotes, setExerciseNotes] = useState<Record<string, string>>({});

  // Rest timer
  const timer = useTimer(settings.defaultRestSeconds);
  const [showTimer, setShowTimer] = useState(false);

  // A rest, recovery or stop day has no strength work to track. This is computed here
  // but NOT returned on yet: every hook below must run on every render, or React
  // sees a different hook count when the day flips (e.g. tab left open overnight).
  const isRestDayView = dayPlan.isRestDay;

  // Build a stable key for the current plan to detect when we need to create a new session
  const planKey = `${workoutDate}-${plan.focus}`;

  // Initialize or restore session
  useEffect(() => {
    if (isRestDayView) return;

    // Manual tracking never touches a guided session's log.
    const existingSession = sessions.find(
      (s) => s.date === workoutDate && !s.guided &&
        (s.focus ? s.focus === plan.focus : s.muscleGroup === dayPlan.muscleGroup)
    );

    if (existingSession) {
      setSession(existingSession);
      setWorkoutNotes(existingSession.notes || '');
    } else {
      // Drop an untouched manual session left over from a swap; never one with progress.
      const stale = sessions.find((s) => s.date === workoutDate && !s.guided && s.status === 'not_started');
      if (stale) {
        updateData((prev) => ({
          ...prev,
          sessions: prev.sessions.filter((s) => s.id !== stale.id),
        }));
      }

      const newSession: WorkoutSession = {
        id: generateId(),
        date: workoutDate,
        dayOfWeek: dayOfWeek,
        muscleGroup: dayPlan.muscleGroup,
        focus: plan.focus,
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
        for (let i = 1; i <= exercise.sets; i++) {
          newSession.sets.push({
            id: generateId(),
            exerciseId: exercise.exerciseId,
            setNumber: i,
            plannedReps: exercise.reps,
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
    setExerciseNotes(session.exerciseNotes ?? {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id]);

  // All hooks are registered above this point.

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
        // Per-exercise rest from the program wins (heavy compounds need longer);
        // the user's default is the fallback when the plan doesn't specify one.
        const restSeconds = exercise?.restSeconds || settings.defaultRestSeconds;
        timer.reset(restSeconds);
        timer.start();
        setShowTimer(true);
      }
    }
  };

  // Update a per-exercise note and persist it on the session
  const handleExerciseNoteChange = (exerciseId: string, note: string) => {
    const updatedNotes = { ...exerciseNotes, [exerciseId]: note };
    setExerciseNotes(updatedNotes);
    if (session) {
      const updatedSession = { ...session, exerciseNotes: updatedNotes };
      setSession(updatedSession);
      saveSession(updatedSession);
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
      exerciseNotes,
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
      exerciseNotes: {},
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
    setExerciseNotes({});
    setShowRedoDialog(false);
    toast.success('Workout reset — start fresh!');
  };

  // Swap to another workout from the user's week
  const handleSwapWorkout = (focus: DayFocus) => {
    // Remove existing session for this date before swapping
    if (session) {
      updateData((prev) => ({
        ...prev,
        sessions: prev.sessions.filter((s) => s.id !== session.id),
      }));
    }

    const params = new URLSearchParams(searchParams);
    if (focus === defaultFocus) params.delete('focus');
    else params.set('focus', focus);
    if (workoutDate !== actualToday) {
      params.set('date', workoutDate);
    }
    setSearchParams(params, { replace: true });
    setSession(null);
    setShowSwapDialog(false);
    toast.success(`Switched to ${focusLabel(focus)}`);
  };

  const swapDialog = (
    <SwapWorkoutDialog
      open={showSwapDialog}
      onOpenChange={setShowSwapDialog}
      options={options}
      current={plan.focus}
      onSwap={handleSwapWorkout}
      hasExistingProgress={!!session && session.status !== 'not_started'}
    />
  );

  if (isRestDayView) {
    const canTrain = (plan.focus === 'rest' || plan.focus === 'activeRecovery')
      && (plan.readiness.outcome === 'green' || plan.readiness.outcome === 'amber');
    return (
      <>
        <RestDayView plan={plan} date={workoutDate} isToday={!isPastWorkout} hasCheckIn={!!checkIn}
          onTrainAnyway={canTrain ? () => setShowSwapDialog(true) : undefined} />
        {swapDialog}
      </>
    );
  }

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
  const isSwapped = overrideFocus !== null && overrideFocus !== defaultFocus;
  // Render what the session holds, so a plan rebuilt after a check-in or a
  // profile change never hides sets that were already created or logged.
  const shownExercises: WorkoutExercise[] = [...new Set(session.sets.map(s => s.exerciseId))]
    .map(id => activeExercises.find(e => e.exerciseId === id) ?? trackedExercise(id, session));

  return (
    <div className="space-y-4 pb-4">
      <div className="space-y-4">
        {/* Banners */}
        <div className="space-y-2">
          {isPastWorkout && (
            <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 text-sm animate-slide-in-left">
              <Clock className="h-4 w-4 text-amber-500 flex-shrink-0" />
              <span className="text-amber-700 dark:text-amber-400">
                Logging workout for <strong>{formatDate(workoutDate)}</strong>
              </span>
            </div>
          )}
          {isSwapped && (
            <div className="flex items-center gap-2 rounded-lg bg-blue-500/10 border border-blue-500/30 p-3 text-sm animate-slide-in-left">
              <ArrowLeftRight className="h-4 w-4 text-blue-500 flex-shrink-0" />
              <span className="text-blue-700 dark:text-blue-400">
                Swapped from {focusLabel(defaultFocus)} → <strong>{dayPlan.label}</strong>
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
                {formatDate(workoutDate)} • Week {weekNumber} • {phaseInfo?.name} Phase{plan.mode !== 'normal' ? ` (${plan.mode})` : ''}
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

          {!isPastWorkout && session.status === 'not_started' && (
            <GuidedLink plan={plan} hasCheckIn={!!checkIn} />
          )}

          {plan.changes.length > 0 && (
            <ul className="flex flex-col gap-1 rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
              {plan.changes.slice(0, 3).map(c => <li key={c}>{c}</li>)}
            </ul>
          )}

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
                <Badge variant="default" className="px-4 py-2 animate-pop">
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
          <Card className="border-2 border-orange-500/30 bg-orange-500/5 animate-scale-in">
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
                  <div key={entry.exerciseId} className="flex items-center gap-3 p-3 rounded-lg border bg-card animate-rise-in">
                    <Checkbox
                      checked={entry.completed}
                      onCheckedChange={(checked) => {
                        setWarmupEntries(prev => prev.map((e, i) =>
                          i === idx ? { ...e, completed: checked as boolean } : e
                        ));
                      }}
                      className="h-5 w-5"
                    />
                    <ExerciseFigure exerciseId={entry.exerciseId} compact className="size-14 shrink-0" />
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
          <Card className="border-2 border-blue-500/30 bg-blue-500/5 animate-scale-in">
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
                  <div key={entry.exerciseId} className="flex items-center gap-3 p-3 rounded-lg border bg-card animate-rise-in">
                    <Checkbox
                      checked={entry.completed}
                      onCheckedChange={(checked) => {
                        setCooldownEntries(prev => prev.map((e, i) =>
                          i === idx ? { ...e, completed: checked as boolean } : e
                        ));
                      }}
                      className="h-5 w-5"
                    />
                    <ExerciseFigure exerciseId={entry.exerciseId} compact className="size-14 shrink-0" />
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
            if (newValue) keepInView(newValue);
          }}
        >
          {shownExercises.map((workoutExercise) => {
            const exercise = getExerciseById(workoutExercise.exerciseId);
            if (!exercise) return null;
            const unit = workoutExercise.unit === 'seconds' ? 's' : ' reps';

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
                data-exercise={exercise.id}
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
                      <p className="text-xs text-muted-foreground">
                        {workoutExercise.sets} × {workoutExercise.reps}{unit}
                        {workoutExercise.targetMuscles.length > 0 && ` · ${workoutExercise.targetMuscles.join(', ')}`}
                      </p>
                    </div>
                  </div>
                </AccordionTrigger>

                <AccordionContent className="pt-4 space-y-4">
                  {/* Form demo: the 3D viewer animates only while this exercise is expanded */}
                  <div className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-3">
                    <ExerciseFigure exerciseId={exercise.id} playing={activeExerciseId === exercise.id} className="h-40" />
                    {workoutExercise.notes && <p className="text-sm">{workoutExercise.notes}</p>}
                    {exercise.tips && exercise.tips.length > 0 && (
                      <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                        {exercise.tips.slice(0, 3).map(t => <li key={t}>{t}</li>)}
                      </ul>
                    )}
                    <div className="flex flex-wrap gap-x-5">
                      <Link to={`/library?ex=${exercise.id}`} viewTransition
                        className="inline-flex min-h-11 items-center gap-2 text-sm text-primary hover:underline">
                        <BookOpen className="h-4 w-4" />
                        How to do it
                      </Link>
                      <a
                        href={`https://www.youtube.com/results?search_query=${encodeURIComponent(exercise.youtubeSearchQuery)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-11 items-center gap-2 text-sm text-primary hover:underline"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Watch on YouTube
                      </a>
                    </div>
                  </div>

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
                            Target: {set.plannedReps}{unit}
                          </div>
                          <div className="hidden sm:block text-sm text-muted-foreground">
                            Target: {set.plannedReps}{unit}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 sm:contents">
                          <div className="space-y-1">
                            <Label className="text-xs sm:hidden">{unit === 's' ? 'Seconds' : 'Reps'}</Label>
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
                      placeholder="How did it feel?"
                      value={exerciseNotes[exercise.id] ?? ''}
                      onChange={(e) => handleExerciseNoteChange(exercise.id, e.target.value)}
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
          <Card className="shadow-lg border-2 animate-scale-in">
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
          <Card className="shadow-lg border-2 border-violet-500/50 animate-scale-in">
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
            {shownExercises.map((workoutExercise) => {
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
      {swapDialog}
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Opening an exercise folds away the one open above it, which would carry the
 * one just tapped up off the screen. Hold it in place while the panels move,
 * then scroll it up under the header if its demo still isn't fully in view.
 */
function keepInView(id: string) {
  const item = document.querySelector<HTMLElement>(`[data-exercise="${CSS.escape(id)}"]`);
  if (!item) return;
  let top = item.getBoundingClientRect().top, frames = 0, moved = performance.now(), taken = false;
  // A finger or wheel taking over the scroll ends the hold.
  const take = () => { taken = true; };
  const input = ['touchstart', 'wheel'] as const;
  const release = () => input.forEach(e => window.removeEventListener(e, take));
  const hold = () => {
    if (frames === 0) input.forEach(e => window.addEventListener(e, take, { passive: true }));
    if (taken) return release();
    const shift = item.getBoundingClientRect().top - top;
    if (Math.abs(shift) > 0.5) {
      window.scrollBy({ top: shift, behavior: 'instant' });
      top = item.getBoundingClientRect().top;
      moved = performance.now();
    }
    // Counted in frames as well as time: on a busy phone the fold can start late.
    if (++frames < 10 || performance.now() - moved < 400) { requestAnimationFrame(hold); return; }
    release();
    const demo = item.querySelector('[data-slot="accordion-content"] [role="img"]')?.getBoundingClientRect();
    if (demo && (demo.top < 0 || demo.bottom > window.innerHeight)) item.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };
  requestAnimationFrame(hold);
}

/** A logged exercise the current plan no longer lists (plan rebuilt, or an older session). */
function trackedExercise(id: string, session: WorkoutSession): WorkoutExercise {
  const sets = session.sets.filter(s => s.exerciseId === id);
  const ex = getExerciseById(id);
  return {
    exerciseId: id,
    sets: sets.length,
    reps: sets[0]?.plannedReps ?? 10,
    restSeconds: 0,
    notes: '',
    difficulty: ex?.difficulty ?? 'beginner',
    targetMuscles: ex?.primaryMuscles.slice(0, 3) ?? [],
  };
}

/** Start the voice-guided version of today: stretching, this workout, then cardio. */
function GuidedLink({ plan, hasCheckIn }: { plan: SessionPlan; hasCheckIn: boolean }) {
  if (plan.steps.length === 0) return null;
  return (
    <Link to={hasCheckIn ? '/session' : '/dashboard?checkin=1'} viewTransition
      className={cn(buttonVariants({ size: 'lg' }), 'h-auto min-h-14 w-full flex-col gap-0.5 whitespace-normal py-2 text-center text-base')}>
      <span className="flex items-center gap-2">
        <Headphones className="h-5 w-5" />
        {hasCheckIn ? 'Start guided session' : 'Check in & start guided session'}
      </span>
      <span className="text-xs font-normal opacity-90">
        {Math.round(plan.totalSeconds / 60)} min with voice: stretch, lift, then cardio
      </span>
    </Link>
  );
}

// ─── Swap Workout Dialog ────────────────────────────────────────────────────

function SwapWorkoutDialog({
  open,
  onOpenChange,
  options,
  current,
  onSwap,
  hasExistingProgress,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  options: { focus: DayFocus; day?: DayOfWeek }[];
  current: DayFocus;
  onSwap: (focus: DayFocus) => void;
  hasExistingProgress: boolean;
}) {
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
              : 'Choose another workout from your week.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 py-2 max-h-[60vh] overflow-y-auto">
          {options.map(({ focus, day }) => {
            const isCurrent = focus === current;
            return (
              <Button
                key={focus}
                variant={isCurrent ? 'secondary' : 'outline'}
                className="w-full justify-start h-auto min-h-12 py-2 text-left"
                disabled={isCurrent}
                onClick={() => onSwap(focus)}
              >
                <div className="flex min-w-0 flex-col items-start">
                  <span className="font-medium whitespace-normal">{focusLabel(focus)}</span>
                  {day && <span className="text-xs text-muted-foreground capitalize">Usually {day}</span>}
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

function RestDayView({ plan, date, isToday, hasCheckIn, onTrainAnyway }: {
  plan: SessionPlan;
  date: string;
  isToday: boolean;
  hasCheckIn: boolean;
  /** Offered on scheduled rest days when today's readiness allows lifting. */
  onTrainAnyway?: () => void;
}) {
  const stop = plan.kind === 'none' && plan.focus !== 'rest';
  const title = stop ? 'Rest today' : plan.kind === 'recovery' ? 'Recovery day' : 'Rest & Recovery';
  const lead = stop
    ? 'Today’s check-in says your body needs rest. No lifting today.'
    : plan.kind === 'recovery'
      ? 'No lifting today. Gentle mobility, nerve glides and an easy walk help you recover.'
      : 'Your body rebuilds on rest days. Hydrate, walk after meals and sleep well.';
  return (
    <div className="space-y-6 pb-4">
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{title}</h1>
          <p className="text-muted-foreground">{formatDate(date)}</p>
        </div>

        <Card className="border-2">
          <CardContent className="pt-6 space-y-4">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center justify-center rounded-full bg-primary/10 p-4 mb-2">
                <Clock className="h-8 w-8 text-primary" />
              </div>
              <p className="text-muted-foreground max-w-md mx-auto">{lead}</p>
            </div>

            {plan.changes.length > 0 && (
              <ul className="flex flex-col gap-1 rounded-lg bg-muted/50 p-3 text-sm">
                {plan.changes.map(c => <li key={c}>{c}</li>)}
              </ul>
            )}

            {isToday && <GuidedLink plan={plan} hasCheckIn={hasCheckIn} />}
            {onTrainAnyway && (
              <Button variant="outline" className="h-12 w-full" onClick={onTrainAnyway}>
                <Dumbbell className="h-4 w-4 mr-2" />
                Do a workout anyway
              </Button>
            )}

            <Separator className="my-6" />

            <div className="space-y-3">
              <h3 className="font-medium">Optional Recovery Activities</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Gentle stretching, staying out of pain (10-15 minutes)</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>A 15-20 minute walk after meals, which also helps blood sugar</span>
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
