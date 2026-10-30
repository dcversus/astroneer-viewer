import * as THREE from "three";
export interface GroundModel {
  radius(dir: THREE.Vector3): number;
  R: number;
  unitsPerMeter: number;
  allowUnderground(): boolean;
}
interface Pose {
  dir: THREE.Vector3;
  dist: number;
  tilt: number;
  heading: number;
  r?: number;
}
const MAX_TILT = 1.35;
const Y = new THREE.Vector3(0, 1, 0);
export class PlanetCamera {
  readonly camera: THREE.PerspectiveCamera;
  readonly target = new THREE.Vector3();
  autoRotate = true;
  private cur: Pose;
  private goal: Pose;
  private ground: GroundModel;
  private el: HTMLElement;
  private probe: THREE.PerspectiveCamera;
  private flight?: {
    from: Pose;
    to: Pose;
    t0: number;
    ms: number;
    lift: number;
  };
  private drag?: {
    kind: "grab" | "tilt";
    id: number;
    x0: number;
    y0: number;
    grab?: THREE.Vector3;
    pose: Pose;
    hist: {
      t: number;
      dir: THREE.Vector3;
    }[];
  };
  private pointers = new Map<
    number,
    {
      x: number;
      y: number;
    }
  >();
  private pinch?: {
    dist: number;
    angle: number;
    midY: number;
    pose: Pose;
  };
  private fling?: {
    axis: THREE.Vector3;
    speed: number;
  };
  private lastFrame = performance.now();
  private interacted = false;
  private userTilted = false;
  readonly minDist: number;
  constructor(camera: THREE.PerspectiveCamera, el: HTMLElement, ground: GroundModel) {
    this.camera = camera;
    this.probe = camera.clone();
    this.el = el;
    this.ground = ground;
    this.minDist = 6 * ground.unitsPerMeter;
    this.cur = { dir: new THREE.Vector3(0, 0.3, 1).normalize(), dist: ground.R * 2.6, tilt: 0, heading: 0 };
    this.goal = clonePose(this.cur);
    el.addEventListener("pointerdown", this.onDown);
    el.addEventListener("pointermove", this.onMove);
    el.addEventListener("pointerup", this.onUp);
    el.addEventListener("pointercancel", this.onUp);
    el.addEventListener("wheel", this.onWheel, { passive: false });
    el.addEventListener("dblclick", this.onDouble);
    this.apply(this.cur, this.camera);
  }
  setGround(ground: GroundModel): void {
    this.ground = ground;
  }
  get distance(): number {
    return this.cur.dist;
  }
  get heading(): number {
    return this.goal.heading;
  }
  get isClose(): boolean {
    return this.cur.dist < this.ground.R * 0.9;
  }
  flyTo(dir: THREE.Vector3, dist: number, tilt: number, ms = 1200, heading = this.goal.heading, r?: number): void {
    this.interacted = true;
    this.fling = undefined;
    this.userTilted = false;
    const to: Pose = { dir: dir.clone().normalize(), dist: Math.max(this.minDist, dist), tilt: Math.min(tilt, this.maxTilt(dist)), heading, r };
    const ang = Math.acos(THREE.MathUtils.clamp(this.cur.dir.dot(to.dir), -1, 1));
    this.flight = { from: clonePose(this.cur), to, t0: performance.now(), ms, lift: Math.min(this.ground.R * 1.5, ang * this.ground.R * 0.8) };
    this.goal = clonePose(to);
  }
  zoomBy(factor: number): void {
    this.interacted = true;
    this.setDist(this.goal.dist * factor);
  }
  private setDist(d: number): void {
    this.goal.dist = THREE.MathUtils.clamp(d, this.minDist, this.ground.R * 6);
    this.goal.tilt = Math.min(this.goal.tilt, this.maxTilt(this.goal.dist));
  }
  private maxTilt(dist: number): number {
    const R = this.ground.R;
    const t = THREE.MathUtils.clamp(1 - (dist - R * 0.02) / (R * 0.8), 0, 1);
    return THREE.MathUtils.lerp(0.25, MAX_TILT, t * t);
  }
  private pixelAngle(dist = this.cur.dist): number {
    const h = this.el.clientHeight || 1;
    return (2 * dist * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2)) / h / this.ground.R;
  }
  update(): void {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    if (this.flight) {
      const f = this.flight;
      const t = Math.min(1, (now - f.t0) / f.ms);
      const k = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      this.cur.dir = slerp(f.from.dir, f.to.dir, k);
      this.cur.dist = THREE.MathUtils.lerp(f.from.dist, f.to.dist, k) + Math.sin(Math.PI * k) * f.lift;
      this.cur.tilt = THREE.MathUtils.lerp(f.from.tilt, f.to.tilt, k);
      this.cur.heading = lerpAngle(f.from.heading, f.to.heading, k);
      this.cur.r = THREE.MathUtils.lerp(this.lookRadius(f.from), this.lookRadius(f.to), k);
      if (t >= 1) {
        this.flight = undefined;
        this.cur.r = f.to.r;
      }
    } else {
      if (this.fling) {
        const q = new THREE.Quaternion().setFromAxisAngle(this.fling.axis, this.fling.speed * dt);
        this.goal.dir.applyQuaternion(q).normalize();
        this.fling.speed *= Math.exp(-dt * 3);
        if (this.fling.speed < 0.01) this.fling = undefined;
      } else if (this.autoRotate && !this.interacted && !this.drag) {
        this.goal.dir.applyAxisAngle(Y, dt * 0.03).normalize();
      }
      const ease = 1 - Math.exp(-dt * 12);
      this.cur.dir = slerp(this.cur.dir, this.goal.dir, ease);
      this.cur.dist = THREE.MathUtils.lerp(this.cur.dist, this.goal.dist, ease);
      this.cur.tilt = THREE.MathUtils.lerp(this.cur.tilt, this.goal.tilt, ease);
      this.cur.heading = lerpAngle(this.cur.heading, this.goal.heading, ease);
      if (this.cur.r !== undefined || this.goal.r !== undefined) {
        const next = THREE.MathUtils.lerp(this.lookRadius(this.cur), this.lookRadius(this.goal), ease);
        this.cur.r = this.goal.r === undefined && Math.abs(next - this.ground.radius(this.cur.dir)) < 1e-4 ? undefined : next;
      }
    }
    this.apply(this.cur, this.camera);
  }
  private lookRadius(p: Pose): number {
    return p.r ?? this.ground.radius(p.dir);
  }
  private frame(dir: THREE.Vector3): {
    north: THREE.Vector3;
    east: THREE.Vector3;
  } {
    const north = Y.clone().addScaledVector(dir, -dir.dot(Y));
    if (north.lengthSq() < 1e-6) north.set(1, 0, 0);
    north.normalize();
    const east = new THREE.Vector3().crossVectors(north, dir).normalize();
    return { north, east };
  }
  private apply(p: Pose, cam: THREE.PerspectiveCamera): void {
    const dir = p.dir;
    const target = dir.clone().multiplyScalar(this.lookRadius(p));
    const { north, east } = this.frame(dir);
    const forward = north.clone().multiplyScalar(Math.cos(p.heading)).addScaledVector(east, Math.sin(p.heading));
    const pos = target
      .clone()
      .addScaledVector(dir, Math.cos(p.tilt) * p.dist)
      .addScaledVector(forward, -Math.sin(p.tilt) * p.dist);
    if (!this.ground.allowUnderground()) {
      const cd = pos.clone().normalize();
      const floor = this.ground.radius(cd) + 3 * this.ground.unitsPerMeter;
      if (pos.length() < floor) pos.setLength(floor);
    }
    if (cam === this.camera) this.target.copy(target);
    cam.position.copy(pos);
    cam.up.copy(forward);
    cam.lookAt(target);
    cam.updateMatrixWorld();
  }
  groundAt(x: number, y: number, pose = this.cur): THREE.Vector3 | null {
    const rect = this.el.getBoundingClientRect();
    const ndc = new THREE.Vector2(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1);
    this.probe.fov = this.camera.fov;
    this.probe.aspect = this.camera.aspect;
    this.probe.updateProjectionMatrix();
    this.apply(pose, this.probe);
    const rc = new THREE.Raycaster();
    rc.setFromCamera(ndc, this.probe);
    const sphere = new THREE.Sphere(new THREE.Vector3(), this.lookRadius(pose));
    const hit = rc.ray.intersectSphere(sphere, new THREE.Vector3());
    if (!hit) return null;
    const n = hit.clone().normalize();
    if (-rc.ray.direction.dot(n) < 0.25) return null;
    return hit;
  }
  private onDown = (e: PointerEvent): void => {
    this.interacted = true;
    this.fling = undefined;
    this.flight = undefined;
    this.goal.r = undefined;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (
      !(
        e as PointerEvent & {
          forwarded?: boolean;
        }
      ).forwarded
    ) {
      capturePointer(this.el, e.pointerId);
    }
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      this.pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), angle: Math.atan2(b.y - a.y, b.x - a.x), midY: (a.y + b.y) / 2, pose: clonePose(this.goal) };
      this.drag = undefined;
      return;
    }
    if (this.pointers.size > 2) return;
    const tilt = e.button === 2 || e.button === 1 || e.ctrlKey || e.shiftKey;
    const pose = clonePose(this.goal);
    this.drag = {
      kind: tilt ? "tilt" : "grab",
      id: e.pointerId,
      x0: e.clientX,
      y0: e.clientY,
      grab: tilt ? undefined : (this.groundAt(e.clientX, e.clientY, pose) ?? undefined),
      pose,
      hist: [],
    };
  };
  private onMove = (e: PointerEvent): void => {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    p.x = e.clientX;
    p.y = e.clientY;
    if (this.pinch && this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      const midY = (a.y + b.y) / 2;
      const base = this.pinch.pose;
      this.setDist((base.dist * this.pinch.dist) / Math.max(20, d));
      this.goal.heading = base.heading + (ang - this.pinch.angle);
      if (Math.abs(midY - this.pinch.midY) > 12) this.userTilted = true;
      this.goal.tilt = THREE.MathUtils.clamp(base.tilt + (midY - this.pinch.midY) * 0.004, 0, this.maxTilt(this.goal.dist));
      return;
    }
    const d = this.drag;
    if (d?.id !== e.pointerId) return;
    const dx = e.clientX - d.x0,
      dy = e.clientY - d.y0;
    if (d.kind === "tilt") {
      this.userTilted = true;
      this.goal.heading = d.pose.heading + dx * 0.004;
      this.goal.tilt = THREE.MathUtils.clamp(d.pose.tilt + dy * 0.004, 0, this.maxTilt(this.goal.dist));
      return;
    }
    const px = Math.hypot(dx, dy);
    const cap = this.pixelAngle(d.pose.dist) * px * 1.6 + 1e-4;
    let next: THREE.Vector3 | undefined;
    if (d.grab) {
      const here = this.groundAt(e.clientX, e.clientY, d.pose);
      if (here) {
        const q = new THREE.Quaternion().setFromUnitVectors(here.clone().normalize(), d.grab.clone().normalize());
        const ang = 2 * Math.acos(THREE.MathUtils.clamp(Math.abs(q.w), 0, 1));
        if (ang > cap) q.slerp(new THREE.Quaternion(), 1 - cap / ang);
        next = d.pose.dir.clone().applyQuaternion(q).normalize();
      }
    }
    if (!next) {
      const rate = Math.min(this.pixelAngle(d.pose.dist) * 1.2, 0.004);
      const { north, east } = this.frame(d.pose.dir);
      const q = new THREE.Quaternion().setFromAxisAngle(north, -dx * rate).multiply(new THREE.Quaternion().setFromAxisAngle(east, dy * rate));
      next = d.pose.dir.clone().applyQuaternion(q).normalize();
    }
    this.goal.dir = next;
    const now = performance.now();
    d.hist.push({ t: now, dir: next.clone() });
    while (d.hist.length > 6) d.hist.shift();
  };
  private onUp = (e: PointerEvent): void => {
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.pinch = undefined;
    const d = this.drag;
    if (d?.id === e.pointerId) {
      const h = d.hist;
      if (d.kind === "grab" && h.length >= 2 && this.goal.dist > this.ground.R * 0.4) {
        const a = h[0],
          b = h[h.length - 1];
        const dtS = Math.max(0.016, (b.t - a.t) / 1000);
        if (performance.now() - b.t < 80) {
          const axis = new THREE.Vector3().crossVectors(a.dir, b.dir);
          const ang = a.dir.angleTo(b.dir);
          const speed = Math.min(0.6 * (this.goal.dist / (this.ground.R * 3)), ang / dtS);
          if (axis.lengthSq() > 1e-10 && speed > 0.02) this.fling = { axis: axis.normalize(), speed };
        }
      }
      this.drag = undefined;
    }
  };
  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    this.interacted = true;
    this.flight = undefined;
    this.fling = undefined;
    this.goal.r = undefined;
    const factor = Math.exp(THREE.MathUtils.clamp(e.deltaY, -100, 100) * 0.0022);
    this.zoomToward(e.clientX, e.clientY, factor);
  };
  private zoomToward(x: number, y: number, factor: number): void {
    const prev = this.goal.dist;
    this.setDist(prev * factor);
    const next = this.goal.dist;
    if (factor < 1) {
      const g = this.groundAt(x, y, this.goal);
      if (g) {
        const k = 1 - next / prev;
        this.goal.dir = slerp(this.goal.dir, g.normalize(), k).normalize();
      }
      if (!this.userTilted) {
        const R = this.ground.R;
        const lean = 0.95 * THREE.MathUtils.clamp((R * 0.25 - next) / (R * 0.22), 0, 1);
        this.goal.tilt = Math.max(this.goal.tilt, Math.min(lean, this.maxTilt(next)));
      }
    }
  }
  private onDouble = (e: MouseEvent): void => {
    this.zoomToward(e.clientX, e.clientY, 0.45);
  };
  dispose(): void {
    this.el.removeEventListener("pointerdown", this.onDown);
    this.el.removeEventListener("pointermove", this.onMove);
    this.el.removeEventListener("pointerup", this.onUp);
    this.el.removeEventListener("pointercancel", this.onUp);
    this.el.removeEventListener("wheel", this.onWheel);
    this.el.removeEventListener("dblclick", this.onDouble);
  }
}
function capturePointer(el: HTMLElement, id: number): boolean {
  try {
    el.setPointerCapture(id);
    return true;
  } catch {
    return false;
  }
}
function clonePose(p: Pose): Pose {
  return { dir: p.dir.clone(), dist: p.dist, tilt: p.tilt, heading: p.heading, r: p.r };
}
function lerpAngle(a: number, b: number, t: number): number {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
export function slerp(a: THREE.Vector3, b: THREE.Vector3, t: number): THREE.Vector3 {
  const dot = THREE.MathUtils.clamp(a.dot(b), -1, 1);
  if (Math.abs(dot) > 0.9995) return a.clone().lerp(b, t).normalize();
  const theta = Math.acos(dot) * t;
  const rel = b.clone().sub(a.clone().multiplyScalar(dot)).normalize();
  return a
    .clone()
    .multiplyScalar(Math.cos(theta))
    .add(rel.multiplyScalar(Math.sin(theta)));
}
