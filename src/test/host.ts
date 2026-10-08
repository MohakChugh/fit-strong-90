/**
 * A minimal React host for node tests: renders real components with real
 * hooks, and lets a test fire their real event handlers.
 *
 * Codex's audits drove the app's actual callers — the sheet's handlers, the
 * player's buttons, the save callback — rather than helpers written beside
 * them. There is no DOM library here and no new dependency may be added, so
 * this runs components the way React does at heart: it installs a hooks
 * dispatcher (React resolves every hook through `ReactSharedInternals.H`),
 * calls each function component, keeps hook state per position in the tree,
 * runs effects after each pass and re-renders when state or a subscribed
 * store changes. Host elements become plain nodes a test can search and
 * click. It is not React DOM: no layout, no focus, no browser events.
 */

import * as React from 'react';

type Props = Record<string, unknown> & { children?: unknown };

export interface HostNode {
  type: string;
  props: Props;
  children: HostChild[];
}
export type HostChild = HostNode | string;

interface Slot {
  value?: unknown;
  deps?: readonly unknown[];
  cleanup?: (() => void) | void;
  reducer?: (s: unknown, a: unknown) => unknown;
  setter?: (v: unknown) => void;
  unsubscribe?: () => void;
  subscribe?: unknown;
  getSnapshot?: () => unknown;
}

interface Instance {
  slots: Slot[];
  cursor: number;
  seen: boolean;
}

const ELEMENT = Symbol.for('react.transitional.element');
const LEGACY_ELEMENT = Symbol.for('react.element');
const FRAGMENT = Symbol.for('react.fragment');
const PORTAL = Symbol.for('react.portal');
const FORWARD_REF = Symbol.for('react.forward_ref');
const MEMO = Symbol.for('react.memo');
const CONTEXT = Symbol.for('react.context');
const CONSUMER = Symbol.for('react.consumer');
const SUSPENSE = Symbol.for('react.suspense');
const STRICT = Symbol.for('react.strict_mode');

const internals = (React as unknown as { __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: { H: unknown } })
  .__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;

const changed = (a: readonly unknown[] | undefined, b: readonly unknown[] | undefined) =>
  !a || !b || a.length !== b.length || a.some((x, i) => !Object.is(x, b[i]));

/** What a ref on a host element points at: enough for the effects the app runs. */
const fakeElement = () => ({ scrollIntoView() {}, focus() {}, blur() {}, getBoundingClientRect: () => ({ top: 0, left: 0, width: 0, height: 0 }) });

export class Host {
  private instances = new Map<string, Instance>();
  private effects: (() => void)[] = [];
  private contexts = new Map<unknown, unknown[]>();
  private rendering = false;
  private dirty = false;
  private scheduled = false;
  tree: HostChild[] = [];
  private element: unknown;

  constructor(element: unknown) {
    this.element = element;
    this.flush();
  }

  /** Render again with a new root element, as a parent re-rendering with new props would. */
  update(element: unknown): void {
    this.element = element;
    this.flush();
  }

  /** Run every effect cleanup, as unmounting would. */
  unmount(): void {
    for (const inst of this.instances.values()) for (const s of inst.slots) { if (typeof s.cleanup === 'function') s.cleanup(); s.unsubscribe?.(); }
    this.instances.clear();
    this.tree = [];
  }

  private schedule(): void {
    this.dirty = true;
    if (this.rendering || this.scheduled) return;
    this.scheduled = true;
    queueMicrotask(() => {
      this.scheduled = false;
      this.flush();
    });
  }

  /** Render until nothing changes. */
  flush(): void {
    for (let pass = 0; pass < 100; pass++) {
      this.dirty = false;
      this.rendering = true;
      for (const inst of this.instances.values()) inst.seen = false;
      try {
        this.tree = this.node(this.element, 'root');
      } finally {
        this.rendering = false;
      }
      for (const [key, inst] of this.instances) {
        if (inst.seen) continue;
        for (const s of inst.slots) { if (typeof s.cleanup === 'function') s.cleanup(); s.unsubscribe?.(); }
        this.instances.delete(key);
      }
      const run = this.effects.splice(0);
      for (const e of run) e();
      if (!this.dirty) return;
    }
    throw new Error('host: did not settle after 100 renders');
  }

  private node(n: unknown, path: string): HostChild[] {
    if (n === null || n === undefined || typeof n === 'boolean') return [];
    if (typeof n === 'string' || typeof n === 'number' || typeof n === 'bigint') return [String(n)];
    if (Array.isArray(n)) return n.flatMap((c, i) => this.node(c, `${path}.${(c as { key?: string } | null)?.key ?? i}`));
    const el = n as { $$typeof?: symbol; type?: unknown; props?: Props; key?: string | null; children?: unknown };
    if (el.$$typeof === PORTAL) return this.node(el.children, `${path}/portal`);
    if (el.$$typeof !== ELEMENT && el.$$typeof !== LEGACY_ELEMENT) return [];
    const { type } = el;
    const props = el.props ?? {};
    const here = `${path}${el.key != null ? `:${el.key}` : ''}`;
    if (typeof type === 'string') {
      const ref = props.ref as { current?: unknown } | ((v: unknown) => void) | undefined;
      if (typeof ref === 'function') ref(fakeElement());
      else if (ref && typeof ref === 'object') ref.current = fakeElement();
      return [{ type, props, children: this.node(props.children, `${here}/${type}`) }];
    }
    if (type === FRAGMENT || type === SUSPENSE || type === STRICT) return this.node(props.children, here);
    if (typeof type === 'function') {
      const fn = type as ((p: Props) => unknown) & { prototype?: { isReactComponent?: unknown } };
      if (fn.prototype?.isReactComponent) throw new Error(`host: class components are not supported (${fn.name})`);
      return this.call(fn, props, `${here}/${fn.name || 'anon'}`);
    }
    const t = type as { $$typeof?: symbol; render?: (p: Props, ref: unknown) => unknown; type?: unknown; _context?: unknown };
    if (t?.$$typeof === FORWARD_REF) return this.call(p => t.render!(p, p.ref ?? null), props, `${here}/fwd`);
    if (t?.$$typeof === MEMO) return this.node({ ...el, type: t.type }, here);
    if (t?.$$typeof === CONTEXT) {
      const stack = this.contexts.get(t) ?? [];
      stack.push(props.value);
      this.contexts.set(t, stack);
      try { return this.node(props.children, `${here}/ctx`); } finally { stack.pop(); }
    }
    if (t?.$$typeof === CONSUMER) {
      const value = this.read(t._context);
      return this.node((props.children as (v: unknown) => unknown)(value), `${here}/consumer`);
    }
    return [];
  }

  private read(ctx: unknown): unknown {
    const stack = this.contexts.get(ctx);
    return stack && stack.length ? stack[stack.length - 1] : (ctx as { _currentValue?: unknown })._currentValue;
  }

  private call(fn: (p: Props) => unknown, props: Props, path: string): HostChild[] {
    let inst = this.instances.get(path);
    if (!inst) { inst = { slots: [], cursor: 0, seen: true }; this.instances.set(path, inst); }
    inst.seen = true;
    inst.cursor = 0;
    const previous = internals.H;
    internals.H = this.dispatcher(inst, path);
    let out: unknown;
    try { out = fn(props); } finally { internals.H = previous; }
    return this.node(out, path);
  }

  private dispatcher(inst: Instance, path: string) {
    const slot = (): Slot => {
      const i = inst.cursor++;
      return (inst.slots[i] ??= {});
    };
    const effect = (create: () => (() => void) | void, deps?: readonly unknown[]) => {
      const s = slot();
      if (deps && !changed(s.deps, deps)) return;
      s.deps = deps;
      this.effects.push(() => {
        if (typeof s.cleanup === 'function') s.cleanup();
        s.cleanup = create();
      });
    };
    return {
      readContext: (ctx: unknown) => this.read(ctx),
      useContext: (ctx: unknown) => this.read(ctx),
      use: (usable: { $$typeof?: symbol }) => {
        if (usable?.$$typeof === CONTEXT) return this.read(usable);
        throw new Error('host: use(promise) is not supported');
      },
      useState: (init: unknown) => {
        const s = slot();
        if (!s.setter) {
          s.value = typeof init === 'function' ? (init as () => unknown)() : init;
          s.setter = (v: unknown) => {
            const next = typeof v === 'function' ? (v as (p: unknown) => unknown)(s.value) : v;
            if (Object.is(next, s.value)) return;
            s.value = next;
            this.schedule();
          };
        }
        return [s.value, s.setter];
      },
      useReducer: (reducer: (s: unknown, a: unknown) => unknown, arg: unknown, init?: (a: unknown) => unknown) => {
        const s = slot();
        s.reducer = reducer;
        if (!s.setter) {
          s.value = init ? init(arg) : arg;
          s.setter = (action: unknown) => {
            const next = s.reducer!(s.value, action);
            if (Object.is(next, s.value)) return;
            s.value = next;
            this.schedule();
          };
        }
        return [s.value, s.setter];
      },
      useRef: (init: unknown) => {
        const s = slot();
        if (!s.setter) { s.value = { current: init }; s.setter = () => {}; }
        return s.value;
      },
      useMemo: (create: () => unknown, deps?: readonly unknown[]) => {
        const s = slot();
        if (!deps || changed(s.deps, deps)) { s.value = create(); s.deps = deps; }
        return s.value;
      },
      useCallback: (fn: unknown, deps?: readonly unknown[]) => {
        const s = slot();
        if (!deps || changed(s.deps, deps)) { s.value = fn; s.deps = deps; }
        return s.value;
      },
      useEffect: effect,
      useLayoutEffect: effect,
      useInsertionEffect: effect,
      useImperativeHandle: (ref: { current?: unknown } | ((v: unknown) => void) | null, create: () => unknown, deps?: readonly unknown[]) =>
        effect(() => {
          const v = create();
          if (typeof ref === 'function') ref(v); else if (ref) ref.current = v;
        }, deps),
      useSyncExternalStore: (subscribe: (cb: () => void) => () => void, getSnapshot: () => unknown) => {
        const s = slot();
        s.getSnapshot = getSnapshot;
        if (s.subscribe !== subscribe) {
          s.unsubscribe?.();
          s.subscribe = subscribe;
          s.unsubscribe = subscribe(() => {
            if (!Object.is(s.getSnapshot!(), s.value)) this.schedule();
          });
        }
        s.value = getSnapshot();
        return s.value;
      },
      useId: () => {
        const s = slot();
        if (s.value === undefined) s.value = `:h${path.length}-${inst.cursor}:`;
        return s.value;
      },
      useDebugValue: () => {},
      useDeferredValue: (v: unknown) => v,
      useTransition: () => [false, (fn: () => void) => fn()],
      useOptimistic: (v: unknown) => [v, () => {}],
      useActionState: () => { throw new Error('host: useActionState is not supported'); },
      useFormState: () => { throw new Error('host: useFormState is not supported'); },
      useHostTransitionStatus: () => null,
      useMemoCache: (size: number) => {
        const s = slot();
        s.value ??= Array.from({ length: size }, () => Symbol.for('react.memo_cache_sentinel'));
        return s.value;
      },
      useCacheRefresh: () => () => {},
      useEffectEvent: (fn: unknown) => fn,
    };
  }

  // ─── Reading and using what was rendered ──────────────────────────────────

  /** Every host node, depth first. */
  all(): HostNode[] {
    const out: HostNode[] = [];
    const walk = (list: HostChild[]) => { for (const c of list) if (typeof c !== 'string') { out.push(c); walk(c.children); } };
    walk(this.tree);
    return out;
  }

  /** All the text on screen, as one string. */
  text(): string {
    return textOf(this.tree);
  }

  /** The button whose text or accessible name contains `name` (exactly, when `exact`). */
  button(name: string | RegExp, opts: { exact?: boolean } = {}): HostNode {
    const found = this.buttons(name, opts);
    if (!found.length) throw new Error(`host: no button "${String(name)}". Buttons: ${this.all().filter(isButton).map(labelOf).join(' | ')}`);
    return found[0];
  }

  /** Buttons whose text or accessible name matches. */
  buttons(name: string | RegExp, opts: { exact?: boolean } = {}): HostNode[] {
    return this.all().filter(n => isButton(n) && matches(labelOf(n), name, opts.exact));
  }

  /** The form control labelled `label` (by aria-label, or by a label element's text). */
  field(label: string | RegExp): HostNode {
    const nodes = this.all();
    const direct = nodes.find(n => (n.type === 'input' || n.type === 'select' || n.type === 'textarea') && matches(String(n.props['aria-label'] ?? ''), label));
    if (direct) return direct;
    const lab = nodes.find(n => n.type === 'label' && matches(textOf(n.children), label));
    if (lab?.props.htmlFor) {
      const byId = nodes.find(n => n.props.id === lab.props.htmlFor);
      if (byId) return byId;
    }
    const inside = lab && allIn(lab.children).find(n => n.type === 'input');
    if (inside) return inside;
    throw new Error(`host: no field "${String(label)}"`);
  }

  /** A press, then everything it set off. */
  async click(node: HostNode): Promise<void> {
    if (node.props.disabled) throw new Error(`host: "${labelOf(node)}" is disabled`);
    // A checkbox or radio changes on a click.
    if (node.type === 'input' && (node.props.type === 'checkbox' || node.props.type === 'radio') && !node.props.onClick) {
      return this.change(node, { checked: node.props.type === 'radio' ? true : !node.props.checked });
    }
    const handler = (node.props.onClick ?? node.props.onToggle) as ((e: unknown) => unknown) | undefined;
    if (!handler) {
      // A checkbox inside a label: the label's click reaches the input.
      const input = node.type === 'label' ? allIn(node.children).find(n => n.type === 'input') : undefined;
      if (input) return this.change(input, { checked: !input.props.checked });
      throw new Error(`host: "${labelOf(node)}" has no click handler`);
    }
    await handler(fakeEvent());
    await this.settle();
  }

  /** Typing into a field, or ticking a box. */
  async change(node: HostNode, target: { value?: string; checked?: boolean }): Promise<void> {
    const handler = node.props.onChange as ((e: unknown) => unknown) | undefined;
    if (!handler) throw new Error('host: that field has no change handler');
    await handler({ ...fakeEvent(), target: { ...target, value: target.value ?? '' }, currentTarget: target });
    await this.settle();
  }

  /** Let promises, storage writes and the renders they cause finish. */
  async settle(rounds = 6): Promise<void> {
    for (let i = 0; i < rounds; i++) {
      await new Promise(r => setTimeout(r, 0));
      this.flush();
    }
  }
}

const isButton = (n: HostNode) => n.type === 'button' || n.props.role === 'button';

function labelOf(n: HostNode): string {
  return `${String(n.props['aria-label'] ?? '')} ${textOf(n.children)}`.trim();
}

function matches(text: string, name: string | RegExp, exact = false): boolean {
  if (typeof name !== 'string') return name.test(text);
  return exact ? text.trim() === name : text.includes(name);
}

function allIn(list: HostChild[]): HostNode[] {
  const out: HostNode[] = [];
  for (const c of list) if (typeof c !== 'string') { out.push(c); out.push(...allIn(c.children)); }
  return out;
}

export function textOf(list: HostChild[]): string {
  return list.map(c => (typeof c === 'string' ? c : textOf(c.children))).join(' ').replace(/\s+/g, ' ').trim();
}

function fakeEvent() {
  return { preventDefault() {}, stopPropagation() {}, nativeEvent: {}, defaultPrevented: false };
}

/** Render `element` in a new host. */
export function render(element: unknown): Host {
  return new Host(element);
}
