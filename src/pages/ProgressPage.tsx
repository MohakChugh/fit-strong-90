import { useState } from 'react';
import { useAppData } from '@/hooks/useLocalStorage';
import { getExerciseById } from '@/data/exercises';
import { getWeekNumber, formatDate, formatWeight, calculateStreak } from '@/lib/utils';
import type { BodyMetric } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, Trophy, Flame, Calendar, Scale, Ruler, Plus } from 'lucide-react';
import { toast } from 'sonner';

export default function ProgressPage() {
  const [data, updateData] = useAppData();
  const [newMetric, setNewMetric] = useState<Partial<BodyMetric>>({
    date: new Date().toISOString().split('T')[0],
    weight: null,
    waist: null,
    notes: '',
  });

  const currentStreak = calculateStreak(data.sessions);
  const totalWorkouts = data.sessions.filter(s => s.status === 'completed').length;

  // Workouts per week chart data
  const workoutsPerWeekData = Array.from({ length: 12 }, (_, i) => {
    const week = i + 1;
    const count = data.sessions.filter(s => s.week === week && s.status === 'completed').length;
    return { week: `W${week}`, count };
  }).filter(d => d.count > 0 || d.week <= `W${getWeekNumber(data.settings.startDate)}`);

  // Weekly volume chart data
  const weeklyVolumeData = Array.from({ length: 12 }, (_, i) => {
    const week = i + 1;
    const volume = data.sessions
      .filter(s => s.week === week && s.status === 'completed')
      .reduce((sum, s) => sum + s.totalVolume, 0);
    return { week: `W${week}`, volume: Math.round(volume) };
  }).filter(d => d.volume > 0 || d.week <= `W${getWeekNumber(data.settings.startDate)}`);

  // Bodyweight trend data
  const bodyweightData = [...data.bodyMetrics]
    .filter(m => m.weight !== null)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(m => ({
      date: formatDate(m.date),
      weight: m.weight,
    }));

  // Waist measurement trend data
  const waistData = [...data.bodyMetrics]
    .filter(m => m.waist !== null)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(m => ({
      date: formatDate(m.date),
      waist: m.waist,
    }));

  const handleSaveMetric = () => {
    if (!newMetric.weight && !newMetric.waist) {
      toast.error('Please enter at least weight or waist measurement');
      return;
    }

    const metric: BodyMetric = {
      date: newMetric.date || new Date().toISOString().split('T')[0],
      weight: newMetric.weight || null,
      waist: newMetric.waist || null,
      notes: newMetric.notes || '',
    };

    // Check if metric for this date already exists
    const existingIndex = data.bodyMetrics.findIndex(m => m.date === metric.date);

    if (existingIndex >= 0) {
      // Update existing
      updateData(prev => {
        const updatedMetrics = [...prev.bodyMetrics];
        updatedMetrics[existingIndex] = metric;
        return { ...prev, bodyMetrics: updatedMetrics };
      });
      toast.success('Body metric updated');
    } else {
      // Add new
      updateData(prev => ({ ...prev, bodyMetrics: [...prev.bodyMetrics, metric] }));
      toast.success('Body metric saved');
    }

    // Reset form
    setNewMetric({
      date: new Date().toISOString().split('T')[0],
      weight: null,
      waist: null,
      notes: '',
    });
  };

  // Phase completion stats
  const phaseStats = [
    { phase: 'Foundation', weeks: [1, 4], color: 'bg-blue-500' },
    { phase: 'Hypertrophy', weeks: [5, 8], color: 'bg-purple-500' },
    { phase: 'Strength', weeks: [9, 12], color: 'bg-green-500' },
  ].map(p => {
    const [start, end] = p.weeks;
    const completed = data.sessions.filter(
      s => s.week >= start && s.week <= end && s.status === 'completed'
    ).length;
    const expected = 6 * (end - start + 1); // 6 training days per week
    return { ...p, completed, expected, percentage: Math.round((completed / expected) * 100) };
  });

  return (
    <div className="container mx-auto py-8 px-4 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold tracking-tight">Progress Tracking</h1>
        <p className="text-muted-foreground mt-2">
          Track your journey and celebrate your wins
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Flame className="h-4 w-4 text-orange-500" />
              Current Streak
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{currentStreak} days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Trophy className="h-4 w-4 text-yellow-500" />
              Total Workouts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{totalWorkouts}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-500" />
              Current Week
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">Week {getWeekNumber(data.settings.startDate)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              Personal Records
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{data.personalRecords.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Workouts per Week */}
        <Card>
          <CardHeader>
            <CardTitle>Workouts per Week</CardTitle>
            <CardDescription>Your weekly workout frequency</CardDescription>
          </CardHeader>
          <CardContent>
            {workoutsPerWeekData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={workoutsPerWeekData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="week" className="text-xs" />
                  <YAxis className="text-xs" />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                    }}
                  />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No workout data yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Weekly Volume */}
        <Card>
          <CardHeader>
            <CardTitle>Total Weekly Volume</CardTitle>
            <CardDescription>Weight lifted per week ({data.settings.useMetric ? 'kg' : 'lbs'})</CardDescription>
          </CardHeader>
          <CardContent>
            {weeklyVolumeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={weeklyVolumeData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="week" className="text-xs" />
                  <YAxis className="text-xs" />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                    }}
                  />
                  <Line type="monotone" dataKey="volume" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No volume data yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bodyweight Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5" />
              Bodyweight Trend
            </CardTitle>
            <CardDescription>Track your weight over time ({data.settings.useMetric ? 'kg' : 'lbs'})</CardDescription>
          </CardHeader>
          <CardContent>
            {bodyweightData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={bodyweightData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" />
                  <YAxis className="text-xs" />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                    }}
                  />
                  <Line type="monotone" dataKey="weight" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No weight data yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Waist Measurement Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Ruler className="h-5 w-5" />
              Waist Measurement Trend
            </CardTitle>
            <CardDescription>Track your waist circumference ({data.settings.useMetric ? 'cm' : 'inches'})</CardDescription>
          </CardHeader>
          <CardContent>
            {waistData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={waistData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" />
                  <YAxis className="text-xs" />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                    }}
                  />
                  <Line type="monotone" dataKey="waist" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No waist data yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Body Metrics Entry */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Add Body Metrics
          </CardTitle>
          <CardDescription>Log your weight and measurements</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="metric-date">Date</Label>
              <Input
                id="metric-date"
                type="date"
                value={newMetric.date}
                onChange={(e) => setNewMetric({ ...newMetric, date: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="metric-weight">Weight ({data.settings.useMetric ? 'kg' : 'lbs'})</Label>
              <Input
                id="metric-weight"
                type="number"
                step="0.1"
                placeholder="Enter weight"
                value={newMetric.weight || ''}
                onChange={(e) => setNewMetric({ ...newMetric, weight: e.target.value ? parseFloat(e.target.value) : null })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="metric-waist">Waist ({data.settings.useMetric ? 'cm' : 'inches'})</Label>
              <Input
                id="metric-waist"
                type="number"
                step="0.1"
                placeholder="Enter waist measurement"
                value={newMetric.waist || ''}
                onChange={(e) => setNewMetric({ ...newMetric, waist: e.target.value ? parseFloat(e.target.value) : null })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="metric-notes">Notes (optional)</Label>
              <Input
                id="metric-notes"
                placeholder="How are you feeling?"
                value={newMetric.notes}
                onChange={(e) => setNewMetric({ ...newMetric, notes: e.target.value })}
              />
            </div>
          </div>

          <Button onClick={handleSaveMetric} className="mt-4 w-full md:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            Save Metrics
          </Button>
        </CardContent>
      </Card>

      {/* Personal Records */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Personal Records
          </CardTitle>
          <CardDescription>Your strongest lifts</CardDescription>
        </CardHeader>
        <CardContent>
          {data.personalRecords.length > 0 ? (
            <div className="space-y-3">
              {data.personalRecords.map((pr) => {
                const exercise = getExerciseById(pr.exerciseId);
                return (
                  <div key={`${pr.exerciseId}-${pr.date}`} className="flex items-center justify-between border-b pb-3 last:border-0">
                    <div>
                      <p className="font-semibold">{exercise?.name || pr.exerciseId}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatWeight(pr.weight, data.settings.useMetric)} × {pr.reps} reps
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge variant="secondary" className="mb-1">
                        {Math.round(pr.volume)} {data.settings.useMetric ? 'kg' : 'lbs'}
                      </Badge>
                      <p className="text-xs text-muted-foreground">{formatDate(pr.date)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">
              No personal records yet. Complete workouts to set PRs!
            </p>
          )}
        </CardContent>
      </Card>

      {/* Phase Completion */}
      <Card>
        <CardHeader>
          <CardTitle>Phase Completion</CardTitle>
          <CardDescription>Your progress through each phase</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {phaseStats.map((phase) => (
            <div key={phase.phase} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${phase.color}`} />
                  <span className="font-medium">{phase.phase}</span>
                  <Badge variant="outline" className="text-xs">
                    Weeks {phase.weeks[0]}-{phase.weeks[1]}
                  </Badge>
                </div>
                <span className="text-sm text-muted-foreground">
                  {phase.completed}/{phase.expected} workouts ({phase.percentage}%)
                </span>
              </div>
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full ${phase.color} transition-all duration-500`}
                  style={{ width: `${Math.min(phase.percentage, 100)}%` }}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
