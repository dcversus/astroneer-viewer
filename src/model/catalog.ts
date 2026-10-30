import type { CategoryId, PlanetId } from "./types.ts";
export interface TerrainPalette {
  low: string;
  grass: string;
  forest: string;
  rock: string;
  strata: string;
  peak: string;
  decor: {
    tree: string;
    canopy: string;
    rock: string;
    grass: string;
  };
  relief: number;
  forestCover: number;
  trees: number;
}
export interface PlanetMeta {
  id: PlanetId;
  name: string;
  tagline: string;
  colors: [string, string, string, string];
  terrain: TerrainPalette;
}
const T = (p: Partial<TerrainPalette> & Pick<TerrainPalette, "low" | "grass" | "forest" | "rock" | "strata" | "peak">): TerrainPalette => ({
  decor: { tree: "#6b5a4a", canopy: p.forest, rock: p.rock, grass: p.grass },
  relief: 1,
  forestCover: 0.4,
  trees: 1,
  ...p,
});
export const PLANETS: Record<PlanetId, PlanetMeta> = {
  Terran: {
    id: "Terran",
    name: "Sylva",
    tagline: "Terran, the starting world",
    colors: ["#2f7a5a", "#7fc98f", "#c6e3ff", "#8fd3ff"],
    terrain: T({
      low: "#8fd29a",
      grass: "#7cc487",
      forest: "#3f8e6b",
      rock: "#a68ad6",
      strata: "#7c63b8",
      peak: "#e3e9ff",
      decor: { tree: "#7d6a8f", canopy: "#49a688", rock: "#9d86cc", grass: "#9fdc9a" },
      forestCover: 0.45,
      trees: 1,
    }),
  },
  TerranMoon: {
    id: "TerranMoon",
    name: "Desolo",
    tagline: "Barren moon of Sylva",
    colors: ["#4a4852", "#9a968f", "#e0dcd2", "#b9c2d6"],
    terrain: T({
      low: "#8d8880",
      grass: "#a39e95",
      forest: "#7a746c",
      rock: "#5f5a58",
      strata: "#8a8378",
      peak: "#e2ded6",
      decor: { tree: "#6e6a66", canopy: "#8b867e", rock: "#6c6762", grass: "#a39e95" },
      forestCover: 0.1,
      trees: 0.35,
      relief: 1.3,
    }),
  },
  Arid: {
    id: "Arid",
    name: "Calidor",
    tagline: "Arid world of dunes and spires",
    colors: ["#7a3418", "#d9843c", "#f6d59a", "#ffc27a"],
    terrain: T({
      low: "#cf7f3e",
      grass: "#e2a85c",
      forest: "#b86c33",
      rock: "#8f4328",
      strata: "#c86a38",
      peak: "#f5dba6",
      decor: { tree: "#8f4328", canopy: "#d7a455", rock: "#8f4328", grass: "#e8b86e" },
      forestCover: 0.2,
      trees: 0.4,
      relief: 1.2,
    }),
  },
  Tundra: {
    id: "Tundra",
    name: "Vesania",
    tagline: "Tundra world, frozen and violet",
    colors: ["#352a66", "#8a74d6", "#dcd2ff", "#c89cff"],
    terrain: T({
      low: "#5fc3c0",
      grass: "#8a74d6",
      forest: "#5d4bb3",
      rock: "#4a3b8f",
      strata: "#7a66cf",
      peak: "#e2d9ff",
      decor: { tree: "#4a3b8f", canopy: "#6dd0c8", rock: "#5a4aa0", grass: "#a493e6" },
      forestCover: 0.5,
      trees: 0.9,
    }),
  },
  Radiated: {
    id: "Radiated",
    name: "Novus",
    tagline: "Radiated moon of Vesania",
    colors: ["#3c5a2a", "#9fcf6a", "#eef4b8", "#dcff9a"],
    terrain: T({
      low: "#b6dc7a",
      grass: "#9fcf6a",
      forest: "#6a9f49",
      rock: "#7d8a4e",
      strata: "#a3ad63",
      peak: "#eef4bc",
      decor: { tree: "#7d8a4e", canopy: "#7fbf57", rock: "#8d9a55", grass: "#c2e38a" },
      forestCover: 0.3,
      trees: 0.6,
      relief: 1.15,
    }),
  },
  Exotic: {
    id: "Exotic",
    name: "Glacio",
    tagline: "Exotic ice world",
    colors: ["#2f5a7a", "#a9d8ec", "#ffffff", "#bff1ff"],
    terrain: T({
      low: "#bcd7e8",
      grass: "#dfeef7",
      forest: "#a9c9de",
      rock: "#4b6a8a",
      strata: "#6f8aa8",
      peak: "#ffffff",
      decor: { tree: "#4b6a8a", canopy: "#cfe6f2", rock: "#5b7a9a", grass: "#e6f3fa" },
      forestCover: 0.25,
      trees: 0.5,
      relief: 1.25,
    }),
  },
  ExoticMoon: {
    id: "ExoticMoon",
    name: "Atrox",
    tagline: "Toxic exotic moon",
    colors: ["#3b1a14", "#7a5a3a", "#c8c37a", "#c7ff7a"],
    terrain: T({
      low: "#8a4a3f",
      grass: "#6b7f3e",
      forest: "#3f512c",
      rock: "#7a3e3a",
      strata: "#5c3a2e",
      peak: "#b9c177",
      decor: { tree: "#5c3a2e", canopy: "#8aa44a", rock: "#7a3e3a", grass: "#7f944a" },
      forestCover: 0.55,
      trees: 0.8,
    }),
  },
  Space: {
    id: "Space",
    name: "Orbit",
    tagline: "The orbital station and anything adrift in space",
    colors: ["#1f2638", "#4a5878", "#a9b8d6", "#9ad1ff"],
    terrain: T({
      low: "#3a4458",
      grass: "#4a5878",
      forest: "#3a4458",
      rock: "#2a3140",
      strata: "#55627f",
      peak: "#a9b8d6",
      forestCover: 0,
      trees: 0,
      relief: 0.4,
    }),
  },
};
export const PLANET_ORDER: PlanetId[] = ["Terran", "TerranMoon", "Arid", "Tundra", "Radiated", "Exotic", "ExoticMoon", "Space"];
export interface CategoryMeta {
  id: CategoryId;
  label: string;
  hint: string;
  color: string;
  glyph: string;
  defaultOn: boolean;
  size: number;
}
export const CATEGORIES: CategoryMeta[] = [
  { id: "player", label: "You", hint: "Where you were when you saved", color: "#ffffff", glyph: "◉", defaultOn: true, size: 1.6 },
  { id: "start", label: "Starting point", hint: "Your landing / spawn location", color: "#ffe066", glyph: "★", defaultOn: true, size: 1.5 },
  { id: "death", label: "Lost astroneers", hint: "Dead astroneers the game left to find", color: "#ff4d6d", glyph: "✕", defaultOn: true, size: 1.1 },
  { id: "backpack", label: "Lost backpacks", hint: "Abandoned packs that may still hold items", color: "#ff8fab", glyph: "⬢", defaultOn: true, size: 1.1 },
  { id: "beacon", label: "Beacons", hint: "Beacons you placed", color: "#4dd4ff", glyph: "▲", defaultOn: true, size: 1.3 },
  { id: "vehicle", label: "Vehicles", hint: "Rovers, trucks, tractors, shuttles", color: "#b388ff", glyph: "◆", defaultOn: true, size: 1.3 },
  { id: "landing", label: "Landing pads", hint: "Natural and built landing pads", color: "#9fe870", glyph: "⊕", defaultOn: true, size: 1.1 },
  { id: "base", label: "Base modules", hint: "Platforms, printers, smelters, storage", color: "#5ce1e6", glyph: "■", defaultOn: true, size: 1.0 },
  { id: "power", label: "Power", hint: "Generators, solar, wind, batteries", color: "#ffd166", glyph: "ϟ", defaultOn: true, size: 0.9 },
  { id: "tether", label: "Tethers & cables", hint: "Blue oxygen lines, yellow power cables", color: "#4dd4ff", glyph: "⋯", defaultOn: true, size: 0.55 },
  { id: "gateway", label: "Gateways", hint: "Chambers and engine cores", color: "#f72585", glyph: "◎", defaultOn: true, size: 1.4 },
  { id: "puzzle", label: "Puzzles & locks", hint: "Shrines that unlock rewards", color: "#ff9e00", glyph: "✦", defaultOn: true, size: 1.1 },
  { id: "research", label: "Research samples", hint: "Samples worth bytes", color: "#c77dff", glyph: "✧", defaultOn: true, size: 0.9 },
  { id: "wreck", label: "Wrecks & POIs", hint: "Abandoned outposts and debris", color: "#f4a261", glyph: "⌂", defaultOn: true, size: 1.0 },
  { id: "resource", label: "Resources", hint: "Nuggets and cave plants", color: "#90be6d", glyph: "•", defaultOn: false, size: 0.7 },
  { id: "flora", label: "Flora", hint: "Trees and plants", color: "#57cc99", glyph: "♣", defaultOn: false, size: 0.7 },
  { id: "critter", label: "Critters & fun", hint: "Snails, balls, fireworks", color: "#ffafcc", glyph: "♥", defaultOn: true, size: 0.9 },
  { id: "hazard", label: "Hazards", hint: "Popcoral and poppers", color: "#e63946", glyph: "☣", defaultOn: false, size: 0.8 },
  { id: "lore", label: "Lore & events", hint: "Wanderer probes, data logs, seasonal event items", color: "#ffd6a5", glyph: "✎", defaultOn: true, size: 1.1 },
  { id: "storm", label: "Storm sites", hint: "Where glitch storms form", color: "#7b2cbf", glyph: "≈", defaultOn: false, size: 1.0 },
  { id: "item", label: "Loose items", hint: "Bundles, canisters, tools", color: "#adb5bd", glyph: "▪", defaultOn: false, size: 0.65 },
  { id: "other", label: "Other", hint: "Control panels and odds and ends", color: "#6c757d", glyph: "∙", defaultOn: false, size: 0.6 },
];
export const CATEGORY: Record<CategoryId, CategoryMeta> = Object.fromEntries(CATEGORIES.map((c) => [c.id, c])) as Record<CategoryId, CategoryMeta>;
const RULES: [RegExp, CategoryId][] = [
  [/AstroCorpse/i, "death"],
  [/Astro_Pack/i, "backpack"],
  [/StormSpawnLocation/i, "storm"],
  [/Beacon/i, "beacon"],
  [/ModernPOI|Wrecked|\/Debris_|BrokenCatalog|Scenarios\/Manmade\/(?!Soccer)/i, "wreck"],
  [/Gates\/|gate_engine|Chamber_/i, "gateway"],
  [/Puzzle/i, "puzzle"],
  [/Researchable|Research_T\d|ResearchableItem/i, "research"],
  [/NaturalLandingPad|LandingPad|ShuttlePlatform/i, "landing"],
  [/Wanderer|Lore\d|_Lore|Limited\/|DataLog|DataCache|Pumpkin|Anniversary|Memory_?Coil|Probe|Beacon_Story|Beacon_MissionReward/i, "lore"],
  [/\/Vehicles\/|\/(Rover|Truck|Tractor|Buggy|Shuttle|Drone|Hoverboard)[A-Z0-9_]\w*\.[^/]*$/, "vehicle"],
  [/TetherPost|TetherConnection|PowerCable|Extender/i, "tether"],
  [/Generator|Solar|Wind|Battery|Power_Cell|RTG|PowerBar|Turbine/i, "power"],
  [/Hazard_|Popcoral|Spewflower|Gasbag|Lashleaf/i, "hazard"],
  [/Snail|Soccer_Ball|Marble|Firework|Football|Hat_|Pinata/i, "critter"],
  [/Plant_|TappablePOI|OrganicPOI|Biodome|Resipound|Flora/i, "flora"],
  [/Nugget|Harvestable_|Canister|Resource/i, "resource"],
  [
    /Slots\/Pads|Platform|Shelter|Habitat|Printer|Smelter|Storage|Oxygenator|Tapper|Extractor|Converter|Chemistry|Centrifuge|Soil|Atmospheric|Trade|Research(Module|Chamber)|Medium|Large|Lamp|Light|Horn|Seat|Ramp|Silo|Rail|Hopper|Dispenser|Repackager/i,
    "base",
  ],
  [/Components_Small|\/Items\//i, "item"],
];
export function classify(path: string): CategoryId {
  for (const [re, cat] of RULES) if (re.test(path)) return cat;
  return "other";
}
const NAMES: Record<string, string> = {
  Shelter_T4_Starter: "Starting shelter",
  Shelter_T4: "Shelter",
  LandingPad_Starter: "Landing pad",
  Item_ModernPOI_ShuttlePlatform: "Abandoned shuttle platform",
  Chamber_2p_30s: "Gateway chamber",
  gate_engine_floating_diamond_structure: "Gateway engine core",
  gate_engine_arm_structure: "Gateway engine arm",
  gate_engine_arm_pole_structure: "Gateway engine pylon",
  TappablePOI_Terran_Forests_a: "Forest tree",
  Harvestable_Terran_Crust: "Cave plant",
  Harvestable_Terran_Forest: "Forest plant",
  OrganicPOI_Terran_Crust: "Large cave growth",
  OrganicPOI_Terran_Forests: "Giant forest plant",
  OrganicPOI_Terran_Plains: "Giant plains plant",
  OrganicPOI_Terran_Crevasses: "Giant crevasse plant",
  OrganicPOI_Terran_Mountains: "Giant mountain plant",
  Hazard_Gasbag_v1_BASE: "Popcoral",
  Hazard_Gasbag_v1_02: "Popcoral",
  Hazard_Gasbag_v1_03: "Popcoral",
  Hazard_Popper_01: "Popper plant",
  Hazard_Popper_02: "Popper plant",
  Puzzle_PowerMax_Terran_01: "Power puzzle",
  Puzzle_PowerLimit_Terran_01: "Power limit puzzle",
  Puzzle_Consume_Laterite: "Laterite puzzle",
  Item_PuzzleBox_Top: "Puzzle box",
  Item_PuzzleBox_Top_Laterite: "Puzzle box (laterite)",
  BP_GW_StormSpawnLocation_Radiated: "Storm site",
  Researchable_Crust_Terran_01: "Cave research sample",
  Research_T2Static_Terran_Crust: "Cave research item",
  Research_T2Static_Terran_Forest_01: "Forest research item",
  Research_T2Static_Terran_Plains: "Plains research item",
  Research_T2Static_Terran_Crevasse_01: "Crevasse research item",
  Researchable_EXO_Med_01: "EXO research pod",
  Researchable_EXO_Low_01: "EXO research pod",
  Researchable_EXO_High_01: "EXO research pod",
  ResearchableItem_Popper_01: "Popper research sample",
  Researchable_Plant_Terran_B_01: "Plant research sample",
  Researchable_Plant_Terran_A_01: "Plant research sample",
  Researchable_Mineral_Terran_A_01: "Mineral research sample",
  ResourceNugget8: "Resource nugget",
  ResourceNugget4: "Resource nugget",
  AutoCraneMedium_BP: "Auto crane",
  GravitySphere_BP: "Gravity globe",
  PowerBarOverlay: "Power bar",
  Wreck_Snail_Mission_Hub: "Snail mission hub",
  Snails_Missions_Hub: "Snail mission hub",
  AstroCorpse_Discovery: "Lost astroneer",
  Astro_Pack_Discovery: "Lost backpack",
  Beacon_Small_Item: "Beacon",
  Beacon_Small: "Beacon",
  Beacon_Story: "Story beacon",
  NaturalLandingPad: "Natural landing pad",
  TetherPost: "Tether",
  DesignAstro: "You",
  Skybreaker: "Skybreaker (dynamite pack)",
  Plant_Harvestable_FinWheel: "Finwheel plant",
  Fall_2024_Plant_Resipound: "Resipound plant",
  ShellSnail_Sylva: "Sylva snail",
  Soccer_Ball: "Soccer ball",
  BrokenCatalog: "Broken catalog",
  PowerCable_Streaming: "Power cable",
  Small_Wind: "Small wind turbine",
  Wind_Medium: "Medium wind turbine",
  Generator_Small: "Small generator",
  Generator_Medium: "Medium generator",
  Storage_Medium: "Medium storage",
  WorkLight: "Work light",
  FloodLight_BP: "Floodlight",
  Repackager: "Repackager",
  MineralExtractor: "Mineral extractor",
  ResourceCanister_Reusable: "Canister",
  Filter_Bundle: "Filter bundle",
  TetherBundle: "Tether bundle",
  ExtenderBundle: "Extender bundle",
  Power_Cell_Bundle: "Power cell bundle",
};
export function shortClass(path: string): string {
  const last = path.split("/").pop() ?? path;
  return last.includes(".") ? last.split(".").pop()! : last;
}
export function friendlyName(path: string): string {
  let s = shortClass(path).replace(/_C$/, "");
  if (NAMES[s]) return NAMES[s];
  const tier = /^(Rover|Shuttle|Truck)T(\d)(\w?)$/.exec(s);
  if (tier) return `${tier[1]} T${tier[2]}${tier[3]}`;
  if (s.startsWith("Wanderer_Probe")) return "Wanderer probe";
  if (s.startsWith("DataLog")) return "Data log";
  if (s.startsWith("MemoryCoil")) return "Memory coil";
  if (/^(Spring|Fall|Anniversary|Winter|Summer)_?\d*_?(LTE_)?Lore/.test(s)) return "Event lore item";
  if (/^(Spring|Fall|Anniversary)_?\d*_?Ingredient/.test(s)) return "Event ingredient";
  if (s.startsWith("Beacon_Mission_Reward")) return "Beacon (mission reward)";
  if (s.startsWith("Beacon_Buddy")) return "Beacon (buddy)";
  if (s.startsWith("Beacon_Home")) return "Home beacon";
  if (s.startsWith("Destructible_PlacementActor_DataCache")) return "Data cache";
  if (s.startsWith("Pumpkin")) return "Pumpkin";
  const storm = /StormSpawnLocation_(\w+)/.exec(s);
  if (storm) return "Storm site";
  const nugget = /^ResourceNugget_?(\w+)$/.exec(s);
  if (nugget) return /^\d+b?$/.test(nugget[1]) ? "Resource nugget" : `${nugget[1].replace(/([a-z])([A-Z])/g, "$1 $2")} nugget`;
  const poi = /^ModernPOI_(\w+?)_(?:U_)?([A-Z]-\d+_)?(Small|Medium|Large)?/.exec(s);
  if (poi) return `Abandoned ${poi[1].replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase()} outpost`;
  s = s
    .replace(/^(Item_|BP_|T2_)/, "")
    .replace(/_?(BASE|BP|v\d+)$/i, "")
    .replace(/ModernPOI_/i, "")
    .replace(/Wrecked_/i, "Wrecked ")
    .replace(/Researchable_?/i, "Research: ")
    .replace(/Research_T2Static_/i, "Research: ")
    .replace(/ResourceNugget_?/i, "Nugget ")
    .replace(/Harvestable_/i, "Harvestable ")
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}
export function humanize(s: string): string {
  return s
    .replace(/^[A-Z][A-Za-z]+::/, "")
    .replace(/^E[A-Z][A-Za-z]+::/, "")
    .replace(/^(VE_|b)(?=[A-Z])/, "")
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim();
}
export function ticksToMs(t: number): number | undefined {
  if (!t || t < 6e17) return undefined;
  return (t - 621355968000000000) / 10000;
}
