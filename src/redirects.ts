/**
 * Every v1 address, sent to its v2 place with its query kept (journey §19.3;
 * audit K-16, K-17, A-35). Record details and tasks keep their v1 addresses.
 */

/**
 * v1's metric kinds, and the stored kinds a metric address may name, to their
 * v2 place. Labs keeps its kind (B-14); movement is counted in Trends (L-17).
 */
const METRIC: Record<string, string> = {
  glucose: '/hub/glucose',
  bloodPressure: '/hub/bp', bloodPressureSystolic: '/hub/bp', bloodPressureDiastolic: '/hub/bp', bp: '/hub/bp',
  backLeg: '/hub/back', backPain: '/hub/back', legPain: '/hub/back', pain: '/hub/back',
  weight: '/hub/weight', waist: '/hub/waist', water: '/hub/water', steps: '/hub/steps', sleep: '/hub/sleep',
  hba1c: '/hub/labs?metric=hba1c', b12: '/hub/labs?metric=b12', vitaminD: '/hub/labs?metric=vitaminD', vitd: '/hub/labs?metric=vitaminD',
  movementMinutes: '/trends', movement: '/trends',
  walking: '/trends/walk', walkDuration: '/trends/walk', walkDistance: '/trends/walk',
  // ponytail: v4's mood has no category; its trend stays until Plan 3 decides on it.
  mood: '/trends/mood',
};
/** v1 You's screens, and Me's own names for them. */
const YOU: Record<string, string> = {
  profile: 'profile', food: 'food', habits: 'reminders', voice: 'voice', appearance: 'display', data: 'data',
  reminders: 'reminders', display: 'display',
};
const V1_LEGACY: Record<string, string> = {
  '/dashboard': '/today', '/workout': '/track/workout', '/plan': '/move/plan', '/library': '/move/exercises',
  '/progress': '/track', '/history': '/track', '/settings': '/you', '/profile': '/you/profile', '/onboarding': '/welcome',
};
const V2_ROOTS = ['/home', '/hub', '/day', '/trends', '/browse', '/me', '/setup', '/session', '/walk/live', '/walk/summary'];
const KEPT = /^\/track\/(reading|pressure|walk|session|check-in|workout)\/[^/]+$/;

const under = (p: string, base: string) => p === base || p.startsWith(`${base}/`);
const own = (table: Record<string, string>, key: string) => (Object.hasOwn(table, key) ? table[key] : undefined);

/** `to`, with the old address's query after its own; a key `to` sets itself wins. */
function keep(to: string, search: string): string {
  const old = search.replace(/^\?/, '');
  if (!old) return to;
  const [path, query] = to.split('?');
  if (!query) return `${path}?${old}`;
  const q = new URLSearchParams(query);
  for (const [k, v] of new URLSearchParams(old)) if (!q.has(k)) q.append(k, v);
  return `${path}?${q}`;
}

export function redirectFor(pathname: string, search: string): string | undefined {
  const p = pathname.replace(/\/+$/, '') || '/';
  if (V2_ROOTS.some(r => under(p, r)) || KEPT.test(p)) return undefined;
  const legacy = own(V1_LEGACY, p);
  if (legacy) return redirectFor(legacy, search) ?? keep(legacy, search);
  if (p === '/' || p === '/today') return keep('/home', search);
  if (p === '/move') return keep('/hub/workout', search);
  if (p === '/move/stretch') return keep('/hub/stretch', search);
  if (p === '/move/plan') return keep('/hub/workout/plan', search);
  if (under(p, '/move/exercises')) return keep(p.replace('/move/', '/hub/workout/'), search);
  if (p === '/walk') return keep('/hub/walk', search);
  if (p === '/track') {
    const q = new URLSearchParams(search);
    const view = q.get('view');
    const day = q.get('day');
    q.delete('day'); q.delete('view');
    const rest = q.toString();
    return `${view === 'trends' ? '/trends' : `/day/${day ?? 'today'}`}${rest ? `?${rest}` : ''}`;
  }
  const metric = /^\/track\/metric\/([^/]+)$/.exec(p);
  // A kind v1 never had falls back to Glucose; every kind it had is in METRIC (redirects.test.ts).
  if (metric) return keep(own(METRIC, metric[1]) ?? '/hub/glucose', search);
  if (p === '/track/back') return keep('/hub/back', search);
  if (p === '/track/workout') return keep('/trends/workout', search);
  if (p === '/guide') return keep('/hub/learn', search);
  if (/^\/guide\/(topic|card)\//.test(p) || p === '/guide/sources') return keep(p.replace('/guide/', '/hub/learn/'), search);
  if (p === '/guide/meals') return keep('/hub/food/ideas', search);
  if (p === '/guide/meals/week') return keep('/hub/food/week', search);
  if (under(p, '/guide/meals')) return keep(p.replace('/guide/meals/', '/hub/food/ideas/'), search);
  if (p === '/you') return keep('/me', search);
  if (p === '/you/focus') return keep('/me/profile?chapter=movement', search);
  const you = /^\/you\/([^/]+)$/.exec(p);
  const section = you ? own(YOU, you[1]) : undefined;
  if (section) return keep(`/me/${section}`, search);
  if (under(p, '/welcome')) return keep('/setup', search);
  return '/home?moved=1';
}
