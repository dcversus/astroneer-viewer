import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { PlanetMeta } from "../model/catalog.ts";
import type { Entity, Planet } from "../model/types.ts";
import { makeNoise3 } from "./noise.ts";
export const R = 10;
export interface HeightField {
  height(dir: THREE.Vector3): number;
  radius(dir: THREE.Vector3): number;
  forest(dir: THREE.Vector3): number;
  unitsPerMeter: number;
}
interface Sample {
  dir: THREE.Vector3;
  h: number;
  forest: number;
}
class SphereGrid {
  private cells = new Map<number, Sample[]>();
  private readonly cell: number;
  constructor(cell: number) {
    this.cell = cell;
  }
  private key(t: number, p: number): number {
    return t * 4096 + (((p % 4096) + 4096) % 4096);
  }
  private coords(d: THREE.Vector3): [number, number] {
    const theta = Math.acos(THREE.MathUtils.clamp(d.y, -1, 1));
    const phi = Math.atan2(d.z, d.x) + Math.PI;
    return [Math.floor(theta / this.cell), Math.floor(phi / this.cell)];
  }
  add(s: Sample): void {
    const [t, p] = this.coords(s.dir);
    const k = this.key(t, p);
    const list = this.cells.get(k) ?? [];
    list.push(s);
    this.cells.set(k, list);
  }
  near(d: THREE.Vector3, out: Sample[]): Sample[] {
    out.length = 0;
    const [t, p] = this.coords(d);
    for (let dt = -1; dt <= 1; dt++)
      for (let dp = -1; dp <= 1; dp++) {
        const list = this.cells.get(this.key(t + dt, p + dp));
        if (list) for (const s of list) out.push(s);
      }
    return out;
  }
}
export function toDir(e: Entity): THREE.Vector3 {
  return new THREE.Vector3(e.pos[0], e.pos[2], e.pos[1]).normalize();
}
export function buildHeightField(planet: Planet, meta: PlanetMeta, entities: Entity[]): HeightField {
  const pal = meta.terrain;
  const radiusM = planet.radius / 100;
  const unitsPerMeter = R / radiusM;
  const seed = planet.seed ?? planet.id.length * 7919;
  const nBase = makeNoise3(seed);
  const nRidge = makeNoise3(seed ^ 0x9e3779b9);
  const nDetail = makeNoise3(seed ^ 0x85ebca6b);
  const nBiome = makeNoise3(seed ^ 0xc2b2ae35);
  const influence = Math.min(0.12, 70 / radiusM);
  const grid = new SphereGrid(influence);
  let count = 0;
  for (const e of entities) {
    if (e.planet !== planet.id || e.cat === "player" || e.cat === "storm") continue;
    if (e.alt < -1500 || e.alt > 6000) continue;
    const forest = e.cat === "flora" ? (/Forest/i.test(e.path) ? 1 : 0) : -1;
    grid.add({ dir: toDir(e), h: e.alt / 100, forest });
    count++;
  }
  const hasSamples = count > 20 && planet.id !== "Space";
  const procedural = (d: THREE.Vector3): number => {
    const f = 1.6;
    let h = 32 * nBase(d.x * f, d.y * f, d.z * f) + 14 * nBase(d.x * f * 2.3, d.y * f * 2.3, d.z * f * 2.3);
    const ridge = 1 - Math.abs(nRidge(d.x * 2.0, d.y * 2.0, d.z * 2.0));
    const mass = nBase(d.x * 0.9 + 7, d.y * 0.9, d.z * 0.9);
    if (ridge > 0.66) h += (ridge - 0.66) * 240 * THREE.MathUtils.smoothstep(mass, -0.3, 0.4);
    if (ridge > 0.66) h += (ridge - 0.66) * 60;
    h += 4 * nDetail(d.x * 9, d.y * 9, d.z * 9);
    return h * pal.relief;
  };
  const scratch: Sample[] = [];
  const blend = (
    d: THREE.Vector3,
  ): {
    h: number;
    forest: number;
  } => {
    const ph = procedural(d);
    const pf = THREE.MathUtils.smoothstep(nBiome(d.x * 2.1, d.y * 2.1, d.z * 2.1) + (pal.forestCover - 0.5) * 1.2, -0.1, 0.35);
    if (!hasSamples) return { h: ph, forest: pf };
    let wh = 0,
      sh = 0,
      wf = 0,
      sf = 0;
    for (const s of grid.near(d, scratch)) {
      const ang = Math.acos(THREE.MathUtils.clamp(s.dir.dot(d), -1, 1));
      if (ang > influence) continue;
      const w = Math.exp(-((ang / influence) ** 2) * 3.2);
      wh += w;
      sh += w * s.h;
      if (s.forest >= 0) {
        wf += w;
        sf += w * s.forest;
      }
    }
    const prior = 0.08;
    const h = (sh + prior * ph) / (wh + prior);
    const forest = (sf + 0.25 * pf) / (wf + 0.25);
    return { h, forest };
  };
  return {
    height: (d) => blend(d).h,
    radius: (d) => R + blend(d).h * unitsPerMeter,
    forest: (d) => blend(d).forest,
    unitsPerMeter,
  };
}
export function buildTerrainMesh(field: HeightField, meta: PlanetMeta, detail = 56): THREE.BufferGeometry {
  const pal = meta.terrain;
  const geo = mergeVertices(new THREE.IcosahedronGeometry(R, detail));
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  const n = pos.count;
  const heights = new Float32Array(n);
  const forest = new Float32Array(n);
  const d = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    d.fromBufferAttribute(pos, i).normalize();
    const h = field.height(d);
    heights[i] = h;
    forest[i] = field.forest(d);
    d.multiplyScalar(R + h * field.unitsPerMeter);
    pos.setXYZ(i, d.x, d.y, d.z);
  }
  geo.computeVertexNormals();
  const normals = geo.getAttribute("normal") as THREE.BufferAttribute;
  const cLow = new THREE.Color(pal.low);
  const cGrass = new THREE.Color(pal.grass);
  const cForest = new THREE.Color(pal.forest);
  const cRock = new THREE.Color(pal.rock);
  const cStrata = new THREE.Color(pal.strata);
  const cPeak = new THREE.Color(pal.peak);
  const colors = new Float32Array(n * 3);
  const col = new THREE.Color();
  const nrm = new THREE.Vector3();
  const jitter = makeNoise3(1234);
  for (let i = 0; i < n; i++) {
    d.fromBufferAttribute(pos, i).normalize();
    nrm.fromBufferAttribute(normals, i);
    const slope = 1 - THREE.MathUtils.clamp(nrm.dot(d), 0, 1);
    const h = heights[i];
    col.copy(cLow).lerp(cGrass, THREE.MathUtils.smoothstep(h, -18, 8));
    col.lerp(cForest, forest[i] * 0.9);
    const band = 0.5 + 0.5 * Math.sin(h * 0.55 + jitter(d.x * 30, d.y * 30, d.z * 30) * 1.5);
    const rock = cRock.clone().lerp(cStrata, band);
    col.lerp(rock, THREE.MathUtils.smoothstep(slope, 0.08, 0.2));
    col.lerp(cPeak, THREE.MathUtils.smoothstep(h, 60, 110) * (1 - slope * 0.5));
    const j = 1 + jitter(d.x * 90, d.y * 90, d.z * 90) * 0.045;
    col.multiplyScalar(j);
    colors[i * 3] = col.r;
    colors[i * 3 + 1] = col.g;
    colors[i * 3 + 2] = col.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.deleteAttribute("uv");
  return geo;
}
export function terrainMaterial(): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWPos;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        varying vec3 vWPos;
        float hash3(vec3 p) { p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3)); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
        float vnoise(vec3 p) {
          vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(hash3(i), hash3(i + vec3(1,0,0)), f.x), mix(hash3(i + vec3(0,1,0)), hash3(i + vec3(1,1,0)), f.x), f.y),
                     mix(mix(hash3(i + vec3(0,0,1)), hash3(i + vec3(1,0,1)), f.x), mix(hash3(i + vec3(0,1,1)), hash3(i + vec3(1,1,1)), f.x), f.y), f.z);
        }`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        float n1 = vnoise(vWPos * 38.0);
        float n2 = vnoise(vWPos * 160.0);
        float n3 = vnoise(vWPos * 700.0);
        float mottle = smoothstep(0.45, 0.7, vnoise(vWPos * 90.0 + 13.0));
        float speck = step(0.9, vnoise(vWPos * 1600.0));
        diffuseColor.rgb *= 0.82 + 0.2 * n1 + 0.1 * n2 + 0.08 * n3 + 0.06 * speck;
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.9, 0.97, 1.05), mottle);`,
      );
  };
  return mat;
}
