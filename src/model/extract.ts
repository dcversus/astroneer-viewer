import type { RawSave, SaveChunk } from "../save/container.ts";
import { PropertyDecoder, type Props, type Value } from "../save/properties.ts";
import { Reader } from "../save/reader.ts";
import { CATEGORY, PLANETS, PLANET_ORDER, classify, friendlyName, humanize, shortClass, ticksToMs } from "./catalog.ts";
import type { CatalogEntry, CategoryId, ChunkId, DetailNode, Entity, Fact, Link, Mission, ObjectRow, Planet, PlanetId, Research, WorldModel } from "./types.ts";
const PLAYER_ID_BASE = 1000000;
const SPACE_LIMIT = 450000;
type V3 = [number, number, number];
class ChunkView {
  readonly chunk: SaveChunk;
  readonly dec: PropertyDecoder;
  private cache = new Map<number, Props>();
  readonly actorOfObject = new Map<number, number>();
  readonly componentsOf = new Map<number, number[]>();
  constructor(chunk: SaveChunk) {
    this.chunk = chunk;
    this.dec = new PropertyDecoder(chunk.names);
    chunk.actors.forEach((a, i) => this.actorOfObject.set(a.object, i));
    chunk.objects.forEach((o, i) => {
      if (o.outer < 0) return;
      const list = this.componentsOf.get(o.outer) ?? [];
      list.push(i);
      this.componentsOf.set(o.outer, list);
    });
  }
  props(i: number): Props {
    let p = this.cache.get(i);
    if (!p) {
      const o = this.chunk.objects[i];
      p = o ? this.dec.readProps(new Reader(o.data)) : {};
      this.cache.set(i, p);
    }
    return p;
  }
  name(i: number): string {
    const o = this.chunk.objects[i];
    return o ? this.dec.name(o.nameIndex) : "";
  }
  ownerObject(i: number): number {
    let cur = i;
    for (let guard = 0; guard < 8; guard++) {
      if (this.actorOfObject.has(cur)) return cur;
      const o = this.chunk.objects[cur];
      if (!o || o.outer < 0) return cur;
      cur = o.outer;
    }
    return cur;
  }
}
function scanEmbeddedProps(view: ChunkView, objectIndex: number): Props[] {
  const data = view.chunk.objects[objectIndex].data;
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const n = view.chunk.names.length;
  const out: Props[] = [];
  let i = 0;
  while (i + 16 < data.length) {
    const a = dv.getInt32(i, true);
    const b = dv.getInt32(i + 4, true);
    if (a > 0 && a <= n && b > 0 && b <= n && dv.getInt32(i + 12, true) === 0) {
      const size = dv.getInt32(i + 8, true);
      if (size >= 0 && size < data.length && view.dec.name(b).endsWith("Property")) {
        const before = view.dec.errors;
        const r = new Reader(data, i);
        const p = readPropsOrNull(view, r);
        if (p && view.dec.errors === before && Object.keys(p).length) {
          out.push(p);
          i = r.pos;
          continue;
        }
        view.dec.errors = before;
      }
    }
    i++;
  }
  return out;
}
function readPropsOrNull(view: ChunkView, r: Reader): Props | null {
  try {
    return view.dec.readProps(r);
  } catch {
    return null;
  }
}
const ref = (v: Value | undefined): number | undefined => (v && typeof v === "object" && !Array.isArray(v) && "$ref" in v ? (v.$ref as number) : undefined);
const obj = (v: Value | undefined): Props => (v && typeof v === "object" && !Array.isArray(v) ? (v as Props) : {});
const arr = (v: Value | undefined): Value[] => (Array.isArray(v) ? v : []);
const num = (v: Value | undefined): number => (typeof v === "number" ? v : 0);
const text = (v: Value | undefined): string => (typeof v === "string" ? v : typeof v === "number" || typeof v === "boolean" ? String(v) : "");
const enumTail = (v: Value | undefined): string => (typeof v === "string" ? v.split("::").pop()! : "");
function fmtBytes(n: number): string {
  return `${Math.round(n).toLocaleString("en-US")} bytes`;
}
export interface BuiltWorld {
  model: WorldModel;
  details(id: number): DetailNode[];
  catalog(): CatalogEntry[];
  objects(chunk: ChunkId, type: string): ObjectRow[];
  object(chunk: ChunkId, index: number): DetailNode[];
}
export function buildWorld(raw: RawSave, fileName: string, parseMs: number): BuiltWorld {
  const t0 = performance.now();
  const L = new ChunkView(raw.level);
  const objects = raw.level.objects;
  const actors = raw.level.actors;
  const planetByObject = new Map<number, PlanetId>();
  const planets = new Map<PlanetId, Planet>();
  objects.forEach((o, i) => {
    const m = /\/T2_Planet_(\w+)\.T2_Planet_\w+_C$/.exec(o.type);
    if (!m || !(m[1] in PLANETS) || m[1] === "Space") return;
    const id = m[1] as PlanetId;
    const ai = L.actorOfObject.get(i);
    const p = L.props(i);
    planetByObject.set(i, id);
    planets.set(id, {
      id,
      name: PLANETS[id].name,
      tagline: PLANETS[id].tagline,
      center: ai !== undefined ? ([...actors[ai].transform.pos] as V3) : [0, 0, 0],
      radius: 0,
      seed: typeof p.Seed === "number" ? p.Seed : undefined,
      dayTime: typeof p.LastCalculatedNormalizedDayTime === "number" ? p.LastCalculatedNormalizedDayTime : undefined,
      visited: false,
      counts: {},
    });
  });
  const planetList = PLANET_ORDER.map((id) => planets.get(id)).filter((p): p is Planet => !!p);
  const nearestPlanet = (
    pos: V3,
  ): {
    id: PlanetId;
    d: number;
  } => {
    let best: {
      id: PlanetId;
      d: number;
    } = { id: "Space", d: Infinity };
    for (const p of planetList) {
      const d = Math.hypot(pos[0] - p.center[0], pos[1] - p.center[1], pos[2] - p.center[2]);
      if (d < best.d) best = { id: p.id, d };
    }
    return best.d > SPACE_LIMIT ? { id: "Space", d: best.d } : best;
  };
  const gsIndex = objects.findIndex((o) => o.type.includes("Gates_GameState"));
  const gs = gsIndex >= 0 ? L.props(gsIndex) : {};
  const repl = obj(gs.ReplicationData);
  for (const g of arr(repl.PlanetaryGateObjectsStates)) {
    const gp = obj(g);
    const pid = planetByObject.get(ref(gp.Planet) ?? -1);
    const planet = pid && planets.get(pid);
    if (planet) planet.gate = { engineActivated: gp.bEngineActivated === true, chambersActivated: num(gp.NumChambersActivated) };
  }
  for (const s of arr(gs.PerPlanetStormStates)) {
    const sp = obj(s);
    const planet = planets.get(enumTail(sp.planetID) as PlanetId);
    const ages = arr(sp.StormStates).map((x) => num(obj(x).Age));
    if (planet && ages.length) planet.stormAge = Math.max(...ages);
  }
  const spawnObjects = new Set<number>();
  for (const v of [...arr(gs.NewPlayerSpawnLocations), ...arr(gs.SpawnLocations)]) {
    const r = ref(v);
    if (r !== undefined) spawnObjects.add(L.ownerObject(r));
  }
  const ecsByActorObject = new Map<
    number,
    {
      kind: string;
      props: Props;
    }[]
  >();
  const researchLists: Props[] = [];
  objects.forEach((o, i) => {
    if (!o.type.endsWith("ComponentContainer") || o.data.length < 32) return;
    const kind = shortClass(o.type).replace(/ComponentContainer$/, "");
    for (const p of scanEmbeddedProps(L, i)) {
      if (kind === "ResearchProgression") researchLists.push(p);
      const view = ref(p.ViewActorComponent);
      if (view === undefined) continue;
      const owner = L.ownerObject(view);
      const list = ecsByActorObject.get(owner) ?? [];
      list.push({ kind, props: p });
      ecsByActorObject.set(owner, list);
    }
  });
  const entities: Entity[] = [];
  const entityOfObject = new Map<number, Entity>();
  const SKIP =
    /T2_Planet_|PlanetProxy|Planet_Marker|\/Skyboxes\/|\/Camera\/|\/Planets\/Proxy\/|\/Script\/(Astro\.AstroPlayerState|CoreUObject)|PlayControllerInstance|GameState/;
  let unclaimedPoints = 0;
  let unclaimedSources = 0;
  let unresearched = 0;
  actors.forEach((a, ai) => {
    const o = objects[a.object];
    if (!o || SKIP.test(o.type)) return;
    const pos = a.transform.pos;
    if (pos[0] === 0 && pos[1] === 0 && pos[2] === 0) return;
    const near = nearestPlanet(pos);
    const center = planets.get(near.id)?.center ?? [0, 0, 0];
    const cat: CategoryId = spawnObjects.has(a.object) ? "start" : classify(o.type);
    const otherAstro = o.type.includes("DesignAstro");
    const p = L.props(a.object);
    const facts: Fact[] = [];
    let interesting: string | undefined;
    const comps = L.componentsOf.get(a.object) ?? [];
    const compProps = (needle: string): Props | undefined => {
      const ci = comps.find((c) => objects[c].type.includes(needle));
      return ci === undefined ? undefined : L.props(ci);
    };
    if (cat === "beacon" && typeof p.BeaconColorIndex === "number") facts.push({ label: "Color", value: `#${p.BeaconColorIndex}` });
    if (cat === "start") {
      interesting = "Where your journey began";
      facts.push({ label: "Shelter", value: friendlyName(o.type) });
    }
    if (cat === "death") interesting = "You died here";
    if (cat === "backpack") interesting = "Dropped backpack that may still hold items";
    if (typeof p.Plucked === "boolean") facts.push({ label: "Picked", value: p.Plucked ? "yes" : "no", tone: p.Plucked ? "muted" : "good" });
    if (typeof p.IsUnlocked === "boolean") {
      facts.push({ label: "Unlocked", value: p.IsUnlocked ? "yes" : "no", tone: p.IsUnlocked ? "good" : "warn" });
      if (!p.IsUnlocked) interesting = "Locked puzzle with a reward inside";
    }
    if (typeof p.HackedGatewayComplete === "boolean") {
      facts.push({ label: "Chamber", value: p.HackedGatewayComplete ? "activated" : "inactive", tone: p.HackedGatewayComplete ? "good" : "warn" });
      facts.push({ label: "Sockets powered", value: String(num(p.PowerSocketsConnected)) });
      if (!p.HackedGatewayComplete) interesting = "Gateway chamber waiting to be activated";
    }
    if (typeof p["REP GeneratorEnabled"] === "boolean") facts.push({ label: "Running", value: p["REP GeneratorEnabled"] ? "on" : "off" });
    if (typeof p.LightSwitchedOn === "boolean") facts.push({ label: "Light", value: p.LightSwitchedOn ? "on" : "off" });
    const item = compProps("ItemComponent");
    if (item && typeof item.Amount === "number" && typeof item.Capacity === "number" && item.Capacity > 1 && item.Amount <= item.Capacity * 1.01) {
      facts.push({ label: "Amount", value: `${+item.Amount.toFixed(2)} / ${item.Capacity}` });
    }
    const power = compProps("PowerComponent");
    if (power && typeof power.CurrentCharge === "number" && power.CurrentCharge > 0) facts.push({ label: "Charge", value: power.CurrentCharge.toFixed(1) });
    const landing = compProps("LandingPadComponent");
    if (landing?.TargetPlanetId) facts.push({ label: "Shuttle target", value: humanize(text(landing.TargetPlanetId)) });
    for (const e of ecsByActorObject.get(a.object) ?? []) {
      if (e.kind === "ResearchPointGrant" && e.props.bResearchPointsHaveBeenGranted === false) {
        const pts = num(e.props.ResearchPointsGranted);
        unclaimedPoints += pts;
        unclaimedSources++;
        facts.push({ label: "Research reward", value: fmtBytes(pts), tone: "accent" });
        interesting = "Unclaimed research bytes";
      }
      if (e.kind === "ResearchSubject" && num(e.props.CurrentResearchPhaseIndex) < 0 && cat === "research") {
        unresearched++;
        facts.push({ label: "Researched", value: "not yet", tone: "warn" });
        interesting ??= "Not researched yet";
      }
      if (e.kind === "Harvestable" && typeof e.props.bIsUprooted === "boolean") {
        const label = cat === "death" || cat === "backpack" ? "Looted" : "Harvested";
        facts.push({ label, value: e.props.bIsUprooted ? "yes" : "no", tone: e.props.bIsUprooted ? "muted" : "good" });
      }
    }
    if (cat === "wreck" && /Wrecked|Debris/.test(o.type)) interesting ??= "Salvage with scrap and parts";
    const local: V3 = [pos[0] - center[0], pos[1] - center[1], pos[2] - center[2]];
    const ent: Entity = {
      id: ai,
      cls: shortClass(o.type),
      path: o.type,
      name: otherAstro ? "Another astroneer" : friendlyName(o.type),
      cat,
      planet: near.id,
      pos: local,
      rot: [...a.transform.rot] as [number, number, number, number],
      dist: Math.hypot(...local),
      alt: 0,
      facts,
      interesting,
    };
    entities.push(ent);
    entityOfObject.set(a.object, ent);
  });
  const deaths = entities.filter((e) => e.cat === "death");
  const keep: Entity[] = [];
  for (const e of entities) {
    if (e.cat === "beacon" && actors[e.id].transform.scale[0] < 0.5) {
      const corpse = deaths.find((d) => d.planet === e.planet && Math.hypot(d.pos[0] - e.pos[0], d.pos[1] - e.pos[1], d.pos[2] - e.pos[2]) < 500);
      if (corpse) {
        corpse.facts.push({ label: "Death beacon", value: "yes" });
        continue;
      }
    }
    keep.push(e);
  }
  entities.length = 0;
  entities.push(...keep);
  const links: Link[] = [];
  const seen = new Set<string>();
  const addLink = (a: number | undefined, b: number | undefined, kind: Link["kind"]) => {
    if (a === undefined || b === undefined || a === b) return;
    const key = a < b ? `${a}:${b}:${kind}` : `${b}:${a}:${kind}`;
    if (seen.has(key)) return;
    seen.add(key);
    links.push({ a, b, kind });
  };
  const entityOfComponent = (v: Value | undefined) => entityOfObject.get(L.ownerObject(ref(v) ?? -1))?.id;
  objects.forEach((o, i) => {
    if (o.type.endsWith("TetherAttachComponent")) {
      const p = L.props(i);
      const from = entityOfObject.get(L.ownerObject(i))?.id;
      for (const v of arr(p.ConnectedTetherPosts)) addLink(from, entityOfComponent(v), "tether");
      for (const e of arr(p.ExplicitOxygenConnections)) {
        const entry = obj(e);
        const to = entityOfComponent(entry.key);
        const via = arr(obj(entry.value).Connections).map((c) => objects[ref(c) ?? -1]?.type ?? "");
        addLink(from, to, via.some((t) => t.includes("PowerCable")) ? "power" : "tether");
      }
    } else if (/PowerCable_Streaming_C$|VehiclePowerCable/.test(o.type)) {
      const p = L.props(i);
      addLink(entityOfComponent(obj(p.SourceSlot).Component), entityOfComponent(obj(p.TargetSlot).Component), "power");
    } else if (o.type.endsWith("TetherConnection_C")) {
      const p = L.props(i);
      addLink(entityOfComponent(obj(p.SourceSlot).Component), entityOfComponent(obj(p.TargetSlot).Component), "tether");
    }
  });
  const adrift = entities.filter((e) => e.planet === "Space");
  if (adrift.length) {
    const c: V3 = [0, 0, 0];
    for (const e of adrift) for (let k = 0; k < 3; k++) c[k] += (e.pos[k] + 0) / adrift.length;
    for (const e of adrift) {
      e.pos = [e.pos[0] - c[0], e.pos[1] - c[1], e.pos[2] - c[2]];
      e.dist = Math.hypot(...e.pos);
    }
    const space: Planet = { id: "Space", name: PLANETS.Space.name, tagline: PLANETS.Space.tagline, center: c, radius: 0, visited: true, counts: {} };
    planets.set("Space", space);
    planetList.push(space);
  }
  for (const planet of planetList) {
    const mine = entities.filter((e) => e.planet === planet.id);
    planet.visited = mine.some((e) => ["base", "beacon", "vehicle", "tether", "death", "start", "power"].includes(e.cat));
    const pads = mine.filter((e) => e.path.includes("NaturalLandingPad")).map((e) => e.dist);
    const sample = (pads.length >= 3 && planet.id !== "Space" ? pads : mine.map((e) => e.dist)).sort((x, y) => x - y);
    planet.radius = sample.length ? sample[Math.floor(sample.length * (pads.length >= 3 ? 0.5 : 0.7))] || 1000 : 100000;
    if (planet.id === "Space") planet.radius = Math.max(1000, ...mine.map((e) => e.dist)) * 1.05;
    for (const e of mine) {
      e.alt = e.dist - planet.radius;
      planet.counts[e.cat] = (planet.counts[e.cat] ?? 0) + 1;
    }
  }
  const player: WorldModel["player"] = { inventory: [], dataLogs: [] };
  const remote = raw.remotePlayers[0]?.chunk;
  if (remote) {
    const R = new ChunkView(remote);
    const inv = new Map<string, number>();
    remote.actors.forEach((a, ai) => {
      const o = remote.objects[a.object];
      if (!o) return;
      if (/DesignAstro|AstroCharacter/.test(o.type)) {
        const pos = a.transform.pos;
        const near = nearestPlanet(pos);
        const planet = planets.get(near.id);
        const center = planet?.center ?? [0, 0, 0];
        const local: V3 = [pos[0] - center[0], pos[1] - center[1], pos[2] - center[2]];
        const dist = Math.hypot(...local);
        const p = R.props(a.object);
        player.dataLogs = arr(p.DataLogEntriesSeen).map(String);
        player.entity = {
          id: PLAYER_ID_BASE + ai,
          cls: shortClass(o.type),
          path: o.type,
          name: "You",
          cat: "player",
          planet: near.id,
          pos: local,
          rot: [...a.transform.rot] as [number, number, number, number],
          dist,
          alt: dist - (planet?.radius ?? 0),
          facts: [{ label: "Suit accent", value: `#${num(p.AccentMaterialIndex)}` }],
          interesting: "Your last saved position",
        };
        if (planet) planet.counts.player = 1;
        return;
      }
      if (o.outer >= 0 || /PlayControllerInstance|PlayerState/.test(o.type)) return;
      const n = friendlyName(o.type);
      inv.set(n, (inv.get(n) ?? 0) + 1);
    });
    player.inventory = [...inv].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
    if (player.entity) entities.push(player.entity);
  }
  const tokens = arr(obj(obj(gs.customGameState).RespawnTokenState).RespawnTokenCounts);
  if (tokens.length) player.respawnTokens = num(obj(tokens[tokens.length - 1]).RespawnTokenCount);
  const mmIndex = objects.findIndex((o) => o.type.endsWith("AstroMissionsManager"));
  const mm = mmIndex >= 0 ? L.props(mmIndex) : {};
  const toMission = (v: Value, done: boolean): Mission => {
    const m = obj(v);
    const id = text(m.missionId);
    return {
      id,
      title: missionTitle(id),
      done,
      activated: ticksToMs(num(m.ActivationTimestamp)),
      completed: done ? ticksToMs(num(m.CompletionTimestamp)) : undefined,
      objectives: arr(m.ObjectiveProgressList).map((x) => {
        const ob = obj(x);
        return {
          label: humanize(enumTail(ob.ObjectiveType)),
          type: enumTail(ob.ObjectiveType),
          progress: num(ob.Progress),
          goal: num(ob.Goal),
        };
      }),
    };
  };
  const missions = [...arr(mm.ActiveMissions).map((m) => toMission(m, false)), ...arr(mm.CompletedMissions).map((m) => toMission(m, true))];
  const best = researchLists.sort((a, b) => num(obj(b.TotalResearch).Points) - num(obj(a.TotalResearch).Points))[0] ?? {};
  const names = (v: Value | undefined) =>
    [
      ...new Set(
        arr(v)
          .filter((x): x is string => typeof x === "string")
          .map(friendlyName),
      ),
    ].sort();
  const research: Research = {
    totalPoints: num(obj(best.TotalResearch).Points),
    time: num(obj(best.TotalResearch).Time),
    balance: num(best.CurrentPointBalance),
    unlocked: names(best.UnlockedItemTypes),
    known: names(best.KnownItemTypes),
    hacked: names(best.HackedItemTypes),
    unclaimedPoints,
    unclaimedSources,
    unresearchedSamples: unresearched,
  };
  const cgmIndex = objects.findIndex((o) => o.type.endsWith("AstroCustomGameManager"));
  const cgm = cgmIndex >= 0 ? L.props(cgmIndex) : {};
  const cgs = obj(cgm.CustomGameSettings);
  const settings = [
    { label: "Game type", value: cgm.IsCustomGame ? "Custom game" : "Standard adventure" },
    { label: "Starting planet", value: PLANETS[enumTail(cgs.StartingPlanetId) as keyof typeof PLANETS]?.name ?? humanize(enumTail(cgs.StartingPlanetId)) },
    { label: "Starting biome", value: text(cgs.StartingBiome) || "—" },
    { label: "Research reward ×", value: String(num(obj(cgs.ResearchSettings).ResearchRewardScalar) || 1) },
    { label: "Research speed ×", value: String(num(obj(cgs.ResearchSettings).ResearchSpeedScalar) || 1) },
    { label: "Power generation ×", value: String(num(obj(cgs.PowerSettings).GlobalPowerGenerationScalar) || 1) },
    { label: "Oxygen use ×", value: String(num(obj(cgs.OxygenSettings).GlobalOxygenConsumptionScalar) || 1) },
    { label: "Free oxygen", value: obj(cgs.OxygenSettings).FreeOxygen ? "on" : "off" },
    { label: "Respawn tokens", value: obj(cgs.RespawnTokenSettings).RespawnTokensActive ? "on" : "off" },
    { label: "Glitchwalkers storms", value: obj(cgs.GlitchWalkerSettings).StormsDisabled ? "disabled" : "enabled" },
    { label: "Multiplayer", value: gs.bIsMultiplayerEnabled ? "enabled" : "off" },
  ];
  const creative = Object.entries(gs)
    .filter(([k, v]) => k.startsWith("bCreative") && typeof v === "boolean")
    .map(([k, v]) => ({ label: humanize(k.replace(/^bCreative/, "")), on: v as boolean }));
  const startEntity = entities.find((e) => e.cat === "start");
  const allTimes = missions.flatMap((m) => [m.activated, m.completed]).filter((x): x is number => !!x);
  const model: WorldModel = {
    fileName,
    savedAt: savedAtFromName(fileName) ?? (allTimes.length ? Math.max(...allTimes) : undefined),
    header: {
      engine: raw.header.engine,
      saveGameVersion: raw.header.saveGameVersion,
      packageVersion: raw.header.packageVersion,
      level: raw.levelName.split("/").pop() ?? raw.levelName,
    },
    planets: planetList,
    entities,
    links,
    missions,
    research,
    player,
    settings,
    creative,
    stats: {
      objects: objects.length,
      actors: actors.length,
      names: raw.level.names.length,
      decodedBytes: raw.decompressedSize,
      parseMs: parseMs + (performance.now() - t0),
      decodeErrors: L.dec.errors,
    },
    startPlanet: startEntity?.planet ?? "Terran",
  };
  let R: ChunkView | undefined;
  const view = (chunk: ChunkId): ChunkView | undefined => (chunk === "level" ? L : remote ? (R ??= new ChunkView(remote)) : undefined);
  const entityOf = (chunk: ChunkId, objectIndex: number): number | undefined => {
    const v = view(chunk);
    if (!v) return undefined;
    const ai = v.actorOfObject.get(v.ownerObject(objectIndex));
    if (ai === undefined) return undefined;
    const id = chunk === "player" ? PLAYER_ID_BASE + ai : ai;
    return entityIds.has(id) ? id : undefined;
  };
  const entityIds = new Set(entities.map((e) => e.id));
  return {
    model,
    catalog(): CatalogEntry[] {
      const out: CatalogEntry[] = [];
      for (const chunk of ["level", "player"] as ChunkId[]) {
        const v = view(chunk);
        if (!v) continue;
        const byType = new Map<string, CatalogEntry>();
        v.chunk.objects.forEach((o, i) => {
          let e = byType.get(o.type);
          if (!e) {
            e = { chunk, type: o.type, name: friendlyName(o.type), count: 0, onMap: 0 };
            byType.set(o.type, e);
          }
          e.count++;
          if (v.actorOfObject.has(i) && entityOf(chunk, i) !== undefined) e.onMap++;
        });
        out.push(...[...byType.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)));
      }
      return out;
    },
    objects(chunk: ChunkId, type: string): ObjectRow[] {
      const v = view(chunk);
      if (!v) return [];
      const rows: ObjectRow[] = [];
      v.chunk.objects.forEach((o, i) => {
        if (o.type !== type) return;
        rows.push({
          chunk,
          index: i,
          name: v.name(i) || `#${i}`,
          owner: o.outer >= 0 ? v.name(o.outer) || shortClass(v.chunk.objects[o.outer]?.type ?? "") : undefined,
          entity: entityOf(chunk, i),
          bytes: o.data.length + o.custom.length,
        });
      });
      return rows;
    },
    object(chunk: ChunkId, index: number): DetailNode[] {
      const v = view(chunk);
      const o = v?.chunk.objects[index];
      if (!v || !o) return [];
      const r = new Reader(o.data);
      const props = v.dec.readProps(r);
      const nodes: DetailNode[] = [
        { label: "Class", value: o.type },
        { label: "Instance", value: v.name(index) },
        { label: "Object index", value: `${chunk} #${index}` },
      ];
      if (o.outer >= 0) nodes.push({ label: "Owned by", value: `${v.name(o.outer)} (#${o.outer})` });
      const ai = v.actorOfObject.get(index);
      if (ai !== undefined) {
        const t = v.chunk.actors[ai].transform;
        nodes.push({
          label: "Transform",
          children: [
            { label: "World position", value: t.pos.map((x) => x.toFixed(0)).join(", ") },
            { label: "Rotation (quat)", value: t.rot.map((x) => x.toFixed(3)).join(", ") },
            { label: "Scale", value: t.scale.map((x) => x.toFixed(2)).join(", ") },
          ],
        });
      }
      nodes.push({ label: "Properties", children: Object.keys(props).length ? toNodes(v, props) : [{ label: "(none)" }] });
      if (o.type.endsWith("ComponentContainer")) {
        const records = scanEmbeddedProps(v, index);
        nodes.push({
          label: `Entity records (${records.length})`,
          children: records.slice(0, 400).map((p, i) => ({
            label: recordLabel(v, p, i),
            children: toNodes(v, p),
          })),
        });
      } else if (o.data.length - r.pos > 8) {
        nodes.push({
          label: "Binary payload",
          value: `${(o.data.length - r.pos).toLocaleString("en-US")} bytes of engine-specific data${o.type.includes("Voxel") ? " (terrain edits)" : ""}`,
        });
      }
      if (o.custom.length) nodes.push({ label: "Custom data", value: `${o.custom.length} bytes (slot/attachment layout)` });
      const comps = v.componentsOf.get(index) ?? [];
      if (comps.length)
        nodes.push({
          label: `Components (${comps.length})`,
          children: comps.map((c) => ({ label: `${v.name(c)} · ${shortClass(v.chunk.objects[c].type)}`, children: toNodes(v, v.props(c)) })),
        });
      return nodes;
    },
    details(id: number): DetailNode[] {
      if (id >= PLAYER_ID_BASE && remote) {
        const R = new ChunkView(remote);
        const a = remote.actors[id - PLAYER_ID_BASE];
        return a ? actorDetails(R, a.object, a.transform, new Map()) : [];
      }
      const a = actors[id];
      return a ? actorDetails(L, a.object, a.transform, ecsByActorObject) : [];
    },
  };
}
function actorDetails(
  v: ChunkView,
  objectIndex: number,
  t: {
    pos: number[];
    rot: number[];
    scale: number[];
  },
  ecs: Map<
    number,
    {
      kind: string;
      props: Props;
    }[]
  >,
): DetailNode[] {
  const o = v.chunk.objects[objectIndex];
  const nodes: DetailNode[] = [
    { label: "Class", value: o.type },
    { label: "Instance", value: v.name(objectIndex) },
    {
      label: "Transform",
      children: [
        { label: "World position", value: t.pos.map((x) => x.toFixed(0)).join(", ") },
        { label: "Rotation (quat)", value: t.rot.map((x) => x.toFixed(3)).join(", ") },
        { label: "Scale", value: t.scale.map((x) => x.toFixed(2)).join(", ") },
      ],
    },
    { label: "Properties", children: toNodes(v, v.props(objectIndex)) },
  ];
  const comps = v.componentsOf.get(objectIndex) ?? [];
  if (comps.length) {
    nodes.push({
      label: `Components (${comps.length})`,
      children: comps.map((c) => ({
        label: `${v.name(c)} · ${shortClass(v.chunk.objects[c].type)}`,
        children: toNodes(v, v.props(c)),
      })),
    });
  }
  const e = ecs.get(objectIndex);
  if (e?.length) nodes.push({ label: "Entity data", children: e.map((x) => ({ label: x.kind, children: toNodes(v, x.props) })) });
  return nodes;
}
function toNodes(v: ChunkView, p: Value, depth = 0): DetailNode[] {
  if (depth > 6) return [{ label: "…" }];
  if (Array.isArray(p)) {
    const items = p.slice(0, 200).map((x, i) => valueNode(v, `[${i}]`, x, depth));
    if (p.length > 200) items.push({ label: `… ${p.length - 200} more` });
    return items;
  }
  if (p && typeof p === "object") return Object.entries(p as Props).map(([k, x]) => valueNode(v, k, x, depth));
  return [];
}
function valueNode(v: ChunkView, label: string, x: Value, depth: number): DetailNode {
  if (x === null) return { label, value: "∅" };
  if (typeof x === "boolean") return { label, value: x ? "true" : "false" };
  if (typeof x === "number") return { label, value: Number.isInteger(x) ? String(x) : x.toFixed(3) };
  if (typeof x === "string") return { label, value: x };
  if (!Array.isArray(x) && "$ref" in x) {
    const i = x.$ref as number;
    const o = v.chunk.objects[i];
    return { label, value: o ? `→ ${v.name(i) || shortClass(o.type)}` : `→ #${i}` };
  }
  if (!Array.isArray(x) && "$raw" in x) return { label, value: (x.$raw as number[]).join(" ") };
  if (Array.isArray(x) && x.length === 0) return { label, value: "[]" };
  if (!Array.isArray(x) && Object.keys(x).length === 0) return { label, value: "{}" };
  const keys = !Array.isArray(x) ? Object.keys(x) : [];
  if (keys.length && keys.length <= 4 && keys.every((k) => typeof (x as Props)[k] === "number")) {
    return { label, value: keys.map((k) => `${k} ${+((x as Props)[k] as number).toFixed(2)}`).join(" · ") };
  }
  return { label: Array.isArray(x) ? `${label} (${x.length})` : label, children: toNodes(v, x, depth + 1) };
}
function recordLabel(v: ChunkView, p: Props, i: number): string {
  const owner = ref(p.ViewActorComponent);
  const who = owner !== undefined ? v.name(v.ownerObject(owner)) : "";
  return `${who || text(p.Name) || "Record"} #${i + 1}`;
}
function missionTitle(id: string): string {
  const m = /^Mission_(\d+)-(\d+)/.exec(id);
  if (m) return `Story mission ${m[1]}.${m[2]}`;
  const t = /^Trailhead(\d+)_([\d.]+\w?)$/.exec(id);
  if (t) return `Trailhead ${Number(t[1])}, step ${t[2]}`;
  return humanize(id);
}
function savedAtFromName(name: string): number | undefined {
  const m = /\$(\d{4})\.(\d{2})\.(\d{2})-(\d{2})\.(\d{2})\.(\d{2})/.exec(name);
  if (!m) return undefined;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
}
export { CATEGORY };
