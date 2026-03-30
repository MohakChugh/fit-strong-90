import { Link } from 'react-router-dom';
import { useAppData } from '@/hooks/useLocalStorage';
import {
  getCurrentDayOfWeek,
  getWeekNumber,
  getPhaseForWeek,
  calculateStreak,
  getWeeklyStats,
  formatWeight,
  formatDate,
} from '@/lib/utils';
import { getDayPlan, getPhaseInfo } from '@/data/program';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import {
  Dumbbell,
  Flame,
  Calendar,
  Heart,
  Droplets,
  Moon,
  Activity,
  CheckCircle2,
  Clock,
  PlayCircle,
} from 'lucide-react';

const MOTIVATIONAL_LINES = [
  "Every rep counts. Let's make today legendary.",
  'Consistency beats perfection. Show up and do the work.',
  'Your future self will thank you for starting today.',
  'Progress is built one workout at a time.',
  'The only bad workout is the one you skip.',
  'Strength is earned, not given. Time to earn it.',
  'Transform your body, transform your life.',
  'Champions are made in the gym when no one is watching.',
];

export default function DashboardPage() {
  const [data] = useAppData();
  const { settings, sessions } = data;

  // Current week and phase
  const today = new Date().toISOString().split('T')[0];
  const currentWeek = getWeekNumber(settings.startDate, today);
  const currentPhase = getPhaseForWeek(currentWeek);
  const phaseInfo = getPhaseInfo(currentWeek);

  // Today's workout info
  const todayDayOfWeek = getCurrentDayOfWeek();
  const todayPlan = getDayPlan(todayDayOfWeek);
  const todaySession = sessions.find((s) => s.date === today);

  // Weekly stats
  const weeklyStats = getWeeklyStats(sessions);
  const streak = calculateStreak(sessions);

  // Tomorrow's workout
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowDayOfWeek = [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
  ][tomorrowDate.getDay()] as any;
  const tomorrowPlan = getDayPlan(tomorrowDayOfWeek);

  // Phase progress (30 workouts per phase - 6 days/week * 4-5 weeks)
  const completedWorkoutsInPhase = sessions.filter(
    (s) => s.status === 'completed' && s.phase === currentPhase
  ).length;
  const totalWorkoutsInPhase = 24; // 6 workouts/week * 4 weeks
  const phaseProgress = Math.min((completedWorkoutsInPhase / totalWorkoutsInPhase) * 100, 100);

  // Random motivational line
  const motivationalLine =
    MOTIVATIONAL_LINES[Math.floor(Math.random() * MOTIVATIONAL_LINES.length)];

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <div className="space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">{motivationalLine}</p>
        </div>

        {/* Today's Workout Card */}
        <Card className="border-2 shadow-lg">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <CardTitle className="text-2xl">
                  {todayPlan.isRestDay ? 'Rest & Recovery' : `Today's Workout`}
                </CardTitle>
                <CardDescription className="text-base">
                  {formatDate(today)} • {todayPlan.label}
                </CardDescription>
              </div>
              {todaySession && (
                <Badge
                  variant={
                    todaySession.status === 'completed'
                      ? 'default'
                      : todaySession.status === 'in_progress'
                        ? 'secondary'
                        : 'outline'
                  }
                  className="capitalize"
                >
                  {todaySession.status === 'in_progress' ? (
                    <>
                      <Clock className="mr-1 h-3 w-3" />
                      In Progress
                    </>
                  ) : todaySession.status === 'completed' ? (
                    <>
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                      Completed
                    </>
                  ) : (
                    todaySession.status.replace('_', ' ')
                  )}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Dumbbell className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium capitalize">{todayPlan.muscleGroup}</span>
              </div>
              <Separator orientation="vertical" className="h-5" />
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Week {currentWeek} • {phaseInfo?.name}
                </span>
              </div>
            </div>

            {todayPlan.isRestDay ? (
              <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                <p className="text-sm font-medium">
                  Today is your rest day. Take time to recover and recharge.
                </p>
                <p className="text-sm text-muted-foreground">
                  Optional: Light stretching, foam rolling, or a gentle walk.
                </p>
              </div>
            ) : (
              <>
                {todaySession?.status === 'completed' ? (
                  <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                      <p className="font-semibold text-green-700 dark:text-green-400">
                        Workout Complete!
                      </p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Great job! You completed {todaySession.sets.filter((s) => s.status === 'completed').length} sets
                      with a total volume of {formatWeight(todaySession.totalVolume, settings.useMetric)}.
                    </p>
                  </div>
                ) : (
                  <Link to="/workout">
                    <Button size="lg" className="w-full" variant="default">
                      <PlayCircle className="mr-2 h-5 w-5" />
                      {todaySession?.status === 'in_progress' ? 'Continue Workout' : 'Start Workout'}
                    </Button>
                  </Link>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Weekly Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs">Workouts This Week</CardDescription>
              <CardTitle className="text-3xl">{weeklyStats.workouts}/6</CardTitle>
            </CardHeader>
            <CardContent>
              <Progress value={(weeklyStats.workouts / 6) * 100} className="h-1" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs">Weekly Volume</CardDescription>
              <CardTitle className="text-3xl">
                {Math.round(weeklyStats.totalVolume / 1000)}
                <span className="text-base text-muted-foreground ml-1">k</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                {formatWeight(weeklyStats.totalVolume, settings.useMetric)} total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs">Total Sets</CardDescription>
              <CardTitle className="text-3xl">{weeklyStats.totalSets}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">{weeklyStats.totalReps} reps completed</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs">Current Streak</CardDescription>
              <CardTitle className="text-3xl flex items-center">
                {streak}
                <Flame className="ml-2 h-6 w-6 text-orange-500" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                {streak === 1 ? 'day' : 'days'} in a row
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Adherence Progress */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Phase Progress</CardTitle>
            <CardDescription>
              {phaseInfo?.name} Phase • Week {currentWeek} of {phaseInfo?.weeks[1]}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {completedWorkoutsInPhase} of {totalWorkoutsInPhase} workouts completed
                </span>
                <span className="font-medium">{Math.round(phaseProgress)}%</span>
              </div>
              <Progress value={phaseProgress} className="h-2" />
            </div>
            <p className="text-sm text-muted-foreground">{phaseInfo?.description}</p>
          </CardContent>
        </Card>

        {/* Health Reminders */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Alert className="border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20">
            <Heart className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <AlertDescription className="text-sm">
              <span className="font-medium">Blood Sugar:</span> Check levels before and after your
              workout.
            </AlertDescription>
          </Alert>

          <Alert className="border-cyan-200 bg-cyan-50/50 dark:border-cyan-900 dark:bg-cyan-950/20">
            <Droplets className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
            <AlertDescription className="text-sm">
              <span className="font-medium">Hydration:</span> Aim for 8+ glasses of water today.
            </AlertDescription>
          </Alert>

          <Alert className="border-purple-200 bg-purple-50/50 dark:border-purple-900 dark:bg-purple-950/20">
            <Moon className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            <AlertDescription className="text-sm">
              <span className="font-medium">Sleep:</span> Target 7-9 hours for optimal recovery.
            </AlertDescription>
          </Alert>
        </div>

        {/* Tomorrow Preview */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              <CardTitle className="text-lg">Tomorrow</CardTitle>
            </div>
            <CardDescription>
              {formatDate(tomorrowDate.toISOString().split('T')[0])}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-primary/10 p-3">
                <Dumbbell className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">{tomorrowPlan.label}</p>
                <p className="text-sm text-muted-foreground capitalize">
                  {tomorrowPlan.isRestDay ? 'Rest & Recovery' : tomorrowPlan.muscleGroup}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
