import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Entity } from "../model/types.ts";
export interface ModelDef {
  geometry: THREE.BufferGeometry;
  glow?: THREE.BufferGeometry;
  height: number;
  tinted?: boolean;
}
export function modelSize(def: ModelDef): number {
  const r = def.geometry.boundingSphere?.radius ?? def.height;
  return Math.max(def.height, r * 2);
}
interface Part {
  geo: THREE.BufferGeometry;
  color: string;
  pos?: [number, number, number];
  rot?: [number, number, number];
  scale?: number | [number, number, number];
}
const WHITE = "#ffffff";
const SUIT = "#f3f4f8";
const ORANGE = "#ff8a2a";
const STEEL = "#aab2bf";
const DARK = "#3b3f4a";
const RUST = "#8d5a3c";
const GLASS = "#9fe9ff";
function build(parts: Part[]): THREE.BufferGeometry {
  const geos = parts.map((p) => {
    const g = p.geo.index ? p.geo.toNonIndexed() : p.geo;
    g.deleteAttribute("uv");
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(...(p.pos ?? [0, 0, 0])),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...(p.rot ?? [0, 0, 0]))),
      typeof p.scale === "number" ? new THREE.Vector3(p.scale, p.scale, p.scale) : new THREE.Vector3(...(p.scale ?? [1, 1, 1])),
    );
    g.applyMatrix4(m);
    const c = new THREE.Color(p.color);
    const n = g.getAttribute("position").count;
    const colors = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) colors.set([c.r, c.g, c.b], i * 3);
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return g;
  });
  const merged = mergeGeometries(geos, false);
  merged.computeBoundingSphere();
  return merged;
}
const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt: number, rb: number, h: number, seg = 10) => new THREE.CylinderGeometry(rt, rb, h, seg);
const sph = (r: number, seg = 10) => new THREE.SphereGeometry(r, seg, Math.max(6, seg - 2));
const cone = (r: number, h: number, seg = 8) => new THREE.ConeGeometry(r, h, seg);
const torus = (r: number, t: number) => new THREE.TorusGeometry(r, t, 8, 20);
const ico = (r: number, d = 0) => new THREE.IcosahedronGeometry(r, d);
function wheels(x: number, z: number, r: number, w: number, y = r): Part[] {
  return [
    [x, z],
    [x, -z],
    [-x, z],
    [-x, -z],
  ].map(([px, pz]) => ({
    geo: cyl(r, r, w, 10),
    color: DARK,
    pos: [px, y, pz] as [number, number, number],
    rot: [Math.PI / 2, 0, 0] as [number, number, number],
  }));
}
export const MODELS: Record<string, ModelDef> = {
  astronaut: {
    height: 2.1,
    geometry: build([
      { geo: cyl(0.36, 0.42, 0.9), color: SUIT, pos: [0, 0.75, 0] },
      { geo: sph(0.42), color: SUIT, pos: [0, 1.62, 0] },
      { geo: sph(0.3, 8), color: "#283347", pos: [0.22, 1.66, 0], scale: [0.6, 0.8, 1] },
      { geo: box(0.3, 0.6, 0.55), color: ORANGE, pos: [-0.42, 0.95, 0] },
      { geo: cyl(0.1, 0.12, 0.55), color: SUIT, pos: [0.12, 0.28, 0.2] },
      { geo: cyl(0.1, 0.12, 0.55), color: SUIT, pos: [0.12, 0.28, -0.2] },
      { geo: cyl(0.09, 0.09, 0.7), color: ORANGE, pos: [0.05, 1.0, 0.5], rot: [0, 0, -0.3] },
      { geo: cyl(0.09, 0.09, 0.7), color: ORANGE, pos: [0.05, 1.0, -0.5], rot: [0, 0, -0.3] },
    ]),
    glow: build([{ geo: sph(0.08, 6), color: GLASS, pos: [-0.6, 1.3, 0] }]),
  },
  shelter: {
    height: 4.6,
    geometry: build([
      { geo: cyl(4.2, 4.6, 0.7, 16), color: STEEL, pos: [0, 0.35, 0] },
      { geo: new THREE.SphereGeometry(3.6, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), color: SUIT, pos: [0, 0.7, 0], scale: [1, 0.95, 1] },
      { geo: box(1.6, 2.2, 0.4), color: ORANGE, pos: [3.1, 1.6, 0], rot: [0, 0, 0.5] },
      { geo: torus(3.2, 0.14), color: ORANGE, pos: [0, 2.2, 0], rot: [Math.PI / 2, 0, 0] },
      { geo: cyl(0.1, 0.1, 2.2), color: STEEL, pos: [-1.5, 4.6, 1.5] },
    ]),
    glow: build([{ geo: sph(0.25, 8), color: "#ff9d3a", pos: [-1.5, 5.8, 1.5] }]),
  },
  landingPad: {
    height: 0.6,
    geometry: build([
      { geo: cyl(5.2, 5.6, 0.5, 8), color: "#6f7b8f", pos: [0, 0.25, 0] },
      { geo: torus(4.6, 0.22), color: "#c9d4e6", pos: [0, 0.55, 0], rot: [Math.PI / 2, 0, 0] },
    ]),
    glow: build([{ geo: torus(2.6, 0.12), color: GLASS, pos: [0, 0.56, 0], rot: [Math.PI / 2, 0, 0] }]),
  },
  landingPadBuilt: {
    height: 0.8,
    geometry: build([
      { geo: cyl(4.4, 4.6, 0.6, 8), color: SUIT, pos: [0, 0.3, 0] },
      ...[0, 1, 2, 3].map((i) => ({
        geo: box(0.7, 0.9, 0.7),
        color: ORANGE,
        pos: [Math.cos((i * Math.PI) / 2) * 3.6, 0.75, Math.sin((i * Math.PI) / 2) * 3.6] as [number, number, number],
      })),
    ]),
    glow: build([{ geo: torus(2.2, 0.12), color: "#ffb15c", pos: [0, 0.62, 0], rot: [Math.PI / 2, 0, 0] }]),
  },
  shuttle: {
    height: 9,
    geometry: build([
      { geo: cyl(1.4, 1.6, 5, 12), color: SUIT, pos: [0, 3.5, 0] },
      { geo: cone(1.4, 3, 12), color: SUIT, pos: [0, 7.5, 0] },
      { geo: cyl(1.8, 1.0, 1.2, 12), color: DARK, pos: [0, 0.6, 0] },
      ...[0, 1, 2].map((i) => ({
        geo: box(0.4, 2.4, 1.6),
        color: ORANGE,
        pos: [Math.cos((i * 2 * Math.PI) / 3) * 1.8, 1.4, Math.sin((i * 2 * Math.PI) / 3) * 1.8] as [number, number, number],
        rot: [0, -(i * 2 * Math.PI) / 3, 0] as [number, number, number],
      })),
    ]),
  },
  tractor: {
    height: 1.8,
    geometry: build([
      { geo: box(2.6, 0.7, 1.5), color: ORANGE, pos: [0, 1.0, 0] },
      { geo: box(1.0, 0.6, 1.2), color: DARK, pos: [0.5, 1.6, 0] },
      ...wheels(1.0, 0.85, 0.5, 0.4),
    ]),
  },
  rover: {
    height: 2.4,
    geometry: build([
      { geo: box(3.8, 0.8, 2.2), color: SUIT, pos: [0, 1.1, 0] },
      { geo: box(1.6, 0.5, 2.0), color: ORANGE, pos: [1.0, 1.75, 0] },
      { geo: box(1.2, 0.9, 1.6), color: DARK, pos: [-0.9, 1.9, 0] },
      ...wheels(1.4, 1.2, 0.62, 0.5),
    ]),
  },
  buggy: {
    height: 1.9,
    geometry: build([
      { geo: box(2.8, 0.6, 1.7), color: "#58c66b", pos: [0, 0.95, 0] },
      { geo: box(1.1, 0.7, 1.3), color: DARK, pos: [0.3, 1.55, 0] },
      { geo: torus(0.5, 0.08), color: STEEL, pos: [0.3, 2.2, 0], rot: [0, 0, Math.PI / 2] },
      ...wheels(1.05, 0.95, 0.55, 0.45),
    ]),
  },
  largeRover: {
    height: 3.2,
    geometry: build([
      { geo: box(5.4, 1.1, 3.0), color: SUIT, pos: [0, 1.5, 0] },
      { geo: box(2.0, 0.8, 2.8), color: ORANGE, pos: [1.5, 2.4, 0] },
      ...wheels(2.0, 1.7, 0.85, 0.7),
    ]),
  },
  beacon: {
    height: 2.2,
    geometry: build([
      { geo: cyl(0.12, 0.2, 0.3), color: STEEL, pos: [0, 0.15, 0] },
      { geo: cyl(0.05, 0.05, 1.6), color: "#d8dde8", pos: [0, 1.1, 0] },
    ]),
    glow: build([{ geo: sph(0.32, 10), color: WHITE, pos: [0, 2.0, 0] }]),
    tinted: true,
  },
  tether: {
    height: 1.3,
    geometry: build([
      { geo: cyl(0.05, 0.08, 1.2), color: "#c9d1dc", pos: [0, 0.6, 0] },
      { geo: cyl(0.14, 0.14, 0.08), color: STEEL, pos: [0, 0.04, 0] },
    ]),
    glow: build([{ geo: sph(0.13, 8), color: GLASS, pos: [0, 1.25, 0] }]),
  },
  platform: {
    height: 0.7,
    geometry: build([
      { geo: box(3.4, 0.35, 2.4), color: SUIT, pos: [0, 0.5, 0] },
      ...[-1.4, 1.4].flatMap((x) => [-0.9, 0.9].map((z) => ({ geo: cyl(0.1, 0.14, 0.4), color: STEEL, pos: [x, 0.2, z] as [number, number, number] }))),
    ]),
  },
  smelter: {
    height: 3.6,
    geometry: build([
      { geo: box(3.4, 0.35, 2.4), color: SUIT, pos: [0, 0.5, 0] },
      { geo: cyl(1.0, 1.2, 2.4, 12), color: STEEL, pos: [0, 1.9, 0] },
      { geo: torus(1.05, 0.12), color: ORANGE, pos: [0, 2.6, 0], rot: [Math.PI / 2, 0, 0] },
      { geo: cyl(0.3, 0.3, 1.0), color: DARK, pos: [0.9, 3.4, 0.6] },
    ]),
    glow: build([{ geo: cyl(0.6, 0.6, 0.1, 12), color: "#ff8a2a", pos: [0, 3.12, 0] }]),
  },
  printer: {
    height: 2.8,
    geometry: build([
      { geo: box(3.4, 0.35, 2.4), color: SUIT, pos: [0, 0.5, 0] },
      { geo: box(2.4, 0.5, 1.8), color: STEEL, pos: [0, 0.95, 0] },
      { geo: box(0.3, 1.8, 0.3), color: DARK, pos: [-1.0, 1.9, -0.7] },
      { geo: box(2.2, 0.25, 0.3), color: ORANGE, pos: [0, 2.7, -0.7] },
      { geo: box(0.4, 0.6, 0.4), color: ORANGE, pos: [0.6, 2.3, -0.7] },
    ]),
  },
  storage: {
    height: 2.2,
    geometry: build([
      { geo: box(3.4, 0.35, 2.4), color: SUIT, pos: [0, 0.5, 0] },
      { geo: box(2.2, 1.4, 1.6), color: STEEL, pos: [0, 1.4, 0] },
      ...[-0.7, 0, 0.7].map((x) => ({ geo: cyl(0.22, 0.22, 0.5, 8), color: ORANGE, pos: [x, 2.3, 0] as [number, number, number] })),
    ]),
  },
  researchChamber: {
    height: 3.2,
    geometry: build([
      { geo: box(3.4, 0.35, 2.4), color: SUIT, pos: [0, 0.5, 0] },
      { geo: cyl(1.3, 1.3, 0.5, 12), color: STEEL, pos: [0, 0.95, 0] },
      { geo: sph(1.1, 12), color: "#8d6fd8", pos: [0, 2.0, 0] },
    ]),
    glow: build([{ geo: torus(1.15, 0.08), color: "#d9b8ff", pos: [0, 2.0, 0], rot: [Math.PI / 2, 0, 0] }]),
  },
  module: {
    height: 1.8,
    geometry: build([
      { geo: box(3.0, 0.35, 2.2), color: SUIT, pos: [0, 0.5, 0] },
      { geo: box(1.6, 1.2, 1.4), color: STEEL, pos: [0, 1.3, 0] },
      { geo: box(0.6, 0.3, 1.0), color: ORANGE, pos: [0.9, 1.1, 0] },
    ]),
  },
  oxygenator: {
    height: 1.8,
    geometry: build([
      { geo: box(1.6, 0.3, 1.6), color: SUIT, pos: [0, 0.15, 0] },
      { geo: cyl(0.55, 0.55, 1.3, 10), color: "#5fc9e6", pos: [0, 0.95, 0] },
      { geo: sph(0.3), color: SUIT, pos: [0, 1.65, 0] },
    ]),
  },
  generator: {
    height: 1.4,
    geometry: build([
      { geo: box(1.0, 0.8, 0.9), color: STEEL, pos: [0, 0.5, 0] },
      { geo: cyl(0.12, 0.12, 0.8), color: DARK, pos: [0.3, 1.1, 0.25] },
      { geo: box(0.4, 0.3, 0.6), color: ORANGE, pos: [-0.3, 1.0, 0] },
    ]),
  },
  windTurbine: {
    height: 5.2,
    geometry: build([
      { geo: cyl(0.1, 0.18, 3.8), color: SUIT, pos: [0, 1.9, 0] },
      { geo: sph(0.3, 8), color: ORANGE, pos: [0.25, 3.9, 0] },
      ...[0, 1, 2].map((i) => ({
        geo: box(0.08, 1.6, 0.35),
        color: SUIT,
        pos: [0.4, 3.9 + Math.cos((i * 2 * Math.PI) / 3) * 0.8, Math.sin((i * 2 * Math.PI) / 3) * 0.8] as [number, number, number],
        rot: [(i * 2 * Math.PI) / 3, 0, 0] as [number, number, number],
      })),
    ]),
  },
  solar: {
    height: 1.8,
    geometry: build([
      { geo: cyl(0.1, 0.14, 1.0), color: STEEL, pos: [0, 0.5, 0] },
      { geo: box(2.2, 0.08, 1.4), color: "#2d4a8a", pos: [0, 1.2, 0], rot: [0, 0, -0.5] },
      { geo: box(2.3, 0.04, 0.08), color: SUIT, pos: [0, 1.25, 0], rot: [0, 0, -0.5] },
    ]),
  },
  battery: {
    height: 1.1,
    geometry: build([
      { geo: cyl(0.42, 0.42, 0.9, 10), color: "#f4c542", pos: [0, 0.45, 0] },
      { geo: cyl(0.2, 0.2, 0.3), color: DARK, pos: [0, 1.0, 0] },
    ]),
  },
  powerCell: {
    height: 0.6,
    geometry: build([
      { geo: box(0.5, 0.5, 0.5), color: "#f4c542", pos: [0, 0.25, 0] },
      { geo: box(0.55, 0.1, 0.55), color: DARK, pos: [0, 0.52, 0] },
    ]),
  },
  gatewayChamber: {
    height: 11,
    geometry: build([
      { geo: cyl(3.6, 4.2, 0.8, 6), color: "#2f2740", pos: [0, 0.4, 0] },
      ...[0, 1, 2].map((i) => ({
        geo: box(0.9, 9, 0.9),
        color: "#4a3d6b",
        pos: [Math.cos((i * 2 * Math.PI) / 3) * 2.3, 5, Math.sin((i * 2 * Math.PI) / 3) * 2.3] as [number, number, number],
        rot: [Math.sin((i * 2 * Math.PI) / 3) * 0.2, 0, -Math.cos((i * 2 * Math.PI) / 3) * 0.2] as [number, number, number],
      })),
      { geo: torus(2.4, 0.3), color: "#6a5a95", pos: [0, 9.6, 0], rot: [Math.PI / 2, 0, 0] },
    ]),
    glow: build([
      { geo: sph(1.1, 12), color: "#ff5fb0", pos: [0, 5.2, 0] },
      { geo: torus(2.4, 0.1), color: "#ff8fd0", pos: [0, 9.6, 0], rot: [Math.PI / 2, 0, 0] },
    ]),
  },
  gatewayEngine: {
    height: 10,
    geometry: build([
      { geo: torus(4.5, 0.4), color: "#4a3d6b", pos: [0, 5, 0], rot: [Math.PI / 2, 0, 0] },
      { geo: torus(4.5, 0.4), color: "#4a3d6b", pos: [0, 5, 0], rot: [0, 0, Math.PI / 2] },
    ]),
    glow: build([{ geo: ico(2.6, 1), color: "#ff5fb0", pos: [0, 5, 0] }]),
  },
  puzzle: {
    height: 1.8,
    geometry: build([
      { geo: box(1.6, 1.0, 1.6), color: "#3a3550", pos: [0, 0.5, 0] },
      { geo: cone(0.9, 0.9, 4), color: "#5a4f80", pos: [0, 1.45, 0], rot: [0, Math.PI / 4, 0] },
    ]),
    glow: build([{ geo: box(1.0, 0.12, 1.0), color: "#ffb13b", pos: [0, 1.04, 0] }]),
  },
  researchSample: {
    height: 1.2,
    geometry: build([{ geo: cyl(0.35, 0.45, 0.2, 8), color: STEEL, pos: [0, 0.1, 0] }]),
    glow: build([{ geo: ico(0.55, 0), color: "#c77dff", pos: [0, 0.8, 0] }]),
  },
  researchCrystal: {
    height: 1.6,
    geometry: build([
      { geo: cone(0.35, 1.5, 5), color: "#8d6fd8", pos: [0, 0.75, 0], rot: [0.1, 0, 0.2] },
      { geo: cone(0.25, 1.0, 5), color: "#a98df0", pos: [0.4, 0.5, 0.2], rot: [-0.2, 0, -0.5] },
      { geo: cone(0.2, 0.8, 5), color: "#a98df0", pos: [-0.35, 0.4, -0.25], rot: [0.3, 0, 0.6] },
    ]),
    glow: build([{ geo: sph(0.14, 6), color: "#efdcff", pos: [0, 1.5, 0] }]),
  },
  wreck: {
    height: 2.4,
    geometry: build([
      { geo: box(3.2, 0.9, 2.0), color: "#5c6470", pos: [0, 0.6, 0], rot: [0.12, 0.3, -0.25] },
      { geo: cyl(0.6, 0.7, 2.2, 8), color: RUST, pos: [0.8, 1.2, 0.5], rot: [0.9, 0, 0.6] },
      { geo: box(1.8, 0.1, 1.2), color: "#7b8494", pos: [-1.2, 0.3, -0.8], rot: [0.2, 0.8, 0.5] },
    ]),
  },
  outpost: {
    height: 3.8,
    geometry: build([
      { geo: cyl(3.2, 3.4, 0.5, 8), color: "#5c6470", pos: [0, 0.25, 0] },
      { geo: cyl(1.2, 1.4, 2.6, 10), color: RUST, pos: [0.4, 1.8, 0], rot: [0, 0, -0.35] },
      { geo: box(1.6, 1.0, 1.4), color: "#7b8494", pos: [-1.6, 1.0, 0.8], rot: [0, 0.4, 0.15] },
      { geo: box(0.2, 2.2, 0.2), color: DARK, pos: [-1.0, 1.6, -1.6], rot: [0.3, 0, 0.4] },
    ]),
  },
  corpse: {
    height: 0.7,
    geometry: build([
      { geo: cyl(0.3, 0.3, 1.2, 8), color: SUIT, pos: [0, 0.32, 0], rot: [0, 0, Math.PI / 2] },
      { geo: sph(0.36, 8), color: SUIT, pos: [0.85, 0.36, 0] },
      { geo: box(0.3, 0.3, 0.5), color: ORANGE, pos: [-0.2, 0.62, 0] },
    ]),
    glow: build([{ geo: torus(0.9, 0.06), color: "#ff4d6d", pos: [0, 0.05, 0], rot: [Math.PI / 2, 0, 0] }]),
  },
  backpack: {
    height: 0.9,
    geometry: build([
      { geo: box(0.55, 0.75, 0.4), color: SUIT, pos: [0, 0.38, 0] },
      { geo: box(0.6, 0.12, 0.45), color: ORANGE, pos: [0, 0.55, 0] },
      { geo: box(0.6, 0.12, 0.45), color: ORANGE, pos: [0, 0.2, 0] },
    ]),
    glow: build([{ geo: sph(0.08, 6), color: "#ff8fab", pos: [0, 0.82, 0] }]),
  },
  tree: {
    height: 6.5,
    geometry: build([
      { geo: cyl(0.22, 0.4, 4.2, 7), color: WHITE, pos: [0, 2.1, 0] },
      { geo: sph(1.7, 9), color: WHITE, pos: [0, 4.9, 0], scale: [1, 0.75, 1] },
      { geo: sph(1.1, 8), color: WHITE, pos: [0.9, 4.2, 0.6], scale: [1, 0.7, 1] },
      { geo: sph(0.9, 8), color: WHITE, pos: [-0.8, 4.4, -0.5] },
    ]),
    tinted: true,
  },
  mushroomTree: {
    height: 5.5,
    geometry: build([
      { geo: cyl(0.3, 0.5, 3.8, 7), color: WHITE, pos: [0, 1.9, 0] },
      { geo: sph(2.1, 10), color: WHITE, pos: [0, 4.1, 0], scale: [1, 0.55, 1] },
    ]),
    tinted: true,
  },
  finwheel: {
    height: 2.0,
    geometry: build([
      { geo: cone(0.45, 1.4, 6), color: "#4fb3a0", pos: [0, 0.7, 0] },
      ...[0, 1, 2, 3].map((i) => ({
        geo: box(0.08, 1.4, 0.7),
        color: "#7fe0cc",
        pos: [Math.cos((i * Math.PI) / 2) * 0.45, 1.2, Math.sin((i * Math.PI) / 2) * 0.45] as [number, number, number],
        rot: [0, -(i * Math.PI) / 2, 0.3] as [number, number, number],
      })),
    ]),
  },
  bulbPlant: {
    height: 1.6,
    geometry: build([
      { geo: cyl(0.08, 0.14, 1.0, 6), color: "#5a8f4a", pos: [0, 0.5, 0] },
      { geo: sph(0.5, 9), color: "#d9533a", pos: [0, 1.2, 0] },
    ]),
  },
  bigPlant: {
    height: 3.5,
    geometry: build([
      { geo: sph(1.8, 10), color: "#6c5fb8", pos: [0, 1.5, 0], scale: [1, 0.8, 1] },
      { geo: cone(0.5, 1.8, 6), color: "#8fe2c8", pos: [0, 3.1, 0] },
      { geo: cone(0.4, 1.3, 6), color: "#8fe2c8", pos: [1.0, 2.4, 0.4], rot: [0, 0, -0.6] },
    ]),
  },
  cavePlant: {
    height: 1.4,
    geometry: build([
      { geo: cone(0.3, 1.2, 5), color: "#4fa0d8", pos: [0, 0.6, 0] },
      { geo: cone(0.22, 0.8, 5), color: "#6fc0f0", pos: [0.35, 0.4, 0.2], rot: [0, 0, -0.4] },
      { geo: cone(0.2, 0.7, 5), color: "#6fc0f0", pos: [-0.3, 0.35, -0.2], rot: [0.3, 0, 0.4] },
    ]),
  },
  popcoral: {
    height: 1.5,
    geometry: build([
      { geo: sph(0.7, 9), color: "#f1d14a", pos: [0, 0.7, 0] },
      ...[0, 1, 2, 3, 4].map((i) => ({
        geo: cone(0.14, 0.6, 5),
        color: "#c7922a",
        pos: [Math.cos(i * 1.26) * 0.7, 0.8 + Math.sin(i * 2.1) * 0.3, Math.sin(i * 1.26) * 0.7] as [number, number, number],
        rot: [Math.sin(i * 1.26) * 1.3, 0, -Math.cos(i * 1.26) * 1.3] as [number, number, number],
      })),
    ]),
  },
  snail: {
    height: 0.8,
    geometry: build([
      { geo: cyl(0.2, 0.25, 0.9, 8), color: "#cfd8ff", pos: [0.2, 0.2, 0], rot: [0, 0, Math.PI / 2] },
      { geo: torus(0.3, 0.16), color: "#ff9ec4", pos: [-0.1, 0.5, 0], rot: [0, 0, 0] },
    ]),
  },
  ball: {
    height: 0.7,
    geometry: build([
      { geo: sph(0.35, 10), color: SUIT, pos: [0, 0.35, 0] },
      { geo: ico(0.36, 0), color: DARK, pos: [0, 0.35, 0], scale: [0.4, 0.4, 0.4] },
    ]),
  },
  nugget: {
    height: 0.6,
    geometry: build([
      { geo: ico(0.3, 0), color: WHITE, pos: [0, 0.28, 0] },
      { geo: ico(0.22, 0), color: WHITE, pos: [0.3, 0.2, 0.15] },
      { geo: ico(0.2, 0), color: WHITE, pos: [-0.25, 0.18, -0.2] },
    ]),
    tinted: true,
  },
  canister: {
    height: 0.9,
    geometry: build([
      { geo: cyl(0.3, 0.3, 0.8, 10), color: "#d6dde8", pos: [0, 0.4, 0] },
      { geo: cyl(0.32, 0.32, 0.12, 10), color: ORANGE, pos: [0, 0.85, 0] },
    ]),
  },
  crate: {
    height: 0.6,
    geometry: build([
      { geo: box(0.55, 0.5, 0.55), color: "#cdd3dd", pos: [0, 0.25, 0] },
      { geo: box(0.6, 0.08, 0.6), color: ORANGE, pos: [0, 0.3, 0] },
    ]),
  },
  dynamite: {
    height: 0.7,
    geometry: build([
      { geo: cyl(0.18, 0.18, 0.6, 8), color: "#d9533a", pos: [0, 0.3, 0] },
      { geo: cyl(0.03, 0.03, 0.3, 4), color: DARK, pos: [0, 0.75, 0] },
    ]),
  },
  probe: {
    height: 2.4,
    geometry: build([
      { geo: cyl(0.4, 0.5, 1.4, 8), color: STEEL, pos: [0, 0.7, 0] },
      { geo: cyl(0.9, 0.2, 0.5, 10), color: "#d6dde8", pos: [0, 1.7, 0] },
      { geo: box(2.4, 0.05, 0.7), color: "#2d4a8a", pos: [0, 0.9, 0] },
    ]),
    glow: build([{ geo: sph(0.1, 6), color: "#ffd6a5", pos: [0, 2.0, 0] }]),
  },
  tablet: {
    height: 0.9,
    geometry: build([{ geo: box(0.6, 0.8, 0.1), color: DARK, pos: [0, 0.45, 0], rot: [0, 0, -0.3] }]),
    glow: build([{ geo: box(0.45, 0.6, 0.02), color: "#ffd6a5", pos: [0.05, 0.47, 0.06], rot: [0, 0, -0.3] }]),
  },
  storm: {
    height: 3,
    geometry: build([
      { geo: torus(5, 0.9), color: "#4a2a7a", pos: [0, 1.5, 0], rot: [Math.PI / 2, 0, 0] },
      { geo: torus(2.6, 0.6), color: "#7b2cbf", pos: [0, 2.4, 0], rot: [Math.PI / 2, 0, 0] },
    ]),
  },
  station: {
    height: 6,
    geometry: build([
      { geo: cyl(2.2, 2.2, 3.5, 12), color: SUIT, pos: [0, 2.0, 0] },
      { geo: torus(3.4, 0.4), color: STEEL, pos: [0, 2.0, 0], rot: [Math.PI / 2, 0, 0] },
      { geo: box(6, 0.1, 1.6), color: "#2d4a8a", pos: [0, 2.0, 0] },
    ]),
    glow: build([{ geo: torus(2.3, 0.1), color: GLASS, pos: [0, 3.9, 0], rot: [Math.PI / 2, 0, 0] }]),
  },
  marker: {
    height: 0.5,
    geometry: build([{ geo: ico(0.3, 0), color: "#9aa3b2", pos: [0, 0.3, 0] }]),
  },
  rock: {
    height: 1.2,
    geometry: build([{ geo: new THREE.DodecahedronGeometry(0.9, 0), color: WHITE, pos: [0, 0.5, 0], scale: [1.2, 0.75, 1] }]),
    tinted: true,
  },
  boulder: {
    height: 2.6,
    geometry: build([
      { geo: new THREE.DodecahedronGeometry(1.8, 0), color: WHITE, pos: [0, 1.0, 0], scale: [1.3, 0.8, 1.1] },
      { geo: new THREE.DodecahedronGeometry(1.0, 0), color: WHITE, pos: [1.6, 0.5, 0.6] },
    ]),
    tinted: true,
  },
  grass: {
    height: 0.9,
    geometry: build(
      [0, 1, 2, 3].map((i) => ({
        geo: cone(0.09, 0.9, 4),
        color: WHITE,
        pos: [Math.cos(i * 1.57) * 0.18, 0.4, Math.sin(i * 1.57) * 0.18] as [number, number, number],
        rot: [Math.sin(i * 1.57) * 0.3, 0, -Math.cos(i * 1.57) * 0.3] as [number, number, number],
      })),
    ),
    tinted: true,
  },
  bush: {
    height: 1.2,
    geometry: build([
      { geo: sph(0.7, 8), color: WHITE, pos: [0, 0.6, 0], scale: [1.2, 0.8, 1] },
      { geo: sph(0.45, 7), color: WHITE, pos: [0.6, 0.45, 0.3] },
    ]),
    tinted: true,
  },
};
const RESOURCE_COLORS: [RegExp, string][] = [
  [/Graphite/i, "#30323d"],
  [/Sphalerite/i, "#5f8fa8"],
  [/Zinc/i, "#a9c3d6"],
  [/Quartz/i, "#f4b8dc"],
  [/Laterite/i, "#c75f3f"],
  [/Resin/i, "#e8c85a"],
  [/Compound/i, "#d8dee6"],
  [/Malachite/i, "#3cae72"],
  [/Hematite/i, "#6a2424"],
  [/Lithium/i, "#e3b8f2"],
  [/Titanite/i, "#9d7cd8"],
  [/Wolframite/i, "#6b9bd8"],
  [/Astronium/i, "#ff3ea8"],
  [/ExoChip/i, "#ffd166"],
  [/Clay/i, "#b48a6a"],
  [/Ammonium/i, "#c9d98a"],
  [/Scrap/i, "#8f8f99"],
  [/Soil|Dirt/i, "#7a6a55"],
];
const BEACON_COLORS = ["#4dd4ff", "#7cff6b", "#ff9e3a", "#ff5fb0", "#ffe14d", "#c77dff", "#ffffff", "#ff4d4d"];
export interface Appearance {
  model: string;
  tint?: string;
}
export function appearanceFor(e: Entity): Appearance {
  const p = e.path;
  const c = e.cls;
  switch (e.cat) {
    case "player":
      return { model: "astronaut" };
    case "start":
      return { model: "shelter" };
    case "death":
      return { model: "corpse" };
    case "backpack":
      return { model: "backpack" };
    case "beacon": {
      const idx = e.facts.find((f) => f.label === "Color")?.value.replace("#", "");
      return { model: "beacon", tint: BEACON_COLORS[Number(idx) % BEACON_COLORS.length] ?? BEACON_COLORS[0] };
    }
    case "vehicle":
      if (/Shuttle/i.test(c)) return { model: "shuttle" };
      if (/RoverT1\b|Tractor/i.test(c)) return { model: "tractor" };
      if (/RoverT2B|Buggy/i.test(c)) return { model: "buggy" };
      if (/RoverT3|Truck|Crane|LargeRover/i.test(c)) return { model: "largeRover" };
      return { model: "rover" };
    case "landing":
      return { model: c.includes("Natural") ? "landingPad" : c.includes("Station") ? "station" : "landingPadBuilt" };
    case "base":
      if (/Smelt/i.test(c)) return { model: "smelter" };
      if (/Printer|Fabricator/i.test(c)) return { model: "printer" };
      if (/Storage|Silo/i.test(c)) return { model: "storage" };
      if (/Research(Module|Chamber)|Research_Module/i.test(c)) return { model: "researchChamber" };
      if (/Oxygenator/i.test(c)) return { model: "oxygenator" };
      if (/Shelter|Habitat/i.test(c)) return { model: "shelter" };
      if (/Platform|Pad/i.test(c)) return { model: "platform" };
      return { model: "module" };
    case "power":
      if (/Wind/i.test(c)) return { model: "windTurbine" };
      if (/Solar/i.test(c)) return { model: "solar" };
      if (/Battery/i.test(c)) return { model: "battery" };
      if (/Cell|PowerBar/i.test(c)) return { model: "powerCell" };
      return { model: "generator" };
    case "tether":
      return { model: "tether" };
    case "gateway":
      return { model: /Chamber/i.test(c) ? "gatewayChamber" : "gatewayEngine" };
    case "puzzle":
      return { model: "puzzle" };
    case "research":
      return { model: /Crust|Mineral|Crevasse|Static/i.test(c) ? "researchCrystal" : "researchSample" };
    case "wreck":
      return { model: /ModernPOI_(?!Wrecked)|Outpost|Base_|Smelter_U|Research_U|Farm/i.test(p) ? "outpost" : "wreck" };
    case "resource": {
      if (/Canister/i.test(c)) return { model: "canister" };
      if (/Harvestable_/i.test(c)) return { model: "cavePlant" };
      const tint = RESOURCE_COLORS.find(([re]) => re.test(c))?.[1] ?? "#b5c3b8";
      return { model: "nugget", tint };
    }
    case "flora":
      if (/Forest/i.test(p)) return { model: "mushroomTree", tint: "#49a688" };
      if (/FinWheel/i.test(c)) return { model: "finwheel" };
      if (/Resipound|Bulb/i.test(c)) return { model: "bulbPlant" };
      if (/OrganicPOI/i.test(c)) return { model: "bigPlant" };
      return { model: "tree", tint: "#5db88f" };
    case "critter":
      if (/Snail/i.test(c)) return { model: "snail" };
      if (/Ball/i.test(c)) return { model: "ball" };
      return { model: "dynamite" };
    case "hazard":
      return { model: "popcoral" };
    case "lore":
      if (/Probe/i.test(c)) return { model: "probe" };
      if (/Plant|Resipound/i.test(c)) return { model: "bulbPlant" };
      return { model: "tablet" };
    case "storm":
      return { model: "storm" };
    case "item":
      if (/Canister/i.test(c)) return { model: "canister" };
      if (/Dynamite|Skybreaker/i.test(c)) return { model: "dynamite" };
      return { model: "crate" };
    default:
      return { model: "marker" };
  }
}
