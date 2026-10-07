import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useGuided } from '@/hooks/useGuided';
import {
  getDayOfWeekFromDate,
  toDateString,
  calculateStreak,
  getWeeklyStats,
  formatWeight,
  formatDate,
} from '@/lib/utils';
import { getPhaseInfo } from '@/data/program';
import { weekFocus, focusLabel } from '@/engine/templates';
import { deriveHealth } from '@/engine/health';
import { clearProgress, resumeOffer } from '@/session/persistence';
import { TodayCard } from '@/components/today/TodayCard';
import { CheckInSheet } from '@/components/checkin/CheckInSheet';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Flame, Calendar, Droplets, Moon, HeartPulse, Footprints, ClipboardEditIcon, ChevronRightIcon } from 'lucide-react';

export default function DashboardPage() {
  const { data, profile, date, checkIn, plan, saveCheckIn } = useGuided();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // ?checkin=1 (from the Workout page) opens the check-in straight away.
  const [sheetOpen, setSheetOpen] = useState(() => params.get('checkin') === '1');
  const { settings, sessions } = data;
  const phaseInfo = getPhaseInfo(plan.week);
  const health = deriveHealth(profile.health);

  const todaySession = sessions.find(s => s.date === date && s.guided) ?? sessions.find(s => s.date === date);

  const [offer, setOffer] = useState(() => resumeOffer(date));
  const discardEarlier = () => { clearProgress(); setOffer({ kind: 'none' }); };

  const weeklyStats = getWeeklyStats(sessions);
  const streak = calculateStreak(sessions);
  const daysPerWeek = profile.trainingDays.length || 6;

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = toDateString(tomorrow);
  const tomorrowFocus = weekFocus(profile)[getDayOfWeekFromDate(tomorrowStr)];

  const [phaseStart, phaseEnd] = phaseInfo.weeks;
  const doneInPhase = sessions.filter(s => s.status === 'completed' && s.week >= phaseStart && s.week <= phaseEnd).length;
  const phaseTotal = daysPerWeek * (phaseEnd - phaseStart + 1);
  const phaseProgress = Math.min((doneInPhase / phaseTotal) * 100, 100);

  const start = () => {
    if (checkIn) navigate('/session', { viewTransition: true });
    else setSheetOpen(true);
  };

  return (
    <div className="flex flex-col gap-4 pb-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Today</h1>
        <p className="text-sm text-muted-foreground">{formatDate(date)} · {phaseInfo.name} phase, week {plan.week}</p>
      </header>

      {profile.needsHealthReview && (
        <Link to="/profile" viewTransition className="press-feedback">
          <Card className="flex flex-row items-center gap-3 p-4 border-[var(--block-strength)]/50 bg-[var(--block-strength)]/10">
            <ClipboardEditIcon className="size-5 shrink-0" />
            <div className="flex-1 text-sm">
              <p className="font-semibold">Finish your health profile</p>
              <p className="text-muted-foreground">Two minutes, so every session adapts to your back, glucose and blood pressure.</p>
            </div>
            <ChevronRightIcon className="size-5 shrink-0" />
          </Card>
        </Link>
      )}

      <TodayCard
        plan={plan}
        checkIn={checkIn}
        todaySession={todaySession}
        resumeMinutesLeft={offer.kind === 'today' ? offer.minutesLeft : undefined}
        earlier={offer.kind === 'earlier' ? offer : undefined}
        onStart={start}
        onResume={() => navigate('/session?resume=1', { viewTransition: true })}
        onDiscardEarlier={discardEarlier}
      />

      <CheckInSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        profile={profile}
        date={date}
        initial={checkIn}
        onSave={saveCheckIn}
        onStart={() => { setSheetOpen(false); navigate('/session', { viewTransition: true }); }}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 stagger-children">
        <Card>
          <CardHeader className="pb-2 px-4 pt-3">
            <CardDescription className="text-xs">Sessions this week</CardDescription>
            <CardTitle className="text-2xl">{weeklyStats.workouts}/{daysPerWeek}</CardTitle>
          </CardHeader>
          <CardContent><Progress value={(weeklyStats.workouts / daysPerWeek) * 100} className="h-1" /></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 px-4 pt-3">
            <CardDescription className="text-xs">Streak</CardDescription>
            <CardTitle className="text-2xl flex items-center">{streak}<Flame className="ml-2 h-6 w-6 text-[var(--block-strength)]" /></CardTitle>
          </CardHeader>
          <CardContent><p className="text-xs text-muted-foreground">{streak === 1 ? 'day' : 'days'} in a row</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 px-4 pt-3">
            <CardDescription className="text-xs">Volume this week</CardDescription>
            <CardTitle className="text-2xl">{Math.round(weeklyStats.totalVolume / 1000)}<span className="text-base text-muted-foreground ml-1">k</span></CardTitle>
          </CardHeader>
          <CardContent><p className="text-xs text-muted-foreground">{formatWeight(weeklyStats.totalVolume, settings.useMetric)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 px-4 pt-3">
            <CardDescription className="text-xs">Sets this week</CardDescription>
            <CardTitle className="text-2xl">{weeklyStats.totalSets}</CardTitle>
          </CardHeader>
          <CardContent><p className="text-xs text-muted-foreground">{weeklyStats.totalReps} reps</p></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Phase progress</CardTitle>
          <CardDescription>{phaseInfo.name} · week {plan.week} of {phaseEnd}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{doneInPhase} of {phaseTotal} sessions</span>
            <span className="font-medium">{Math.round(phaseProgress)}%</span>
          </div>
          <Progress value={phaseProgress} className="h-2" />
          <p className="text-sm text-muted-foreground">{phaseInfo.description}</p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 stagger-children">
        {health.diabetic && (
          <Tip icon={HeartPulse} title="Glucose">
            {health.hypoRisk ? 'Check before you start and before cardio; carry fast-acting carbs.' : 'A short walk after meals lowers the after-meal rise.'}
          </Tip>
        )}
        <Tip icon={Footprints} title="Walk after meals">10 to 15 minutes after your biggest meal helps your back and your glucose.</Tip>
        <Tip icon={Droplets} title="Hydration">Sip water between blocks; more on hot days.</Tip>
        <Tip icon={Moon} title="Sleep">Seven to nine hours makes tomorrow’s session feel easier.</Tip>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2"><Calendar className="h-5 w-5" /><CardTitle className="text-lg">Tomorrow</CardTitle></div>
          <CardDescription>{formatDate(tomorrowStr)}</CardDescription>
        </CardHeader>
        <CardContent><p className="font-medium">{focusLabel(tomorrowFocus)}</p></CardContent>
      </Card>
    </div>
  );
}

function Tip({ icon: Icon, title, children }: { icon: typeof Moon; title: string; children: React.ReactNode }) {
  return (
    <Card className="flex flex-row gap-3 p-3">
      <Icon className="size-5 shrink-0 mt-0.5 text-muted-foreground" />
      <p className="text-sm"><span className="font-semibold">{title}:</span> {children}</p>
    </Card>
  );
}
