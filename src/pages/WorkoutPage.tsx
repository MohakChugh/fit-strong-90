import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAppData } from '@/hooks/useLocalStorage';
import { useTimer } from '@/hooks/useTimer';
import {
  getDayOfWeekFromDate,
  getWeekNumber,
  getPhaseForWeek,
  generateId,
  formatWeight,
  formatDate,
  calculateVolume,
  detectPR,
} from '@/lib/utils';
import {
  getDayPlan,
  getActiveExercisesForPhase,
  getExerciseSetsAndReps,
  getPhaseInfo,
} from '@/data/program';
import { getExerciseById } from '@/data/exercises';
import type { WorkoutSession, SetStatus } from '@/types';
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
} from 'lucide-react';
import { toast } from 'sonner';

export default function WorkoutPage() {
  const [data, updateData] = useAppData();
  const { settings, sessions, personalRecords } = data;
  const [searchParams] = useSearchParams();

  // Support ?date=YYYY-MM-DD for logging past workouts
  const actualToday = new Date().toISOString().split('T')[0];
  const workoutDate = searchParams.get('date') || actualToday;
  const isPastWorkout = workoutDate !== actualToday;

  // Workout info for the target date
  const dayOfWeek = getDayOfWeekFromDate(workoutDate);
  const dayPlan = getDayPlan(dayOfWeek);
  const weekNumber = getWeekNumber(settings.startDate, workoutDate);
  const phase = getPhaseForWeek(weekNumber);
  const phaseInfo = getPhaseInfo(weekNumber);

  // Check if target date is a rest day
  if (dayPlan.isRestDay) {
    return <RestDayView plan={dayPlan} />;
  }

  // Get active exercises for the target date
  const activeExercises = getActiveExercisesForPhase(dayPlan, phase);

  // State for current session
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [showSummaryDialog, setShowSummaryDialog] = useState(false);
  const [showRedoDialog, setShowRedoDialog] = useState(false);
  const [activeExerciseId, setActiveExerciseId] = useState<string | null>(null);
  const [workoutNotes, setWorkoutNotes] = useState('');

  // Rest timer
  const timer = useTimer(settings.defaultRestSeconds);
  const [showTimer, setShowTimer] = useState(false);

  // Initialize or restore session
  useEffect(() => {
    const existingSession = sessions.find((s) => s.date === workoutDate);

    if (existingSession) {
      setSession(existingSession);
      setWorkoutNotes(existingSession.notes || '');
    } else {
      // Create new session
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

      // Generate sets for each exercise
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
    }
  }, [workoutDate, dayOfWeek, dayPlan, phase, weekNumber, activeExercises, sessions]);

  // Save session to storage
  const saveSession = (updatedSession: WorkoutSession) => {
    updateData((prev) => ({
      ...prev,
      sessions: prev.sessions.some((s) => s.id === updatedSession.id)
        ? prev.sessions.map((s) => (s.id === updatedSession.id ? updatedSession : s))
        : [...prev.sessions, updatedSession],
    }));
  };

  // Start workout
  const handleStartWorkout = () => {
    if (!session) return;
    const updatedSession = {
      ...session,
      status: 'in_progress' as const,
      startedAt: new Date().toISOString(),
    };
    setSession(updatedSession);
    saveSession(updatedSession);
    toast.success('Workout started! Let\'s do this!');
  };

  // Complete set
  const handleSetComplete = (setId: string, checked: boolean) => {
    if (!session) return;
    const updatedSets = session.sets.map((set) =>
      set.id === setId
        ? { ...set, status: (checked ? 'completed' : 'pending') as SetStatus }
        : set
    );
    const updatedSession = { ...session, sets: updatedSets };
    setSession(updatedSession);
    saveSession(updatedSession);

    // Start rest timer when a set is completed
    if (checked && activeExerciseId) {
      const exercise = activeExercises.find((ex) => ex.exerciseId === activeExerciseId);
      if (exercise) {
        timer.reset(exercise.restSeconds);
        timer.start();
        setShowTimer(true);
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

  // Complete workout
  const handleCompleteWorkout = () => {
    if (!session) return;

    const completedSets = session.sets.filter((s) => s.status === 'completed');
    const totalVolume = calculateVolume(completedSets);

    // Check for PRs
    const newPRs: string[] = [];
    completedSets.forEach((set) => {
      if (set.weight !== null && set.actualReps !== null) {
        const isPR = detectPR(set.exerciseId, set.weight, set.actualReps, personalRecords);
        if (isPR) {
          const exercise = getExerciseById(set.exerciseId);
          if (exercise) {
            newPRs.push(exercise.name);
            // Save PR
            updateData((prev) => {
              const existingPR = prev.personalRecords.find((pr) => pr.exerciseId === set.exerciseId);
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
    };

    setSession(updatedSession);
    saveSession(updatedSession);
    setShowSummaryDialog(true);

    if (newPRs.length > 0) {
      toast.success(`New PR${newPRs.length > 1 ? 's' : ''}! ${newPRs.join(', ')}`, {
        icon: <Trophy className="h-4 w-4" />,
      });
    }
  };

  // Redo workout (mark as incomplete)
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

  if (!session) {
    return (
      <div className="container mx-auto px-4 py-6">
        <p>Loading workout...</p>
      </div>
    );
  }

  const completedSets = session.sets.filter((s) => s.status === 'completed').length;
  const totalSets = session.sets.length;
  const progress = totalSets > 0 ? (completedSets / totalSets) * 100 : 0;

  return (
    <div className="space-y-4 pb-4">
      <div className="space-y-4">
        {/* Header */}
        <div className="space-y-4">
          {isPastWorkout && (
            <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 text-sm">
              <Clock className="h-4 w-4 text-amber-500 flex-shrink-0" />
              <span className="text-amber-700 dark:text-amber-400">
                Logging workout for <strong>{formatDate(workoutDate)}</strong>
              </span>
            </div>
          )}
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{dayPlan.label}</h1>
            <p className="text-muted-foreground">
              {formatDate(workoutDate)} • Week {weekNumber} • {phaseInfo?.name} Phase
            </p>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {completedSets} of {totalSets} sets completed
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
              <Button onClick={handleCompleteWorkout} size="lg" variant="default" className="w-full h-12">
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
        </div>

        {/* Exercise List */}
        <Accordion
          className="space-y-4"
          value={activeExerciseId ? [activeExerciseId] : []}
          onValueChange={(value) => {
            const newValue = Array.isArray(value) && value.length > 0 ? value[0] : null;
            setActiveExerciseId(newValue);
          }}
        >
          {activeExercises.map((workoutExercise) => {
            const exercise = getExerciseById(workoutExercise.exerciseId);
            if (!exercise) return null;

            const exerciseSets = session.sets.filter((s) => s.exerciseId === exercise.id);
            const completedExerciseSets = exerciseSets.filter((s) => s.status === 'completed').length;

            return (
              <AccordionItem
                key={exercise.id}
                value={exercise.id}
                className="border rounded-lg px-4 bg-card scroll-mt-20"
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
                              Complete
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

                  {/* Sets Table */}
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
                              value={set.actualReps || ''}
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
                              value={set.weight || ''}
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
                              handleSetComplete(set.id, checked as boolean)
                            }
                            disabled={session.status === 'completed'}
                            className="h-6 w-6 sm:h-4 sm:w-4"
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* RPE Slider (optional) */}
                  {session.status === 'in_progress' && (
                    <div className="space-y-2 pt-2">
                      <Label className="text-sm">
                        RPE (Rate of Perceived Exertion) - Optional
                      </Label>
                      <Slider
                        min={1}
                        max={10}
                        step={1}
                        defaultValue={[7]}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Easy (1)</span>
                        <span>Moderate (5)</span>
                        <span>Max (10)</span>
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  <div className="space-y-2">
                    <Label className="text-sm">Exercise Notes</Label>
                    <Textarea
                      placeholder={workoutExercise.notes}
                      className="resize-none text-sm"
                      rows={2}
                      disabled={session.status === 'completed'}
                    />
                  </div>

                  {/* Action Buttons */}
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
              placeholder="Today's workout felt..."
              value={workoutNotes}
              onChange={(e) => setWorkoutNotes(e.target.value)}
              className="resize-none"
              rows={4}
              disabled={session.status === 'completed'}
            />
          </CardContent>
        </Card>
      </div>

      {/* Rest Timer (Fixed at Bottom) */}
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

      {/* Summary Dialog */}
      <WorkoutSummaryDialog
        open={showSummaryDialog}
        onOpenChange={setShowSummaryDialog}
        session={session}
        useMetric={settings.useMetric}
      />

      {/* Redo Workout Confirmation Dialog */}
      <Dialog open={showRedoDialog} onOpenChange={setShowRedoDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redo This Workout?</DialogTitle>
            <DialogDescription>
              This will clear all your recorded sets, weights, and reps for this workout so you can start over.
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
    </div>
  );
}

// Rest Day View Component
function RestDayView({ plan: _plan }: { plan: any }) {
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

// Workout Summary Dialog Component
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
