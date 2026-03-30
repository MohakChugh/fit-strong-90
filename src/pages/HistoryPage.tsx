import { useState, useMemo } from 'react';
import { useAppData } from '@/hooks/useLocalStorage';
import { Calendar } from '@/components/ui/calendar';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatDateFull, formatWeight, formatDuration } from '@/lib/utils';
import { getExerciseById } from '@/data/exercises';
import type { WorkoutSession, WorkoutStatus, DayOfWeek } from '@/types';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CalendarIcon, DumbbellIcon, ActivityIcon, ClockIcon, UndoIcon } from 'lucide-react';
import { toast } from 'sonner';

export default function HistoryPage() {
  const [data, update] = useAppData();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [incompleteDialogOpen, setIncompleteDialogOpen] = useState(false);

  // Get the session for the selected date
  const selectedSession = useMemo(() => {
    if (!selectedDate) return null;
    const dateStr = selectedDate.toISOString().split('T')[0];
    return data.sessions.find(s => s.date === dateStr);
  }, [selectedDate, data.sessions]);

  // Calculate summary stats
  const stats = useMemo(() => {
    const completed = data.sessions.filter(s => s.status === 'completed');

    // Count by day of week
    const dayCount: Partial<Record<DayOfWeek, number>> = {};
    completed.forEach(s => {
      dayCount[s.dayOfWeek] = (dayCount[s.dayOfWeek] || 0) + 1;
    });
    const mostConsistentDay = Object.entries(dayCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

    // Calculate average duration
    const durationsInSeconds = completed
      .filter(s => s.startedAt && s.completedAt)
      .map(s => {
        const start = new Date(s.startedAt!).getTime();
        const end = new Date(s.completedAt!).getTime();
        return Math.floor((end - start) / 1000);
      });
    const avgDuration = durationsInSeconds.length > 0
      ? Math.floor(durationsInSeconds.reduce((a, b) => a + b, 0) / durationsInSeconds.length)
      : 0;

    // Current month stats
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const thisMonthSessions = completed.filter(s => {
      const sessionDate = new Date(s.date);
      return sessionDate.getMonth() === currentMonth && sessionDate.getFullYear() === currentYear;
    });

    return {
      totalWorkouts: completed.length,
      mostConsistentDay: mostConsistentDay.charAt(0).toUpperCase() + mostConsistentDay.slice(1),
      avgDuration,
      thisMonthWorkouts: thisMonthSessions.length,
    };
  }, [data.sessions]);

  // Create modifiers for calendar
  const calendarModifiers = useMemo(() => {
    const completed: Date[] = [];
    const partial: Date[] = [];
    const skipped: Date[] = [];

    data.sessions.forEach(session => {
      const date = new Date(session.date + 'T00:00:00');
      if (session.status === 'completed') {
        completed.push(date);
      } else if (session.status === 'partial') {
        partial.push(date);
      } else if (session.status === 'skipped') {
        skipped.push(date);
      }
    });

    return { completed, partial, skipped };
  }, [data.sessions]);

  const handleDayClick = (date: Date | undefined) => {
    if (!date) return;
    setSelectedDate(date);
    setSheetOpen(true);
  };

  const handleSaveEdit = (sessionId: string, setId: string, weight: number, reps: number) => {
    update(prev => ({
      ...prev,
      sessions: prev.sessions.map(session => {
        if (session.id !== sessionId) return session;

        return {
          ...session,
          sets: session.sets.map(set => {
            if (set.id !== setId) return set;
            return {
              ...set,
              weight,
              actualReps: reps,
            };
          }),
        };
      }),
    }));
    toast.success('Set updated');
  };

  const handleMarkIncomplete = () => {
    if (!selectedSession) return;
    update(prev => ({
      ...prev,
      sessions: prev.sessions.map(session => {
        if (session.id !== selectedSession.id) return session;
        return {
          ...session,
          status: 'not_started' as WorkoutStatus,
          completedAt: null,
          startedAt: null,
          totalVolume: 0,
          sets: session.sets.map(set => ({
            ...set,
            status: 'pending' as const,
            actualReps: null,
            weight: null,
            rpe: null,
          })),
        };
      }),
    }));
    setIncompleteDialogOpen(false);
    setSheetOpen(false);
    toast.success('Workout marked as incomplete — you can redo it');
  };

  const getStatusBadge = (status: WorkoutStatus) => {
    const variants: Record<WorkoutStatus, { variant: 'default' | 'secondary' | 'destructive' | 'outline', label: string }> = {
      completed: { variant: 'default', label: 'Completed' },
      partial: { variant: 'secondary', label: 'Partial' },
      skipped: { variant: 'destructive', label: 'Skipped' },
      in_progress: { variant: 'outline', label: 'In Progress' },
      not_started: { variant: 'outline', label: 'Not Started' },
    };
    const { variant, label } = variants[status];
    return <Badge variant={variant}>{label}</Badge>;
  };

  return (
    <div className="flex flex-col gap-6 p-4 pb-20 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">Workout History</h1>
        <p className="text-sm text-muted-foreground">
          View your workout calendar and track your progress
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <DumbbellIcon className="size-4" />
            <span className="text-xs">Total Workouts</span>
          </div>
          <div className="text-2xl font-bold">{stats.totalWorkouts}</div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <CalendarIcon className="size-4" />
            <span className="text-xs">This Month</span>
          </div>
          <div className="text-2xl font-bold">{stats.thisMonthWorkouts}</div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <ActivityIcon className="size-4" />
            <span className="text-xs">Most Active</span>
          </div>
          <div className="text-sm font-semibold">{stats.mostConsistentDay}</div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <ClockIcon className="size-4" />
            <span className="text-xs">Avg Duration</span>
          </div>
          <div className="text-sm font-semibold">
            {stats.avgDuration > 0 ? formatDuration(stats.avgDuration) : 'N/A'}
          </div>
        </Card>
      </div>

      {/* Calendar */}
      <Card className="p-4">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleDayClick}
          modifiers={calendarModifiers}
          modifiersClassNames={{
            completed: 'bg-primary/20 text-primary font-semibold relative after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:size-1 after:rounded-full after:bg-primary',
            partial: 'bg-secondary/30 text-secondary-foreground font-semibold relative after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:size-1 after:rounded-full after:bg-secondary',
            skipped: 'bg-destructive/10 text-destructive font-semibold relative after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:size-1 after:rounded-full after:bg-destructive',
          }}
          className="w-full"
        />
      </Card>

      {/* Day Detail Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="overflow-y-auto w-full sm:w-[400px]">
          {selectedSession ? (
            <>
              <SheetHeader>
                <SheetTitle>{formatDateFull(selectedSession.date)}</SheetTitle>
                <SheetDescription>
                  {selectedSession.muscleGroup.charAt(0).toUpperCase() + selectedSession.muscleGroup.slice(1)} Day
                </SheetDescription>
              </SheetHeader>

              <div className="flex flex-col gap-4 mt-4">
                {/* Status Badge */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Status</span>
                  {getStatusBadge(selectedSession.status)}
                </div>

                {/* Phase & Week */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Week {selectedSession.week}</span>
                  <Badge variant="outline">
                    {selectedSession.phase.charAt(0).toUpperCase() + selectedSession.phase.slice(1)}
                  </Badge>
                </div>

                {/* Total Volume */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total Volume</span>
                  <span className="text-sm font-semibold">
                    {formatWeight(selectedSession.totalVolume, data.settings.useMetric)}
                  </span>
                </div>

                {/* Duration */}
                {selectedSession.startedAt && selectedSession.completedAt && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Duration</span>
                    <span className="text-sm font-semibold">
                      {formatDuration(
                        Math.floor(
                          (new Date(selectedSession.completedAt).getTime() -
                            new Date(selectedSession.startedAt).getTime()) /
                            1000
                        )
                      )}
                    </span>
                  </div>
                )}

                {/* Mark Incomplete */}
                {(selectedSession.status === 'completed' || selectedSession.status === 'partial') && (
                  <Button
                    variant="outline"
                    className="w-full justify-start text-destructive border-destructive/30 hover:bg-destructive/10"
                    onClick={() => setIncompleteDialogOpen(true)}
                  >
                    <UndoIcon className="size-4" />
                    Mark as Incomplete
                  </Button>
                )}

                {/* Notes */}
                {selectedSession.notes && (
                  <div className="flex flex-col gap-1">
                    <span className="text-sm text-muted-foreground">Notes</span>
                    <p className="text-sm bg-muted p-2 rounded-md">{selectedSession.notes}</p>
                  </div>
                )}

                {/* Exercises */}
                <div className="flex flex-col gap-3 mt-2">
                  <h3 className="text-sm font-semibold">Exercises</h3>
                  {selectedSession.sets.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No sets recorded</p>
                  ) : (
                    (() => {
                      // Group sets by exercise
                      const exerciseGroups = new Map<string, typeof selectedSession.sets>();
                      selectedSession.sets.forEach(set => {
                        const existing = exerciseGroups.get(set.exerciseId) || [];
                        exerciseGroups.set(set.exerciseId, [...existing, set]);
                      });

                      return Array.from(exerciseGroups.entries()).map(([exerciseId, sets]) => {
                        const exercise = getExerciseById(exerciseId);
                        if (!exercise) return null;

                        return (
                          <Card key={exerciseId} className="p-3">
                            <div className="flex flex-col gap-2">
                              <div className="font-medium text-sm">{exercise.name}</div>
                              <div className="flex flex-col gap-2">
                                {sets.map((set, idx) => (
                                  <EditableSet
                                    key={set.id}
                                    set={set}
                                    setNumber={idx + 1}
                                    sessionId={selectedSession.id}
                                    useMetric={data.settings.useMetric}
                                    onSave={handleSaveEdit}
                                  />
                                ))}
                              </div>
                            </div>
                          </Card>
                        );
                      });
                    })()
                  )}
                </div>
              </div>
            </>
          ) : (
            <>
              <SheetHeader>
                <SheetTitle>{selectedDate ? formatDateFull(selectedDate) : 'No Date Selected'}</SheetTitle>
                <SheetDescription>No workout recorded for this day</SheetDescription>
              </SheetHeader>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Mark Incomplete Confirmation Dialog */}
      <Dialog open={incompleteDialogOpen} onOpenChange={setIncompleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Workout as Incomplete?</DialogTitle>
            <DialogDescription>
              This will reset all sets and clear your recorded weights and reps for this workout. You can redo it from scratch.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIncompleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleMarkIncomplete}>
              Mark Incomplete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// EditableSet component for editing past workout sets
function EditableSet({
  set,
  setNumber,
  sessionId,
  useMetric,
  onSave,
}: {
  set: WorkoutSession['sets'][number];
  setNumber: number;
  sessionId: string;
  useMetric: boolean;
  onSave: (sessionId: string, setId: string, weight: number, reps: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [weight, setWeight] = useState(set.weight?.toString() || '0');
  const [reps, setReps] = useState(set.actualReps?.toString() || '0');

  const handleSave = () => {
    const weightNum = parseFloat(weight) || 0;
    const repsNum = parseInt(reps, 10) || 0;
    onSave(sessionId, set.id, weightNum, repsNum);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
        <span className="text-xs text-muted-foreground w-12">Set {setNumber}</span>
        <div className="flex items-center gap-1 flex-1">
          <Input
            type="number"
            inputMode="numeric"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            className="h-9 text-sm"
            placeholder="Weight"
          />
          <span className="text-xs">x</span>
          <Input
            type="number"
            inputMode="numeric"
            value={reps}
            onChange={(e) => setReps(e.target.value)}
            className="h-9 text-sm"
            placeholder="Reps"
          />
        </div>
        <Button size="sm" onClick={handleSave}>Save</Button>
        <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
      </div>
    );
  }

  return (
    <div
      className="flex items-center justify-between p-2 rounded-md hover:bg-muted cursor-pointer transition-colors"
      onClick={() => set.status === 'completed' && setEditing(true)}
    >
      <span className="text-xs text-muted-foreground">Set {setNumber}</span>
      <div className="flex items-center gap-2">
        {set.status === 'completed' ? (
          <>
            <span className="text-xs font-medium">
              {formatWeight(set.weight || 0, useMetric)} x {set.actualReps}
            </span>
            {set.rpe && <Badge variant="outline" className="text-xs">RPE {set.rpe}</Badge>}
          </>
        ) : (
          <Badge variant="outline" className="text-xs">{set.status}</Badge>
        )}
      </div>
    </div>
  );
}
