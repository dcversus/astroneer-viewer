export type CategoryId =
  | "player"
  | "start"
  | "death"
  | "backpack"
  | "beacon"
  | "vehicle"
  | "landing"
  | "base"
  | "power"
  | "tether"
  | "gateway"
  | "puzzle"
  | "research"
  | "wreck"
  | "resource"
  | "flora"
  | "critter"
  | "hazard"
  | "storm"
  | "lore"
  | "item"
  | "other";
export type PlanetId = "Terran" | "TerranMoon" | "Arid" | "Tundra" | "Radiated" | "Exotic" | "ExoticMoon" | "Space";
export interface Fact {
  label: string;
  value: string;
  tone?: "good" | "warn" | "muted" | "accent";
}
export interface Entity {
  id: number;
  cls: string;
  path: string;
  name: string;
  cat: CategoryId;
  planet: PlanetId;
  pos: [number, number, number];
  rot?: [number, number, number, number];
  dist: number;
  alt: number;
  interesting?: string;
  facts: Fact[];
  link?: number[];
}
export interface Link {
  a: number;
  b: number;
  kind: "tether" | "power";
}
export interface GateState {
  engineActivated: boolean;
  chambersActivated: number;
}
export interface Planet {
  id: PlanetId;
  name: string;
  tagline: string;
  center: [number, number, number];
  radius: number;
  seed?: number;
  dayTime?: number;
  gate?: GateState;
  stormAge?: number;
  visited: boolean;
  counts: Partial<Record<CategoryId, number>>;
}
export interface Mission {
  id: string;
  title: string;
  done: boolean;
  activated?: number;
  completed?: number;
  objectives: {
    label: string;
    type: string;
    progress: number;
    goal: number;
  }[];
}
export interface Research {
  totalPoints: number;
  balance: number;
  time: number;
  unlocked: string[];
  known: string[];
  hacked: string[];
  unclaimedPoints: number;
  unclaimedSources: number;
  unresearchedSamples: number;
}
export interface PlayerInfo {
  entity?: Entity;
  inventory: {
    name: string;
    count: number;
  }[];
  dataLogs: string[];
  respawnTokens?: number;
}
export interface WorldModel {
  fileName: string;
  savedAt?: number;
  header: {
    engine: string;
    saveGameVersion: number;
    packageVersion: number;
    level: string;
  };
  planets: Planet[];
  entities: Entity[];
  links: Link[];
  missions: Mission[];
  research: Research;
  player: PlayerInfo;
  settings: {
    label: string;
    value: string;
  }[];
  creative: {
    label: string;
    on: boolean;
  }[];
  stats: {
    objects: number;
    actors: number;
    names: number;
    decodedBytes: number;
    parseMs: number;
    decodeErrors: number;
  };
  startPlanet: PlanetId;
}
export interface DetailNode {
  label: string;
  value?: string;
  children?: DetailNode[];
}
export type ChunkId = "level" | "player";
export interface CatalogEntry {
  chunk: ChunkId;
  type: string;
  name: string;
  count: number;
  onMap: number;
}
export interface ObjectRow {
  chunk: ChunkId;
  index: number;
  name: string;
  owner?: string;
  entity?: number;
  bytes: number;
}
