import { useAppData } from '@/hooks/useLocalStorage';
import { getWeekNumber, getPhaseForWeek } from '@/lib/utils';
import { PHASES, weeklyPlan } from '@/data/program';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Calendar, TrendingUp, Target } from 'lucide-react';

const MUSCLE_GROUP_COLORS: Record<string, string> = {
  back: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20',
  chest: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20',
  legs: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20',
  shoulders: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20',
  arms: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20',
  core: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
  mobility: 'bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20',
  cardio: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/20',
};

export default function PlanPage() {
  const [data] = useAppData();
  const currentWeek = getWeekNumber(data.settings.startDate);
  const currentPhase = getPhaseForWeek(currentWeek);

  // Calculate completed workouts per week
  const getWeekStats = (week: number) => {
    const sessionCount = data.sessions.filter(
      s => s.week === week && s.status === 'completed'
    ).length;
    return sessionCount;
  };

  return (
    <div className="space-y-6 pb-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-4xl font-bold tracking-tight">90-Day Program</h1>
        <p className="text-muted-foreground mt-2">
          Your complete 12-week transformation journey
        </p>
      </div>

      {/* Phase Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PHASES.map((phase) => {
          const isCurrentPhase = phase.phase === currentPhase;
          const [startWeek, endWeek] = phase.weeks;
          const totalWorkouts = data.sessions.filter(
            s => s.week >= startWeek && s.week <= endWeek && s.status === 'completed'
          ).length;

          return (
            <Card
              key={phase.phase}
              className={isCurrentPhase ? 'border-primary shadow-md' : ''}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl">{phase.name}</CardTitle>
                  {isCurrentPhase && (
                    <Badge variant="default">Current</Badge>
                  )}
                </div>
                <CardDescription>Weeks {startWeek}-{endWeek}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 px-4 pb-4">
                <p className="text-sm text-muted-foreground">{phase.description}</p>
                <div className="pt-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Target className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{phase.focus}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm mt-2">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    <span>{totalWorkouts} workouts completed</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* 12-Week Grid */}
      <div>
        <h2 className="text-xl sm:text-2xl font-semibold mb-4 flex items-center gap-2">
          <Calendar className="h-6 w-6" />
          12-Week Overview
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {Array.from({ length: 12 }, (_, i) => i + 1).map((week) => {
            const phase = getPhaseForWeek(week);
            const phaseInfo = PHASES.find(p => p.phase === phase);
            const completedWorkouts = getWeekStats(week);
            const isCurrent = week === currentWeek;
            const isPast = week < currentWeek;
            const isFuture = week > currentWeek;

            return (
              <Card
                key={week}
                className={
                  isCurrent
                    ? 'border-primary border-2 shadow-lg'
                    : isPast
                    ? 'opacity-75'
                    : ''
                }
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Week {week}</CardTitle>
                    {isCurrent && (
                      <Badge variant="default" className="text-xs">Now</Badge>
                    )}
                    {isFuture && (
                      <Badge variant="outline" className="text-xs">Upcoming</Badge>
                    )}
                  </div>
                  <CardDescription>{phaseInfo?.name} Phase</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground">
                    {completedWorkouts > 0 ? (
                      <span className="text-primary font-medium">
                        {completedWorkouts} workout{completedWorkouts !== 1 ? 's' : ''} completed
                      </span>
                    ) : isPast ? (
                      <span className="text-muted-foreground">No workouts</span>
                    ) : (
                      <span className="text-muted-foreground">Not started</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Weekly Split View */}
      <div>
        <h2 className="text-xl sm:text-2xl font-semibold mb-4">Weekly Training Split</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {weeklyPlan.map((day) => (
            <Card key={day.dayOfWeek} className={day.isRestDay ? 'bg-muted/50' : ''}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base capitalize">{day.dayOfWeek}</CardTitle>
                <CardDescription>{day.label}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Badge
                    variant="outline"
                    className={MUSCLE_GROUP_COLORS[day.muscleGroup]}
                  >
                    {day.muscleGroup}
                  </Badge>
                  <p className="text-sm text-muted-foreground">
                    {day.isRestDay ? 'Optional mobility' : `${day.exercises.length} exercises`}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Progression Logic */}
      <div>
        <h2 className="text-xl sm:text-2xl font-semibold mb-4">Program Progression</h2>
        <Accordion className="w-full">
          <AccordionItem value="foundation">
            <AccordionTrigger className="text-lg">
              <div className="flex items-center gap-2">
                <Badge variant="outline">Weeks 1-4</Badge>
                <span>Foundation Phase</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pt-2">
                <p className="text-muted-foreground">
                  Build proper form and movement patterns with machine-supported exercises.
                </p>
                <div className="grid gap-2">
                  <div className="flex gap-2">
                    <span className="font-semibold min-w-20">Sets:</span>
                    <span className="text-muted-foreground">3 sets per exercise</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="font-semibold min-w-20">Reps:</span>
                    <span className="text-muted-foreground">12-15 reps (moderate weight)</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="font-semibold min-w-20">Focus:</span>
                    <span className="text-muted-foreground">Perfect form, control, mind-muscle connection</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="font-semibold min-w-20">Equipment:</span>
                    <span className="text-muted-foreground">Primarily machines, some dumbbells</span>
                  </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="hypertrophy">
            <AccordionTrigger className="text-lg">
              <div className="flex items-center gap-2">
                <Badge variant="outline">Weeks 5-8</Badge>
                <span>Hypertrophy Phase</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pt-2">
                <p className="text-muted-foreground">
                  Increase muscle size with progressive overload and more free weight exercises.
                </p>
                <div className="grid gap-2">
                  <div className="flex gap-2">
                    <span className="font-semibold min-w-20">Sets:</span>
                    <span className="text-muted-foreground">4 sets per exercise</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="font-semibold min-w-20">Reps:</span>
                    <span className="text-muted-foreground">8-12 reps (moderate-heavy weight)</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="font-semibold min-w-20">Focus:</span>
                    <span className="text-muted-foreground">Volume, time under tension, progressive overload</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="font-semibold min-w-20">Equipment:</span>
                    <span className="text-muted-foreground">More free weights, barbells introduced</span>
                  </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="strength">
            <AccordionTrigger className="text-lg">
              <div className="flex items-center gap-2">
                <Badge variant="outline">Weeks 9-12</Badge>
                <span>Strength Phase</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pt-2">
                <p className="text-muted-foreground">
                  Build maximal strength and power with compound movements and heavy weights.
                </p>
                <div className="grid gap-2">
                  <div className="flex gap-2">
                    <span className="font-semibold min-w-20">Sets:</span>
                    <span className="text-muted-foreground">4-5 sets per exercise</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="font-semibold min-w-20">Reps:</span>
                    <span className="text-muted-foreground">5-8 reps (heavy weight)</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="font-semibold min-w-20">Focus:</span>
                    <span className="text-muted-foreground">Maximal strength, power, compound lifts</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="font-semibold min-w-20">Equipment:</span>
                    <span className="text-muted-foreground">Heavy barbells, squat/deadlift focus</span>
                  </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  );
}
