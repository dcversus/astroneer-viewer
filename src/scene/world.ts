import * as THREE from "three";
import { PlanetCamera } from "./camera.ts";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { CATEGORIES, CATEGORY, PLANETS } from "../model/catalog.ts";
import type { CategoryId, Entity, Link, Planet } from "../model/types.ts";
import { MODELS, appearanceFor, modelSize } from "./models.ts";
import { makeNoise3 } from "./noise.ts";
import { R, buildHeightField, buildTerrainMesh, terrainMaterial, toDir, type HeightField } from "./terrain.ts";
export { R };
const UNDERGROUND_CM = -1500;
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const IMPORTANCE: Record<CategoryId, number> = {
  player: 1,
  start: 1,
  gateway: 0.9,
  death: 0.8,
  backpack: 0.8,
  beacon: 0.9,
  vehicle: 0.8,
  landing: 0.45,
  base: 0.42,
  puzzle: 0.6,
  research: 0.45,
  wreck: 0.4,
  lore: 0.6,
  critter: 0.4,
  power: 0.3,
  tether: 0.22,
  flora: 0.18,
  resource: 0.25,
  hazard: 0.3,
  item: 0.2,
  storm: 0.6,
  other: 0.2,
};
const CLUTTER_HIDE = 34;
const MAX_PIN_METERS = 110;
const PIN_IMPORTANCE = 0.55;
const LABEL_CATS = new Set<CategoryId>(["player", "start", "vehicle", "beacon", "gateway", "landing", "lore"]);
const NO_PIN = new Set<CategoryId>(["tether"]);
const PIN_SPRITE = 64;
const TERRAIN_SHRINK = 0.97;
const pinVertex = `
  uniform float uSize; uniform float uViewH;
  attribute float aHide; attribute float aScale;
  varying float vHide;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vec4 clip = projectionMatrix * mv;
    float s = uSize * aScale;
    gl_PointSize = s;
    // the pin's tip sits on the anchor, so the sprite is shifted up by the tip offset
    clip.y += 0.42 * s * 2.0 / uViewH * clip.w;
    gl_Position = clip;
    vHide = aHide;
  }`;
const pinFragment = `
  uniform sampler2D uMap; uniform float uOpacity;
  varying float vHide;
  void main() {
    if (vHide > 0.5) discard;
    vec4 c = texture2D(uMap, gl_PointCoord);
    if (c.a < 0.05) discard;
    gl_FragColor = vec4(c.rgb, c.a * uOpacity);
  }`;
function pinTexture(color: string, glyph: string): THREE.Texture {
  const s = 128;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const g = c.getContext("2d")!;
  const cx = 64,
    cy = 44,
    r = 34,
    tipY = 118;
  const path = () => {
    g.beginPath();
    const a = Math.asin(r / (tipY - cy));
    g.arc(cx, cy, r, Math.PI / 2 - a + Math.PI, Math.PI / 2 + a - Math.PI, false);
    g.arc(cx, cy, r, Math.PI / 2 + a, Math.PI / 2 - a, true);
    g.lineTo(cx, tipY);
    g.closePath();
  };
  g.shadowColor = "rgba(0,0,0,0.45)";
  g.shadowBlur = 8;
  g.shadowOffsetY = 3;
  path();
  g.fillStyle = color;
  g.fill();
  g.shadowColor = "transparent";
  g.lineWidth = 5;
  g.strokeStyle = "rgba(20, 16, 50, 0.9)";
  path();
  g.stroke();
  g.beginPath();
  g.arc(cx, cy, 23, 0, Math.PI * 2);
  g.fillStyle = "rgba(255,255,255,0.92)";
  g.fill();
  g.fillStyle = "#1b1640";
  g.font = `700 30px "Rubik", system-ui, sans-serif`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(glyph, cx, cy + 1);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
interface Inst {
  entity: Entity;
  dir: THREE.Vector3;
  radius: number;
  quat: THREE.Quaternion;
  underground: boolean;
  importance: number;
  maxScale: number;
  index: number;
  model: string;
  height: number;
  pinLayer?: PinLayer;
  pinIndex: number;
  screen?: {
    x: number;
    y: number;
  };
}
interface PinLayer {
  cat: CategoryId;
  points: THREE.Points;
  material: THREE.ShaderMaterial;
  insts: Inst[];
  pos: Float32Array;
  hide: Float32Array;
}
export interface LabelTarget {
  entity: Entity;
  x: number;
  y: number;
}
export interface Cluster {
  x: number;
  y: number;
  count: number;
  color: string;
  dir: THREE.Vector3;
}
interface ModelMesh {
  mesh: THREE.InstancedMesh;
  glow?: THREE.InstancedMesh;
  ghost?: THREE.InstancedMesh;
  insts: Inst[];
}
interface Decor {
  mesh: THREE.InstancedMesh;
  mats: THREE.Matrix4[];
}
export interface WorldHandlers {
  onHover(entity: Entity | null, x: number, y: number): void;
  onPick(entity: Entity | null): void;
}
export class World {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly cam: PlanetCamera;
  private group = new THREE.Group();
  private terrain?: THREE.Mesh;
  private terrainMat = terrainMaterial();
  private atmosphere?: THREE.Mesh;
  private atmosphereMat: THREE.ShaderMaterial;
  private field?: HeightField;
  private planet?: Planet;
  private models = new Map<string, ModelMesh>();
  private decor: Decor[] = [];
  private nearDecor: THREE.InstancedMesh[] = [];
  private pins?: THREE.InstancedMesh;
  private pinInsts: Inst[] = [];
  private ghostMat = new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, opacity: 0.42, depthWrite: false, roughness: 0.8 });
  private tetherLines?: LineSegments2;
  private powerLines?: LineSegments2;
  private tunnelLines?: LineSegments2;
  private lineMats: LineMaterial[] = [];
  private pinLayers = new Map<CategoryId, PinLayer>();
  private pinTextures = new Map<CategoryId, THREE.Texture>();
  private allLinks: Link[] = [];
  private grow = 0;
  private inside = 0;
  private clusterList: Cluster[] = [];
  private keep = new Set<number>();
  clusterCell = 64;
  private hemi: THREE.HemisphereLight;
  private stars!: THREE.Points;
  private skyColor = new THREE.Color("#8fd3ff");
  private fog = new THREE.Fog("#8fd3ff", 1e6, 1e7);
  private sun: THREE.DirectionalLight;
  private selectRing: THREE.Mesh;
  private hoverRing: THREE.Mesh;
  private visible = new Set<CategoryId>();
  private xray = false;
  private hovered: Entity | null = null;
  private selected: Entity | null = null;
  private raf = 0;
  private lastGrow = -1;
  private dirty = true;
  private handlers: WorldHandlers;
  private container: HTMLElement;
  private downAt?: {
    x: number;
    y: number;
    t: number;
  };
  private raycaster = new THREE.Raycaster();
  private focusDir = new THREE.Vector3(0, 0.3, 1).normalize();
  private cache = new Map<
    string,
    {
      field: HeightField;
      geo: THREE.BufferGeometry;
    }
  >();
  private lastPickAt = 0;
  constructor(container: HTMLElement, handlers: WorldHandlers) {
    this.container = container;
    this.handlers = handlers;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.01, 2000);
    this.camera.position.set(0, 8, 44);
    this.cam = new PlanetCamera(this.camera, this.renderer.domElement, {
      radius: (d) => this.surfacePoint(d),
      R,
      unitsPerMeter: R / 1200,
      allowUnderground: () => this.xray,
    });
    this.cam.autoRotate = !reducedMotion();
    for (const c of CATEGORIES) this.pinTextures.set(c.id, pinTexture(c.color, c.glyph));
    this.scene.add(this.group);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.22));
    this.hemi = new THREE.HemisphereLight(0xbfd8ff, 0x3a3a55, 0.75);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff3e0, 2.6);
    this.sun.position.set(40, 26, 30);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.00004;
    this.sun.shadow.normalBias = 0.0006;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
    this.stars = this.starfield();
    this.scene.add(this.stars);
    this.scene.fog = this.fog;
    this.atmosphereMat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color("#7fd6ff") } },
      vertexShader: `
        varying vec3 vN; varying vec3 vV;
        void main() {
          vN = normalize(normalMatrix * normal);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vV = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform vec3 uColor; varying vec3 vN; varying vec3 vV;
        void main() {
          float rim = pow(clamp(0.72 - dot(vN, vV), 0.0, 1.0), 2.6);
          gl_FragColor = vec4(uColor, 1.0) * rim * 1.5;
        }`,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });
    const ring = (color: string) =>
      new THREE.Mesh(new THREE.TorusGeometry(1, 0.08, 8, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, depthTest: false }));
    this.selectRing = ring("#ffb547");
    this.hoverRing = ring("#f4f1ff");
    for (const r of [this.selectRing, this.hoverRing]) {
      r.visible = false;
      r.renderOrder = 20;
      this.group.add(r);
    }
    const el = this.renderer.domElement;
    el.addEventListener("pointermove", (e) => this.pointerMove(e));
    el.addEventListener("pointerleave", () => this.setHover(null, 0, 0));
    const forwarded = (e: Event) =>
      (
        e as Event & {
          forwarded?: boolean;
        }
      ).forwarded === true;
    el.addEventListener("pointerdown", (e) => {
      if (!forwarded(e)) this.downAt = { x: e.clientX, y: e.clientY, t: performance.now() };
    });
    el.addEventListener("pointerup", (e) => {
      if (!forwarded(e)) this.pointerUp(e);
    });
    el.addEventListener("contextmenu", (e) => e.preventDefault());
    new ResizeObserver(() => this.resize()).observe(container);
    this.resize();
    document.addEventListener("visibilitychange", () => (document.hidden ? cancelAnimationFrame(this.raf) : this.loop()));
    this.loop();
  }
  private starfield(): THREE.Points {
    const n = 4000;
    const p = new Float32Array(n * 3);
    const c = new Float32Array(n * 3);
    const tint = [new THREE.Color("#ffffff"), new THREE.Color("#c9bfff"), new THREE.Color("#ffe3b8"), new THREE.Color("#a8e9ff")];
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(600 + Math.random() * 500);
      p.set([v.x, v.y, v.z], i * 3);
      const t = tint[i % tint.length].clone().multiplyScalar(0.3 + Math.random() * 0.7);
      c.set([t.r, t.g, t.b], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(p, 3));
    g.setAttribute("color", new THREE.BufferAttribute(c, 3));
    return new THREE.Points(
      g,
      new THREE.PointsMaterial({ size: 1.5, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false }),
    );
  }
  setPlanet(planet: Planet, entities: Entity[], focus?: Entity, links: Link[] = []): void {
    this.planet = planet;
    this.allLinks = links;
    const meta = PLANETS[planet.id];
    const mine = entities.filter((e) => e.planet === planet.id);
    const key = `${planet.id}:${planet.seed ?? 0}:${mine.length}`;
    let cached = this.cache.get(key);
    if (!cached) {
      const field = buildHeightField(planet, meta, mine);
      cached = { field, geo: buildTerrainMesh(field, meta, planet.id === "Space" ? 24 : 56) };
      this.cache.set(key, cached);
    }
    this.field = cached.field;
    this.clearPlanet();
    this.terrain = new THREE.Mesh(cached.geo, this.terrainMat);
    this.terrain.receiveShadow = true;
    if (planet.id === "Space") this.terrain.scale.setScalar(0.25);
    this.group.add(this.terrain);
    this.atmosphere = new THREE.Mesh(new THREE.SphereGeometry(R * 1.14, 64, 48), this.atmosphereMat);
    (this.atmosphereMat.uniforms.uColor.value as THREE.Color).set(meta.colors[3]);
    this.atmosphere.visible = planet.id !== "Space";
    this.group.add(this.atmosphere);
    this.hemi.color.set(meta.colors[3]);
    this.hemi.groundColor.set(meta.terrain.low);
    this.skyColor.set(planet.id === "Space" ? "#141a33" : meta.colors[3]);
    this.fog.color.copy(this.skyColor);
    this.cam.setGround({ radius: (d) => this.surfacePoint(d), R, unitsPerMeter: this.field.unitsPerMeter, allowUnderground: () => this.xray });
    this.buildInstances(mine);
    this.buildPins();
    this.buildDecor(mine, meta);
    this.buildNearDecor(mine, meta);
    this.buildLinks(mine);
    const f = focus ?? mine.find((e) => e.cat === "player") ?? mine.find((e) => e.cat === "start") ?? mine[0];
    this.focusDir = f ? toDir(f) : new THREE.Vector3(0, 0.3, 1).normalize();
    const side = new THREE.Vector3().crossVectors(this.focusDir, new THREE.Vector3(0, 1, 0)).normalize();
    if (side.lengthSq() < 0.01) side.set(1, 0, 0);
    this.sun.position
      .copy(this.focusDir)
      .multiplyScalar(0.75)
      .addScaledVector(side, 0.6)
      .add(new THREE.Vector3(0, 0.35, 0))
      .normalize()
      .multiplyScalar(120);
    this.selected = null;
    this.selectRing.visible = false;
    this.setHover(null, 0, 0);
    this.applyVisibility();
    this.applyXray();
    this.dirty = true;
  }
  private clearPlanet(): void {
    for (const obj of [this.terrain, this.atmosphere, this.tetherLines, this.powerLines, this.tunnelLines, this.pins]) if (obj) this.group.remove(obj);
    for (const l of this.pinLayers.values()) {
      this.group.remove(l.points);
      l.points.geometry.dispose();
      l.material.dispose();
    }
    this.pinLayers.clear();
    for (const m of this.models.values()) {
      this.group.remove(m.mesh);
      if (m.glow) this.group.remove(m.glow);
      if (m.ghost) this.group.remove(m.ghost);
      m.mesh.dispose();
      m.glow?.dispose();
      m.ghost?.dispose();
    }
    for (const d of this.decor) {
      this.group.remove(d.mesh);
      d.mesh.dispose();
    }
    for (const m of this.nearDecor) {
      this.group.remove(m);
      m.dispose();
    }
    this.models.clear();
    this.decor = [];
    this.nearDecor = [];
    this.pinInsts = [];
    this.tetherLines?.geometry.dispose();
    this.powerLines?.geometry.dispose();
    this.tunnelLines?.geometry.dispose();
    this.tetherLines = undefined;
    this.powerLines = undefined;
    this.tunnelLines = undefined;
    this.pins = undefined;
  }
  private surfacePoint(dir: THREE.Vector3, liftM = 0): number {
    if (!this.field) return R + liftM * (R / 1200);
    return this.field.radius(dir) + liftM * this.field.unitsPerMeter;
  }
  private orientation(e: Entity, dir: THREE.Vector3): THREE.Quaternion {
    const [qx, qy, qz, qw] = e.rot ?? [0, 0, 0, 1];
    const q = new THREE.Quaternion(qx, qz, qy, -qw);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
    if (up.dot(dir) > 0.85) return q;
    const base = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    const yaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (e.id * 2.399) % (Math.PI * 2));
    return base.multiply(yaw);
  }
  private buildInstances(mine: Entity[]): void {
    const byModel = new Map<
      string,
      {
        e: Entity;
        tint?: string;
      }[]
    >();
    for (const e of mine) {
      const a = appearanceFor(e);
      const list = byModel.get(a.model) ?? [];
      list.push({ e, tint: a.tint });
      byModel.set(a.model, list);
    }
    const white = new THREE.Color("#ffffff");
    const m4 = new THREE.Matrix4();
    const pinList: Inst[] = [];
    for (const [model, list] of byModel) {
      const def = MODELS[model] ?? MODELS.marker;
      const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0.05 });
      const mesh = new THREE.InstancedMesh(def.geometry, mat, list.length);
      mesh.frustumCulled = false;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      let glow: THREE.InstancedMesh | undefined;
      if (def.glow) {
        glow = new THREE.InstancedMesh(def.glow, new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }), list.length);
        glow.frustumCulled = false;
      }
      const insts: Inst[] = [];
      list.forEach(({ e, tint }, i) => {
        const dir = toDir(e);
        const underground = e.alt < UNDERGROUND_CM && e.planet !== "Space";
        const realRadius = (e.dist / this.planet!.radius) * R;
        const radius = underground ? realRadius : this.planet!.id === "Space" ? realRadius : this.surfacePoint(dir, 0.1);
        const inst: Inst = {
          entity: e,
          dir,
          radius,
          quat: this.orientation(e, dir),
          underground,
          importance: IMPORTANCE[e.cat] ?? 0.3,
          maxScale: MAX_PIN_METERS / modelSize(def),
          index: i,
          model,
          height: def.height,
          pinIndex: -1,
        };
        insts.push(inst);
        if (underground && inst.importance >= PIN_IMPORTANCE) pinList.push(inst);
        const c = tint ? new THREE.Color(tint) : white;
        mesh.setColorAt(i, c);
        glow?.setColorAt(i, c);
        m4.identity();
        mesh.setMatrixAt(i, m4);
        glow?.setMatrixAt(i, m4);
      });
      mesh.userData.model = model;
      this.group.add(mesh);
      if (glow) this.group.add(glow);
      const ghost: THREE.InstancedMesh | undefined = undefined;
      this.models.set(model, { mesh, glow, ghost, insts });
    }
  }
  private buildDecor(mine: Entity[], meta: (typeof PLANETS)[keyof typeof PLANETS]): void {
    const pal = meta.terrain;
    if (!this.field || pal.trees <= 0) return;
    const rnd = mulberry(this.planet!.seed ?? 7);
    const biome = makeNoise3((this.planet!.seed ?? 7) ^ 0x1234567);
    const built = mine.filter((e) => ["base", "start", "vehicle", "landing", "power", "beacon", "player", "wreck", "gateway"].includes(e.cat)).map(toDir);
    const clear = Math.min(0.08, 14 / (this.planet!.radius / 100));
    const total = Math.round(3200 * pal.trees);
    const kinds: Record<
      string,
      {
        dirs: THREE.Vector3[];
        scale: number[];
        tint: string;
      }
    > = {
      mushroomTree: { dirs: [], scale: [], tint: pal.decor.canopy },
      tree: { dirs: [], scale: [], tint: pal.decor.canopy },
      bush: { dirs: [], scale: [], tint: pal.decor.grass },
      grass: { dirs: [], scale: [], tint: pal.decor.grass },
      rock: { dirs: [], scale: [], tint: pal.decor.rock },
      boulder: { dirs: [], scale: [], tint: pal.decor.rock },
    };
    const d = new THREE.Vector3();
    const dx = new THREE.Vector3();
    for (let i = 0; i < total * 3 && Object.values(kinds).reduce((a, k) => a + k.dirs.length, 0) < total; i++) {
      d.set(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1);
      if (d.lengthSq() > 1 || d.lengthSq() < 0.05) continue;
      d.normalize();
      if (built.some((b) => b.dot(d) > Math.cos(clear))) continue;
      const h = this.field.height(d);
      dx.copy(d)
        .add(new THREE.Vector3(0.004, 0, 0))
        .normalize();
      const slope = Math.abs(this.field.height(dx) - h) / (0.004 * (this.planet!.radius / 100));
      const forest = this.field.forest(d);
      const b = biome(d.x * 6, d.y * 6, d.z * 6);
      let kind: string;
      if (slope > 0.6 || h > 70) kind = rnd() < 0.3 ? "boulder" : "rock";
      else if (forest > 0.5 && rnd() < forest) kind = rnd() < 0.7 ? "mushroomTree" : "tree";
      else if (b > 0.25) kind = rnd() < 0.5 ? "bush" : "grass";
      else kind = rnd() < 0.15 ? "rock" : rnd() < 0.5 ? "grass" : "tree";
      kinds[kind].dirs.push(d.clone());
      kinds[kind].scale.push(0.7 + rnd() * 0.7);
    }
    for (const [name, k] of Object.entries(kinds)) {
      if (!k.dirs.length) continue;
      const def = MODELS[name];
      const mesh = new THREE.InstancedMesh(def.geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), k.dirs.length);
      mesh.frustumCulled = false;
      mesh.castShadow = true;
      const tint = new THREE.Color(k.tint);
      const mats: THREE.Matrix4[] = [];
      k.dirs.forEach((dir, i) => {
        const q = new THREE.Quaternion()
          .setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)
          .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * Math.PI * 2));
        const pos = dir.clone().multiplyScalar(this.surfacePoint(dir, -0.05));
        const s = k.scale[i];
        mats.push(new THREE.Matrix4().compose(pos, q, new THREE.Vector3(s, s, s)));
        mesh.setColorAt(i, tint.clone().multiplyScalar(0.85 + rnd() * 0.3));
      });
      this.group.add(mesh);
      this.decor.push({ mesh, mats });
    }
  }
  private buildNearDecor(mine: Entity[], meta: (typeof PLANETS)[keyof typeof PLANETS]): void {
    const pal = meta.terrain;
    if (!this.field || pal.trees <= 0 || this.planet!.id === "Space") return;
    const rnd = mulberry((this.planet!.seed ?? 7) ^ 0xabcdef);
    const built = mine.filter((e) => ["base", "start", "landing", "gateway"].includes(e.cat)).map(toDir);
    const radiusM = this.planet!.radius / 100;
    const clear = 9 / radiusM;
    const total = Math.round(14000 * Math.min(1, pal.trees + 0.3));
    const kinds: Record<
      string,
      {
        mats: THREE.Matrix4[];
        tint: string;
      }
    > = {
      grass: { mats: [], tint: pal.decor.grass },
      bush: { mats: [], tint: pal.decor.grass },
      rock: { mats: [], tint: pal.decor.rock },
      tree: { mats: [], tint: pal.decor.canopy },
    };
    const d = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < total * 2 && Object.values(kinds).reduce((a, k) => a + k.mats.length, 0) < total; i++) {
      d.set(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1);
      if (d.lengthSq() > 1 || d.lengthSq() < 0.05) continue;
      d.normalize();
      if (built.some((b) => b.dot(d) > Math.cos(clear))) continue;
      const forest = this.field.forest(d);
      const r = rnd();
      const kind = r < 0.55 ? "grass" : r < 0.75 ? "bush" : r < 0.88 ? "rock" : forest > 0.45 ? "tree" : "grass";
      const q = new THREE.Quaternion().setFromUnitVectors(up, d).multiply(new THREE.Quaternion().setFromAxisAngle(up, rnd() * Math.PI * 2));
      const s = (0.6 + rnd() * 0.9) * this.field.unitsPerMeter;
      kinds[kind].mats.push(new THREE.Matrix4().compose(d.clone().multiplyScalar(this.surfacePoint(d, -0.05)), q, new THREE.Vector3(s, s, s)));
    }
    for (const [name, k] of Object.entries(kinds)) {
      if (!k.mats.length) continue;
      const mesh = new THREE.InstancedMesh(MODELS[name].geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), k.mats.length);
      mesh.castShadow = name !== "grass";
      mesh.receiveShadow = true;
      const tint = new THREE.Color(k.tint);
      k.mats.forEach((m, i) => {
        mesh.setMatrixAt(i, m);
        mesh.setColorAt(i, tint.clone().multiplyScalar(0.8 + rnd() * 0.4));
      });
      mesh.visible = false;
      this.group.add(mesh);
      this.nearDecor.push(mesh);
    }
  }
  private buildPins(): void {
    const byCat = new Map<CategoryId, Inst[]>();
    for (const m of this.models.values())
      for (const inst of m.insts) {
        if (NO_PIN.has(inst.entity.cat)) continue;
        const list = byCat.get(inst.entity.cat) ?? [];
        list.push(inst);
        byCat.set(inst.entity.cat, list);
      }
    const pr = this.renderer.getPixelRatio();
    for (const [cat, insts] of byCat) {
      const pos = new Float32Array(insts.length * 3);
      const hide = new Float32Array(insts.length).fill(1);
      const scale = new Float32Array(insts.length);
      insts.forEach((inst, i) => {
        inst.pinIndex = i;
        scale[i] = inst.importance >= PIN_IMPORTANCE ? 1 : 0.72;
      });
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      g.setAttribute("aHide", new THREE.BufferAttribute(hide, 1));
      g.setAttribute("aScale", new THREE.BufferAttribute(scale, 1));
      const material = new THREE.ShaderMaterial({
        uniforms: {
          uMap: { value: this.pinTextures.get(cat) },
          uSize: { value: PIN_SPRITE * pr },
          uViewH: { value: this.container.clientHeight * pr },
          uOpacity: { value: 1 },
        },
        vertexShader: pinVertex,
        fragmentShader: pinFragment,
        transparent: true,
        depthTest: false,
        depthWrite: false,
      });
      const points = new THREE.Points(g, material);
      points.frustumCulled = false;
      points.renderOrder = 30;
      this.group.add(points);
      const layer: PinLayer = { cat, points, material, insts, pos, hide };
      for (const inst of insts) inst.pinLayer = layer;
      this.pinLayers.set(cat, layer);
    }
  }
  private buildLinks(mine: Entity[]): void {
    const byId = new Map(mine.map((e) => [e.id, e]));
    const radiusM = this.planet!.radius / 100;
    const seg: Record<Link["kind"] | "tunnel", number[]> = { tether: [], power: [], tunnel: [] };
    const endRadius = (e: Entity, d: THREE.Vector3) => (e.alt < UNDERGROUND_CM ? (e.dist / this.planet!.radius) * R : this.surfacePoint(d, 1.2));
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const p = new THREE.Vector3();
    for (const l of this.allLinks) {
      const ea = byId.get(l.a);
      const eb = byId.get(l.b);
      if (!ea || !eb) continue;
      const da = toDir(ea);
      const db = toDir(eb);
      const ang = Math.acos(THREE.MathUtils.clamp(da.dot(db), -1, 1));
      const steps = Math.max(1, Math.ceil((ang * radiusM) / 20));
      const out = seg[l.kind];
      const ra = endRadius(ea, da),
        rb = endRadius(eb, db);
      const buried = ea.alt < UNDERGROUND_CM || eb.alt < UNDERGROUND_CM;
      let prev = a.copy(da).multiplyScalar(ra).clone();
      for (let i = 1; i <= steps; i++) {
        const d = slerp(da, db, i / steps);
        const r = buried ? THREE.MathUtils.lerp(ra, rb, i / steps) : this.surfacePoint(d, 1.2);
        p.copy(d).multiplyScalar(r);
        out.push(prev.x, prev.y, prev.z, p.x, p.y, p.z);
        if (buried && l.kind === "tether") seg.tunnel.push(prev.x, prev.y, prev.z, p.x, p.y, p.z);
        prev = p.clone();
      }
      b.copy(db);
    }
    const make = (pts: number[], color: string, width: number) => {
      if (!pts.length) return undefined;
      const geo = new LineSegmentsGeometry();
      geo.setPositions(pts);
      const mat = new LineMaterial({ color: new THREE.Color(color).getHex(), linewidth: width, worldUnits: false, transparent: true, opacity: 0.95 });
      mat.resolution.set(this.container.clientWidth * this.renderer.getPixelRatio(), this.container.clientHeight * this.renderer.getPixelRatio());
      this.lineMats.push(mat);
      const line = new LineSegments2(geo, mat);
      line.frustumCulled = false;
      line.renderOrder = 3;
      this.group.add(line);
      return line;
    };
    this.lineMats = [];
    this.tunnelLines = make(seg.tunnel, "#2a2440", 14);
    if (this.tunnelLines) {
      this.tunnelLines.material.opacity = 0.35;
      this.tunnelLines.renderOrder = 2;
      this.tunnelLines.visible = false;
    }
    this.tetherLines = make(seg.tether, "#4dd4ff", 2.5);
    this.powerLines = make(seg.power, "#ffd400", 3);
  }
  labelTargets(max: number, always: (Entity | null)[] = []): LabelTarget[] {
    const out: LabelTarget[] = [];
    const w = this.container.clientWidth,
      hgt = this.container.clientHeight;
    const cands: {
      inst: Inst;
      score: number;
    }[] = [];
    for (const layer of this.pinLayers.values()) {
      const forced = layer.insts.some((i) => always.includes(i.entity));
      if (!LABEL_CATS.has(layer.cat) && !forced) continue;
      layer.insts.forEach((inst, i) => {
        if (layer.hide[i] > 0.5 || !inst.screen) return;
        const isAlways = always.includes(inst.entity);
        if (!LABEL_CATS.has(layer.cat) && !isAlways) return;
        const dx = inst.screen.x - w / 2,
          dy = inst.screen.y - hgt / 2;
        cands.push({ inst, score: (isAlways ? 10 : inst.importance) - Math.hypot(dx, dy) / Math.hypot(w, hgt) });
      });
    }
    cands.sort((x, y) => y.score - x.score);
    for (const c of cands.slice(0, max)) out.push({ entity: c.inst.entity, x: c.inst.screen!.x, y: c.inst.screen!.y });
    return out;
  }
  setLayers(visible: Set<CategoryId>): void {
    this.visible = new Set(visible);
    this.applyVisibility();
  }
  private applyVisibility(): void {
    this.dirty = true;
    this.clusterLevel = Number.NaN;
    const net = this.visible.has("tether");
    if (this.tetherLines) this.tetherLines.visible = net;
    if (this.powerLines) this.powerLines.visible = net;
    if (this.tunnelLines) this.tunnelLines.visible = net && this.xray;
    if (this.hovered && !this.visible.has(this.hovered.cat)) this.setHover(null, 0, 0);
  }
  setXray(on: boolean): void {
    this.xray = on;
    this.applyXray();
    if (this.selected && this.selected.alt < UNDERGROUND_CM && this.selected.planet === this.planet?.id) {
      this.placeRing(this.selectRing, this.selected);
      if (this.cam.isClose) this.flyTo(this.selected);
    }
  }
  private applyXray(): void {
    this.terrainMat.transparent = this.xray;
    this.terrainMat.opacity = this.xray ? 0.16 : 1;
    this.terrainMat.depthWrite = !this.xray;
    this.terrainMat.needsUpdate = true;
    if (this.atmosphere) this.atmosphere.visible = !this.xray && this.planet?.id !== "Space";
    for (const d of this.decor) d.mesh.visible = !this.xray;
    if (this.tunnelLines) this.tunnelLines.visible = this.xray && this.visible.has("tether");
    this.dirty = true;
  }
  setSelected(e: Entity | null): void {
    this.selected = e;
    this.selectRing.visible = !!e && !!this.planet && e.planet === this.planet.id;
    if (e && this.selectRing.visible) this.placeRing(this.selectRing, e);
  }
  private placeRing(ring: THREE.Mesh, e: Entity): void {
    const dir = toDir(e);
    const underground = e.alt < UNDERGROUND_CM && e.planet !== "Space";
    const r = underground && this.xray ? (e.dist / this.planet!.radius) * R : this.surfacePoint(dir, 0.3);
    ring.position.copy(dir).multiplyScalar(r);
    ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
  }
  flyTo(e: Entity): void {
    if (!this.planet || !this.field) return;
    const dir = toDir(e);
    const upm = this.field.unitsPerMeter;
    let size = Math.max(this.planet.id === "Space" ? 40 : 18, this.nearbyExtentM(e));
    if (["vehicle", "death", "backpack", "beacon", "research", "critter", "item", "resource"].includes(e.cat)) size = Math.min(size, 28);
    const buried = e.alt < UNDERGROUND_CM && e.planet !== "Space" && this.xray;
    const r = buried ? (e.dist / this.planet.radius) * R : undefined;
    this.cam.flyTo(dir, size * 1.9 * upm, size <= 28 ? 1.0 : 0.85, reducedMotion() ? 1 : 1300, this.cam.heading, r);
  }
  private nearbyExtentM(e: Entity): number {
    const dir = toDir(e);
    const radiusM = this.planet!.radius / 100;
    let best = 0;
    for (const m of this.models.values())
      for (const inst of m.insts) {
        if (inst.entity.cat === "flora" || inst.entity.cat === "resource" || inst.entity.cat === "tether") continue;
        const ang = Math.acos(THREE.MathUtils.clamp(inst.dir.dot(dir), -1, 1));
        const d = ang * radiusM;
        if (d < 60 && d > best) best = d;
      }
    return best * 1.6;
  }
  zoomBy(factor: number): void {
    this.cam.zoomBy(factor);
  }
  resetView(): void {
    this.cam.flyTo(this.focusDir, R * 2.6, 0, reducedMotion() ? 1 : 1100, 0);
  }
  private resize(): void {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(h, 1);
    const half = THREE.MathUtils.degToRad(this.camera.aspect < 1 ? 15 : 19);
    this.camera.fov = this.camera.aspect < 1 ? THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(half) / this.camera.aspect)) : 38;
    this.camera.updateProjectionMatrix();
    const pr = this.renderer.getPixelRatio();
    for (const l of this.pinLayers.values()) l.material.uniforms.uViewH.value = h * pr;
    for (const m of this.lineMats) m.resolution.set(w * pr, h * pr);
  }
  private loop = (): void => {
    this.raf = requestAnimationFrame(this.loop);
    const now = performance.now();
    this.cam.update();
    this.updateShadowFrame();
    const dist = this.camera.position.length();
    const inside = this.planet?.id === "Space" ? 0 : THREE.MathUtils.clamp((R * 1.75 - dist) / (R * 0.45), 0, 1);
    this.renderer.setClearColor(this.xray ? new THREE.Color("#1a1536") : this.skyColor, inside);
    this.fog.color.copy(this.xray ? new THREE.Color("#1a1536") : this.skyColor);
    (this.stars.material as THREE.PointsMaterial).opacity = 0.9 * (1 - inside);
    if (this.atmosphere) this.atmosphere.visible = inside < 0.98 && !this.xray && this.planet?.id !== "Space";
    for (const m of this.nearDecor) m.visible = inside > 0.35 && !this.xray;
    const toTarget = this.cam.distance;
    this.fog.near = inside > 0 ? toTarget * 3 : 1e6;
    this.fog.far = inside > 0 ? Math.max(toTarget * 12, R * 0.6) / Math.max(inside, 0.15) : 1e7;
    const grow = THREE.MathUtils.clamp((dist - R) / (R * 0.1), 0, 70);
    if (this.dirty || Math.abs(grow - this.lastGrow) > 1e-4) {
      this.updateInstances(grow);
      this.lastGrow = grow;
      this.dirty = false;
    }
    const upm = this.field?.unitsPerMeter ?? 0.01;
    const ringScale = upm * (3 + grow * 1.6) * (reducedMotion() ? 1 : 1 + 0.08 * Math.sin(now / 240));
    this.selectRing.scale.setScalar(ringScale);
    this.hoverRing.scale.setScalar(upm * (2.4 + grow * 1.3));
    this.grow = grow;
    this.inside = inside;
    this.updatePins();
    this.renderer.render(this.scene, this.camera);
  };
  private shadowLook = new THREE.Vector3(1e9, 0, 0);
  private shadowWin = 0;
  private updateShadowFrame(): void {
    const look = this.cam.isClose ? this.cam.target.clone() : this.camera.position.clone().normalize().multiplyScalar(R);
    const wanted = this.cam.isClose ? Math.max(0.4, this.cam.distance * 1.6) : R * 0.9;
    const win = Math.pow(1.3, Math.ceil(Math.log(wanted) / Math.log(1.3)));
    const texel = (2 * win) / 2048;
    const moved = look.distanceTo(this.shadowLook) > texel * 24;
    if (!moved && win === this.shadowWin) return;
    this.shadowLook.copy(look);
    this.shadowWin = win;
    this.sun.target.position.copy(look);
    const sunDir = this.sun.position.clone().normalize();
    this.sun.position.copy(look).addScaledVector(sunDir, R * 2);
    const sc = this.sun.shadow.camera;
    sc.left = -win;
    sc.right = win;
    sc.top = win;
    sc.bottom = -win;
    sc.near = R * 0.5;
    sc.far = R * 3.5;
    sc.updateProjectionMatrix();
  }
  private updateInstances(grow: number): void {
    const upm = this.field?.unitsPerMeter ?? 0.01;
    const m4 = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3();
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (const m of this.models.values()) {
      for (const inst of m.insts) {
        const layerOn = this.visible.has(inst.entity.cat);
        const show = layerOn && (!inst.underground || this.xray) && !(inst.importance < 0.3 && grow > CLUTTER_HIDE);
        if (m.ghost) {
          if (layerOn && inst.underground && !this.xray && inst.importance >= PIN_IMPORTANCE) {
            const gs = upm * Math.min(inst.maxScale, 1 + inst.importance * grow);
            pos.copy(inst.dir).multiplyScalar(this.surfacePoint(inst.dir, 0.1));
            m.ghost.setMatrixAt(inst.index, m4.compose(pos, inst.quat, scl.set(gs, gs, gs)));
          } else m.ghost.setMatrixAt(inst.index, zero);
        }
        if (!show) {
          m.mesh.setMatrixAt(inst.index, zero);
          m.glow?.setMatrixAt(inst.index, zero);
          continue;
        }
        const s = upm * Math.min(inst.maxScale, 1 + inst.importance * grow);
        pos.copy(inst.dir).multiplyScalar(inst.radius);
        scl.set(s, s, s);
        m4.compose(pos, inst.quat, scl);
        m.mesh.setMatrixAt(inst.index, m4);
        m.glow?.setMatrixAt(inst.index, m4);
        if (inst.pinLayer) {
          const top = (inst.underground && !this.xray ? this.surfacePoint(inst.dir, 0.1) : inst.radius) + inst.height * s;
          inst.pinLayer.pos.set([inst.dir.x * top, inst.dir.y * top, inst.dir.z * top], inst.pinIndex * 3);
        }
      }
      m.mesh.instanceMatrix.needsUpdate = true;
      if (m.glow) m.glow.instanceMatrix.needsUpdate = true;
      for (const l of this.pinLayers.values()) l.points.geometry.getAttribute("position").needsUpdate = true;
      if (m.ghost) {
        m.ghost.instanceMatrix.needsUpdate = true;
        if (m.ghost.instanceColor) m.ghost.instanceColor.needsUpdate = true;
      }
      if (m.mesh.instanceColor) m.mesh.instanceColor.needsUpdate = true;
      if (m.glow?.instanceColor) m.glow.instanceColor.needsUpdate = true;
    }
    if (this.pins) {
      const q = new THREE.Quaternion();
      this.pinInsts.forEach((inst, i) => {
        const show = !this.xray && this.visible.has(inst.entity.cat);
        if (!show) {
          this.pins!.setMatrixAt(i, zero);
          return;
        }
        const s = upm * Math.min(40, 1.2 + inst.importance * grow * 0.9);
        pos.copy(inst.dir).multiplyScalar(this.surfacePoint(inst.dir, 0.2));
        q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), inst.dir);
        m4.compose(pos, q, scl.set(s, s, s));
        this.pins!.setMatrixAt(i, m4);
      });
      this.pins.instanceMatrix.needsUpdate = true;
      if (this.pins.instanceColor) this.pins.instanceColor.needsUpdate = true;
    }
    const decorScale = grow > 40 ? 0 : 1 + 0.12 * grow;
    for (const d of this.decor) {
      d.mats.forEach((base, i) => {
        if (decorScale === 0) d.mesh.setMatrixAt(i, zero);
        else {
          m4.copy(base).scale(scl.set(upm * decorScale, upm * decorScale, upm * decorScale));
          d.mesh.setMatrixAt(i, m4);
        }
      });
      d.mesh.instanceMatrix.needsUpdate = true;
      if (d.mesh.instanceColor) d.mesh.instanceColor.needsUpdate = true;
    }
  }
  private updatePins(): void {
    const cam = this.camera.position;
    const w = this.container.clientWidth,
      hgt = this.container.clientHeight;
    const v = new THREE.Vector3();
    const pinSize = PIN_SPRITE * (this.inside > 0.6 ? 0.8 : 1) * this.renderer.getPixelRatio();
    this.group.updateMatrixWorld();
    for (const layer of this.pinLayers.values()) {
      layer.material.uniforms.uSize.value = pinSize;
      const layerOn = this.visible.has(layer.cat);
      let changed = false;
      layer.insts.forEach((inst, i) => {
        let show = layerOn && (inst.importance >= PIN_IMPORTANCE || (inst.importance >= 0.3 ? this.grow < 20 : this.grow < 9));
        if (show && inst.underground && !this.xray && inst.importance < PIN_IMPORTANCE) show = false;
        if (show && this.inside > 0.6 && inst.importance < PIN_IMPORTANCE) show = false;
        if (show) {
          v.set(layer.pos[i * 3], layer.pos[i * 3 + 1], layer.pos[i * 3 + 2]).applyMatrix4(this.group.matrixWorld);
          if (!this.xray && occluded(cam, v, R * TERRAIN_SHRINK)) show = false;
          else {
            v.project(this.camera);
            if (v.z > 1) show = false;
            else inst.screen = { x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * hgt };
          }
        }
        if (!show) inst.screen = undefined;
        const hv = show ? 0 : 1;
        if (layer.hide[i] !== hv) {
          layer.hide[i] = hv;
          changed = true;
        }
      });
      if (changed) layer.points.geometry.getAttribute("aHide").needsUpdate = true;
    }
    this.clusterPins();
  }
  private clusterGroups: Inst[][] = [];
  private clusterLevel = Number.NaN;
  private rebuildClusterGroups(): void {
    const h = this.container.clientHeight || 1;
    const levelDist = Math.pow(1.5, this.clusterLevel);
    const pxAngle = (2 * levelDist * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2)) / h / R;
    const cell = Math.max(1e-4, this.clusterCell * pxAngle);
    const cells = new Map<string, Inst[]>();
    for (const layer of this.pinLayers.values())
      for (const inst of layer.insts) {
        if (inst.entity.cat === "player" || inst.entity.cat === "start") continue;
        const d = inst.dir;
        const theta = Math.acos(THREE.MathUtils.clamp(d.y, -1, 1));
        const ring = Math.floor(theta / cell);
        const circ = Math.max(1, Math.round((Math.PI * 2 * Math.sin((ring + 0.5) * cell)) / cell));
        const phi = Math.atan2(d.z, d.x) + Math.PI;
        const key = `${ring}:${Math.floor((phi / (Math.PI * 2)) * circ) % circ}`;
        const list = cells.get(key) ?? [];
        list.push(inst);
        cells.set(key, list);
      }
    this.clusterGroups = [...cells.values()].filter((g) => g.length > 1);
  }
  private clusterPins(): void {
    const level = Math.round(Math.log(Math.max(this.cam.distance, 1e-3)) / Math.log(1.5));
    if (level !== this.clusterLevel) {
      this.clusterLevel = level;
      this.rebuildClusterGroups();
    }
    const clusters: Cluster[] = [];
    for (const group of this.clusterGroups) {
      const members = group.filter((inst) => inst.screen && !this.keep.has(inst.entity.id) && inst.pinLayer && inst.pinLayer.hide[inst.pinIndex] < 0.5);
      if (members.length < 2) continue;
      let x = 0,
        y = 0;
      const dir = new THREE.Vector3();
      let top = members[0];
      for (const inst of members) {
        x += inst.screen!.x;
        y += inst.screen!.y;
        dir.add(inst.dir);
        if (inst.importance > top.importance) top = inst;
        inst.pinLayer!.hide[inst.pinIndex] = 1;
        inst.pinLayer!.points.geometry.getAttribute("aHide").needsUpdate = true;
        inst.screen = undefined;
      }
      clusters.push({ x: x / members.length, y: y / members.length, count: members.length, color: CATEGORY[top.entity.cat].color, dir: dir.normalize() });
    }
    this.clusterList = clusters;
  }
  clusters(): Cluster[] {
    return this.clusterList;
  }
  setKeep(ids: (number | undefined)[]): void {
    this.keep = new Set(ids.filter((x): x is number => x !== undefined));
  }
  zoomToCluster(c: Cluster): void {
    const dist = Math.max(this.cam.minDist, this.cam.distance * 0.35);
    this.cam.flyTo(c.dir, dist, Math.min(0.7, this.cam.distance < R ? 0.7 : 0.2), reducedMotion() ? 1 : 900);
  }
  private pickPin(clientX: number, clientY: number): Entity | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const x = clientX - rect.left,
      y = clientY - rect.top;
    const size = PIN_SPRITE * (this.inside > 0.6 ? 0.8 : 1);
    let best: Entity | null = null;
    let bestD = Infinity;
    for (const layer of this.pinLayers.values()) {
      layer.insts.forEach((inst, i) => {
        if (layer.hide[i] > 0.5 || !inst.screen) return;
        const s = size * (inst.importance >= PIN_IMPORTANCE ? 1 : 0.72);
        const cx = inst.screen.x,
          cy = inst.screen.y - 0.42 * s;
        const d = Math.hypot(x - cx, y - cy);
        if (d < s * 0.5 && d < bestD) {
          bestD = d;
          best = inst.entity;
        }
      });
    }
    return best;
  }
  pick(clientX: number, clientY: number): Entity | null {
    if (!this.planet) return null;
    const pin = this.pickPin(clientX, clientY);
    if (pin) return pin;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const targets: THREE.Object3D[] = [];
    for (const m of this.models.values()) {
      targets.push(m.mesh);
      if (m.ghost && !this.xray) targets.push(m.ghost);
    }
    if (this.pins && !this.xray) targets.push(this.pins);
    if (this.terrain && !this.xray) targets.push(this.terrain);
    const hits = this.raycaster.intersectObjects(targets, false);
    for (const h of hits) {
      if (h.object === this.terrain) return null;
      const id = h.instanceId;
      if (id === undefined) continue;
      if (h.object === this.pins) return this.pinInsts[id]?.entity ?? null;
      const m = this.models.get((h.object as THREE.InstancedMesh).userData.model as string);
      const inst = m?.insts[id];
      if (inst && this.visible.has(inst.entity.cat)) return inst.entity;
    }
    return null;
  }
  private pointerMove(e: PointerEvent): void {
    if (e.pointerType === "touch" || e.buttons) return;
    const now = performance.now();
    if (now - this.lastPickAt < 40) return;
    this.lastPickAt = now;
    this.setHover(this.pick(e.clientX, e.clientY), e.clientX, e.clientY);
  }
  private pointerUp(e: PointerEvent): void {
    const d = this.downAt;
    this.downAt = undefined;
    if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6 || performance.now() - d.t > 600) return;
    this.handlers.onPick(this.pick(e.clientX, e.clientY));
  }
  private setHover(e: Entity | null, x: number, y: number): void {
    if (e !== this.hovered) {
      this.hovered = e;
      this.renderer.domElement.style.cursor = e ? "pointer" : "grab";
      if (e) this.placeRing(this.hoverRing, e);
      this.hoverRing.visible = !!e && e !== this.selected;
    }
    this.handlers.onHover(e, x, y);
  }
}
function mulberry(seed: number): () => number {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function slerp(a: THREE.Vector3, b: THREE.Vector3, t: number): THREE.Vector3 {
  const dot = THREE.MathUtils.clamp(a.dot(b), -1, 1);
  if (Math.abs(dot) > 0.9995) return a.clone().lerp(b, t).normalize();
  const theta = Math.acos(dot) * t;
  const rel = b.clone().sub(a.clone().multiplyScalar(dot)).normalize();
  return a
    .clone()
    .multiplyScalar(Math.cos(theta))
    .add(rel.multiplyScalar(Math.sin(theta)));
}
function occluded(cam: THREE.Vector3, p: THREE.Vector3, r: number): boolean {
  const dx = p.x - cam.x,
    dy = p.y - cam.y,
    dz = p.z - cam.z;
  const len = Math.hypot(dx, dy, dz);
  const ux = dx / len,
    uy = dy / len,
    uz = dz / len;
  const b = cam.x * ux + cam.y * uy + cam.z * uz;
  const c = cam.lengthSq() - r * r;
  const disc = b * b - c;
  if (disc < 0) return false;
  const t = -b - Math.sqrt(disc);
  return t > 0 && t < len - 0.01;
}
