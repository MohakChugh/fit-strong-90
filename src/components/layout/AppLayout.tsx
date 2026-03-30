import { useState } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Dumbbell,
  Calendar,
  Library,
  TrendingUp,
  History,
  Settings,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useAppData } from '@/hooks/useLocalStorage';
import { getCurrentDayOfWeek, formatDate, getWeekNumber } from '@/lib/utils';
import { getDayPlan, getPhaseInfo } from '@/data/program';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/workout', label: 'Workout', icon: Dumbbell },
  { to: '/plan', label: '90-Day Plan', icon: Calendar },
  { to: '/library', label: 'Library', icon: Library },
  { to: '/progress', label: 'Progress', icon: TrendingUp },
  { to: '/history', label: 'History', icon: History },
  { to: '/settings', label: 'Settings', icon: Settings },
];

// Mobile nav only shows these 4 items + More menu
const mobileNavItems = navItems.slice(0, 4);
const mobileMoreItems = navItems.slice(4);

export default function AppLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [data] = useAppData();

  const currentDay = getCurrentDayOfWeek();
  const dayPlan = getDayPlan(currentDay);
  const week = data.settings.startDate
    ? getWeekNumber(data.settings.startDate, new Date().toISOString().split('T')[0])
    : 1;
  const phaseInfo = getPhaseInfo(week);
  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          'hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-50 lg:flex lg:flex-col',
          'bg-card border-r border-border transition-all duration-300',
          sidebarCollapsed ? 'lg:w-16' : 'lg:w-60'
        )}
      >
        {/* Logo / Brand */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-border">
          {!sidebarCollapsed && (
            <div className="flex items-center gap-2">
              <Dumbbell className="h-6 w-6 text-primary" />
              <span className="font-semibold text-lg">FitStrong 90</span>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-3 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                  'hover:bg-accent hover:text-accent-foreground',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground',
                  sidebarCollapsed && 'justify-center'
                )
              }
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {!sidebarCollapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Phase Badge */}
        {!sidebarCollapsed && phaseInfo && (
          <div className="p-4 border-t border-border">
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">Current Phase</div>
              <Badge variant="secondary" className="w-full justify-center py-1.5">
                {phaseInfo.name} - Week {week}
              </Badge>
            </div>
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <div className={cn('lg:transition-all lg:duration-300', sidebarCollapsed ? 'lg:pl-16' : 'lg:pl-60')}>
        {/* Sticky Header */}
        <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex h-12 sm:h-14 items-center justify-between px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-sm font-semibold">
                    {formatDate(today)}
                  </h1>
                  {!dayPlan.isRestDay && (
                    <>
                      <span className="text-muted-foreground">-</span>
                      <span className="text-sm text-muted-foreground">{dayPlan.label}</span>
                    </>
                  )}
                  {dayPlan.isRestDay && (
                    <>
                      <span className="text-muted-foreground">-</span>
                      <span className="text-sm text-muted-foreground">Rest Day</span>
                    </>
                  )}
                </div>
              </div>
            </div>
            {phaseInfo && (
              <Badge variant="outline" className="hidden sm:inline-flex">
                {phaseInfo.name} • Week {week}
              </Badge>
            )}
          </div>
        </header>

        {/* Page Content */}
        <main className="p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8">
          <Outlet />
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-50 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 pb-safe">
        <div className="flex items-center justify-around h-18 px-2">
          {mobileNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center justify-center gap-1 flex-1 h-full rounded-lg transition-all',
                  'hover:bg-accent/50 active:scale-95',
                  isActive ? 'text-primary' : 'text-muted-foreground'
                )
              }
            >
              <item.icon className="h-6 w-6" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </NavLink>
          ))}

          {/* More Menu Sheet */}
          <Sheet open={moreMenuOpen} onOpenChange={setMoreMenuOpen}>
            <SheetTrigger
              className={cn(
                'flex flex-col items-center justify-center gap-1 flex-1 h-full rounded-lg transition-all',
                'hover:bg-accent/50 active:scale-95 text-muted-foreground'
              )}
            >
              <MoreHorizontal className="h-6 w-6" />
              <span className="text-[10px] font-medium">More</span>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-auto">
              <SheetHeader>
                <SheetTitle>More Options</SheetTitle>
              </SheetHeader>
              <Separator className="my-4" />
              <div className="space-y-1">
                {mobileMoreItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setMoreMenuOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors',
                        'hover:bg-accent',
                        isActive ? 'bg-primary text-primary-foreground' : 'text-foreground'
                      )
                    }
                  >
                    <item.icon className="h-5 w-5" />
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </div>
  );
}
