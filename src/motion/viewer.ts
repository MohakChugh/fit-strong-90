/**
 * The 3D form-demo viewer: one WebGL canvas, the coach character, props, a
 * soft studio light rig and a camera that frames the whole movement.
 * Drag sideways to orbit; double-tap to reset. Renders only while visible.
 */

import {
  ACESFilmicToneMapping, CanvasTexture, CircleGeometry, Color, DirectionalLight, Group, HemisphereLight, Mesh,
  MeshBasicMaterial, PCFShadowMap, PerspectiveCamera, Quaternion, Scene, ShadowMaterial, SRGBColorSpace,
  Vector3, WebGLRenderer,
} from 'three';
import { buildCharacter, loadCharacter, type CharacterMesh, type Palette, DEFAULT_PALETTE } from './character';
import { mirrorClip, sampleDepth, samplePose } from './clip';
import { buildEquipment, type EquipmentRig } from './equipment';
import { Rig } from './rig';
import type { CameraView, Clip, Mistake, MuscleName, Pose } from './types';

export type { CameraView };

export interface ViewerOptions {
  modelUrl: string;
  palette?: Partial<Palette>;
  /** Draw a single frame per clip instead of animating. */
  still?: boolean;
  pixelRatio?: number;
}

/** Muscle tint, −1 (stretching, blue) … 1 (working, orange). */
export type Highlight = Partial<Record<MuscleName, number>>;

const VIEW_YAW: Record<CameraView, number> = { side: 90, otherSide: -90, front: 0, threeQuarter: 38, back: 180, top: 60 };
const DEG = Math.PI / 180;

export class MotionViewer {
  readonly canvas: HTMLCanvasElement;
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(26, 1, 0.05, 40);
  private readonly key: DirectionalLight;
  private readonly props = new Group();
  private character: CharacterMesh | null = null;
  private rig: Rig | null = null;
  private equipment: EquipmentRig | null = null;
  private clip: Clip | null = null;
  /** `id|side` of the clip on screen, so re-setting the same one keeps the view. */
  private shown = '';
  private mistake: Mistake | null = null;
  private mistakeWeight = 0;
  private mistakeTarget = 0;
  private highlight: Highlight = {};
  private phase = 0;
  private span: { from: number; to: number; seconds: number; start: number } | null = null;
  private speed = 1;
  private playing = true;
  private visible = true;
  private last = 0;
  private userYaw = 0;
  private userPitch = 0;
  private frame = { target: new Vector3(0, 0.9, 0), min: new Vector3(-0.4, 0, -0.3), max: new Vector3(0.4, 1.8, 0.3), pitch: 8 };
  private readonly opts: ViewerOptions;
  private readonly observer: IntersectionObserver | null;
  private readonly cleanup: (() => void)[] = [];
  private disposed = false;
  onPhase?: (phase: number) => void;

  constructor(container: HTMLElement, opts: ViewerOptions) {
    this.opts = opts;
    this.renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power', preserveDrawingBuffer: !!opts.still });
    this.renderer.setPixelRatio(Math.min(opts.pixelRatio ?? window.devicePixelRatio ?? 1, 2));
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFShadowMap;
    this.canvas = this.renderer.domElement;
    this.canvas.style.display = 'block';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.touchAction = 'pan-y';
    container.appendChild(this.canvas);

    // Lights: soft sky fill, a warm key that casts the shadow, and a cool rim.
    this.scene.add(new HemisphereLight(0xf4f6ff, 0x9c8a7c, 1.25));
    this.key = new DirectionalLight(0xfff4e8, 2.3);
    this.key.position.set(1.6, 3.2, 2.4);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(1024, 1024);
    this.key.shadow.radius = 4;
    this.key.shadow.bias = -0.0004;
    const sc = this.key.shadow.camera;
    sc.left = -1.8; sc.right = 1.8; sc.top = 2.2; sc.bottom = -1.2; sc.near = 0.5; sc.far = 8;
    this.scene.add(this.key, this.key.target);
    const rim = new DirectionalLight(0xcfe4ff, 1.1);
    rim.position.set(-2, 2.5, -2.5);
    const fill = new DirectionalLight(0xffffff, 0.45);
    fill.position.set(-2.5, 1.2, 2);
    this.scene.add(rim, fill);

    // Floor: a soft spot of light plus a shadow catcher.
    const glow = document.createElement('canvas');
    glow.width = glow.height = 128;
    const g = glow.getContext('2d');
    if (g) {
      const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
      grad.addColorStop(0, 'rgba(255,255,255,0.55)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, 128, 128);
    }
    const floor = new Mesh(new CircleGeometry(2.2, 48), new MeshBasicMaterial({ map: new CanvasTexture(glow), transparent: true, depthWrite: false }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.0005;
    const catcher = new Mesh(new CircleGeometry(2.6, 48), new ShadowMaterial({ opacity: 0.22, color: new Color(0x1d2433) }));
    catcher.rotation.x = -Math.PI / 2;
    catcher.position.y = 0.001;
    catcher.receiveShadow = true;
    this.scene.add(floor, catcher, this.props);

    this.bindPointer();
    const ro = new ResizeObserver(() => this.resize());
    ro.observe(container);
    this.cleanup.push(() => ro.disconnect());
    // A busy main thread can hand over several entries at once, oldest first:
    // only the last says whether the canvas is on screen now.
    this.observer = typeof IntersectionObserver !== 'undefined'
      ? new IntersectionObserver(entries => { this.visible = entries[entries.length - 1].isIntersecting; this.loop(); })
      : null;
    this.observer?.observe(this.canvas);
    const onVis = () => this.loop();
    document.addEventListener('visibilitychange', onVis);
    this.cleanup.push(() => document.removeEventListener('visibilitychange', onVis));
    this.resize();
  }

  async load(): Promise<void> {
    const data = await loadCharacter(this.opts.modelUrl);
    if (this.disposed) return;
    this.character = buildCharacter(data, { ...DEFAULT_PALETTE, ...this.opts.palette });
    this.rig = new Rig(data.bones);
    this.scene.add(this.character.mesh);
    if (this.clip) this.setClip(this.clip);
    this.loop();
  }

  setClip(clip: Clip, opts: { side?: 'left' | 'right'; mistake?: string | null; highlight?: Highlight } = {}): void {
    const side = opts.side === 'right' && clip.sided ? 'right' : 'left';
    // Turning a fault on or off re-sets the same clip: keep the cycle and the
    // viewer's own orbit where they are, and blend into the fault.
    const same = this.shown === `${clip.id}|${side}`;
    this.shown = `${clip.id}|${side}`;
    this.clip = side === 'right' ? mirrorClip(clip) : clip;
    this.highlight = opts.highlight ?? this.highlight;
    if (!same) {
      this.phase = 0;
      this.userYaw = 0;
      this.userPitch = 0;
    }
    // A still frame has no time to blend over, so it snaps.
    this.setMistake(opts.mistake ?? null, !same || !!this.opts.still);
    if (!this.rig || !this.character) return;
    this.equipment?.dispose();
    this.props.clear();
    const fault = this.clip.mistakes?.find(m => m.id === (opts.mistake ?? null));
    this.equipment = buildEquipment(fault?.equipment ?? this.clip.equipment ?? []);
    this.props.add(this.equipment.group);
    this.applyHighlight();
    this.fitCamera();
    this.renderFrame(0);
  }

  setMistake(id: string | null, immediate = false): void {
    const m = id ? this.clip?.mistakes?.find(x => x.id === id) ?? null : null;
    if (m) this.mistake = m;
    this.mistakeTarget = m ? 1 : 0;
    if (immediate) this.mistakeWeight = this.mistakeTarget;
    this.applyHighlight();
    this.loop();
  }

  setHighlight(h: Highlight): void {
    this.highlight = h;
    this.applyHighlight();
    this.loop();
  }

  setPlaying(on: boolean): void { this.playing = on; this.span = null; this.loop(); }

  /**
   * Animate from one cycle phase to another over `seconds` (starting
   * `elapsed` seconds in), then hold: keeps the demo in step with the
   * coach's rep counting.
   */
  playSpan(from: number, to: number, seconds: number, elapsed = 0): void {
    this.span = { from, to, seconds: Math.max(0.05, seconds), start: performance.now() - elapsed * 1000 };
    this.playing = true;
    this.loop();
  }
  setSpeed(s: number): void { this.speed = s; }
  /** Jump to a point in the cycle (0–1), e.g. to sync with the rep counter. */
  setPhase(p: number): void { this.phase = p; if (!this.playing) this.renderFrame(0); }

  dispose(): void {
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    this.observer?.disconnect();
    this.cleanup.forEach(f => f());
    this.equipment?.dispose();
    this.character?.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.canvas.remove();
  }

  private applyHighlight() {
    const c = this.character;
    if (!c) return;
    c.highlight.fill(0);
    c.fault.fill(0);
    for (const [m, v] of Object.entries(this.highlight)) c.highlight[c.muscleId(m as MuscleName)] = v ?? 0;
  }

  private loop() {
    const active = !this.disposed && this.visible && document.visibilityState !== 'hidden'
      && this.character && !this.opts.still && (this.playing || Math.abs(this.mistakeWeight - this.mistakeTarget) > 1e-3);
    if (active) {
      this.last = performance.now();
      this.renderer.setAnimationLoop(now => {
        // 30 fps is smooth for a demo and halves the battery cost over an hour-long session.
        if (now - this.last < 1000 / 30 - 2) return;
        const dt = Math.min(0.1, (now - this.last) / 1000);
        this.last = now;
        this.renderFrame(dt);
      });
    } else {
      this.renderer.setAnimationLoop(null);
      if (this.character) this.renderFrame(0);
    }
  }

  private renderFrame(dt: number) {
    const { rig, character, clip } = this;
    if (!rig || !character || !clip) return;
    if (this.span) {
      const k = Math.min(1, (performance.now() - this.span.start) / 1000 / this.span.seconds);
      this.phase = this.span.from + (this.span.to - this.span.from) * k;
    } else if (this.playing) {
      this.phase += (dt * this.speed) / clip.duration;
      if (this.phase >= 1) this.phase = clip.loopFrom !== undefined ? clip.loopFrom + ((this.phase - 1) % (1 - clip.loopFrom)) : this.phase % 1;
    }
    this.mistakeWeight += Math.sign(this.mistakeTarget - this.mistakeWeight) * Math.min(Math.abs(this.mistakeTarget - this.mistakeWeight), dt * 2.5);
    const pose = samplePose(clip, this.phase, this.mistake, this.mistakeWeight);
    this.pose(pose);
    character.fault.fill(0);
    if (this.mistake && this.mistakeWeight > 0) {
      // The red tint grows as the fault shows (with depth), unless the fault is there throughout.
      const tint = this.mistakeWeight * (this.mistake.constant || this.mistake.keys ? 1 : Math.max(0.25, sampleDepth(clip, this.phase)));
      for (const m of this.mistake.highlight) character.fault[character.muscleId(m)] = tint;
    }
    character.setPulse(0.5 + 0.5 * Math.sin(performance.now() / 380));
    this.equipment?.update(rig, pose);
    this.placeCamera();
    this.renderer.render(this.scene, this.camera);
    this.onPhase?.(this.phase);
  }

  private pose(pose: Pose) {
    const rig = this.rig!;
    const bones = this.character!.bones;
    rig.solve(pose);
    const inv = new Quaternion();
    for (let i = 0; i < bones.length; i++) {
      const p = rig.bones[i].parent;
      if (p < 0) { bones[i].quaternion.identity(); continue; }
      bones[i].quaternion.copy(inv.copy(rig.W[p]).invert().multiply(rig.W[i]));
      if (rig.bones[i].name === 'pelvis') bones[i].position.copy(rig.P[i]);
    }
  }

  /** Frame the whole movement: sample the cycle and fit its joints. */
  private fitCamera() {
    const { rig, clip } = this;
    if (!rig || !clip) return;
    const min = new Vector3(Infinity, Infinity, Infinity);
    const max = new Vector3(-Infinity, -Infinity, -Infinity);
    for (let k = 0; k < 12; k++) {
      rig.solve(samplePose(clip, k / 12));
      for (const p of rig.P) { min.min(p); max.max(p); }
      const head = rig.joint('head');
      const top = head.clone().add(new Vector3(0, 0.2, 0).applyQuaternion(rig.W[rig.i('head')]));
      min.min(top); max.max(top);
    }
    const ignore = new Set(clip.ignoreForCamera ?? []);
    for (const e of this.equipment?.bounds ?? []) {
      if (ignore.has(e.kind)) continue;
      min.min(e.box.min); max.max(e.box.max);
    }
    min.y = Math.min(min.y, 0);
    min.addScalar(-0.08); max.addScalar(0.08);
    const center = clip.focus ? new Vector3(...clip.focus) : min.clone().add(max).multiplyScalar(0.5);
    const lying = max.y - min.y < 0.9;
    this.frame = { target: center, min, max, pitch: lying ? 24 : 6 };
    this.key.target.position.copy(center);
    this.key.position.copy(center).add(new Vector3(1.2, 4.2, 2.0));
  }

  /** Put the camera where the movement's bounding box just fits the view. */
  private placeCamera() {
    const view = this.clip?.view ?? 'threeQuarter';
    const yaw = (VIEW_YAW[view] + this.userYaw) * DEG;
    const pitch = Math.min(70, Math.max(-5, (view === 'top' ? 55 : this.frame.pitch) + this.userPitch)) * DEG;
    const back = new Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
    const right = new Vector3().crossVectors(new Vector3(0, 1, 0), back).normalize();
    const up = new Vector3().crossVectors(back, right);
    const tanV = Math.tan((this.camera.fov * DEG) / 2);
    const tanH = tanV * (this.camera.aspect || 1);
    const { min, max, target } = this.frame;
    let dist = 0.5;
    for (let c = 0; c < 8; c++) {
      const corner = new Vector3(c & 1 ? max.x : min.x, c & 2 ? max.y : min.y, c & 4 ? max.z : min.z).sub(target);
      const z = corner.dot(back);
      dist = Math.max(dist, z + Math.abs(corner.dot(right)) / tanH, z + Math.abs(corner.dot(up)) / tanV);
    }
    this.camera.position.copy(target).addScaledVector(back, dist * 1.03);
    this.camera.lookAt(target);
  }

  private resize() {
    const r = this.canvas.parentElement?.getBoundingClientRect();
    if (!r || r.width < 2 || r.height < 2) return;
    this.renderer.setSize(r.width, r.height, false);
    this.camera.aspect = r.width / r.height;
    this.camera.updateProjectionMatrix();
    if (this.character) this.renderFrame(0);
  }

  private bindPointer() {
    let x0 = 0, y0 = 0, yaw0 = 0, pitch0 = 0, id = -1, lastTap = 0;
    const down = (e: PointerEvent) => {
      id = e.pointerId; x0 = e.clientX; y0 = e.clientY; yaw0 = this.userYaw; pitch0 = this.userPitch;
      const now = performance.now();
      if (now - lastTap < 300) { this.userYaw = 0; this.userPitch = 0; this.renderFrame(0); }
      lastTap = now;
    };
    const move = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      const dx = e.clientX - x0, dy = e.clientY - y0;
      if (Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
      this.userYaw = yaw0 - dx * 0.45;
      this.userPitch = pitch0 + dy * 0.2;
      if (!this.playing || this.opts.still) this.renderFrame(0);
    };
    const up = (e: PointerEvent) => { if (e.pointerId === id) id = -1; };
    this.canvas.addEventListener('pointerdown', down);
    this.canvas.addEventListener('pointermove', move);
    this.canvas.addEventListener('pointerup', up);
    this.canvas.addEventListener('pointercancel', up);
    this.cleanup.push(() => {
      this.canvas.removeEventListener('pointerdown', down);
      this.canvas.removeEventListener('pointermove', move);
      this.canvas.removeEventListener('pointerup', up);
      this.canvas.removeEventListener('pointercancel', up);
    });
  }
}
