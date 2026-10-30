import { Reader } from "./reader.ts";
export const MAGIC = 0x4a3740be;
export interface Transform {
  rot: [number, number, number, number];
  pos: [number, number, number];
  scale: [number, number, number];
}
export interface ObjectRecord {
  type: string;
  nameIndex: number;
  flags: number;
  saveFlags: number;
  outer: number;
  data: Uint8Array;
  custom: Uint8Array;
}
export interface ActorRecord {
  object: number;
  children: {
    name: number;
    actor: number;
  }[];
  components: {
    name: number;
    object: number;
  }[];
  transform: Transform;
}
export interface SaveChunk {
  version: number;
  names: string[];
  objects: ObjectRecord[];
  actors: ActorRecord[];
  rootActors: number[];
  firstImport: number;
}
export interface SaveHeader {
  saveGameVersion: number;
  packageVersion: number;
  engine: string;
  build: string;
  saveClass: string;
}
export interface RawSave {
  header: SaveHeader;
  levelVersion: number;
  levelName: string;
  level: SaveChunk;
  playerControllers: {
    actor: number;
    pawn: number;
    uuid: string;
  }[];
  remotePlayers: {
    chunk: SaveChunk;
    uuid: string;
  }[];
  decompressedSize: number;
}
export async function inflate(file: Uint8Array): Promise<Uint8Array> {
  const magic = new DataView(file.buffer, file.byteOffset, 4).getUint32(0, true);
  if (magic !== MAGIC) {
    if (String.fromCharCode(...file.subarray(0, 4)) === "GVAS") return file;
    throw new Error("Not an Astroneer .savegame (bad magic)");
  }
  const stream = new Blob([file.subarray(16) as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
function readTransform(r: Reader): Transform {
  return {
    rot: [r.f32(), r.f32(), r.f32(), r.f32()],
    pos: [r.f32(), r.f32(), r.f32()],
    scale: [r.f32(), r.f32(), r.f32()],
  };
}
function readChunk(r: Reader): SaveChunk {
  const version = r.u32();
  const nameCount = r.i64();
  const names = new Array<string>(Math.max(0, nameCount - 1));
  for (let i = 0; i < names.length; i++) names[i] = r.fstring();
  const objectCount = r.u32();
  const objects = new Array<ObjectRecord>(objectCount);
  for (let i = 0; i < objectCount; i++) {
    const type = r.fstring();
    const nameIndex = r.i32();
    const flags = r.u32();
    const saveFlags = r.u8();
    const outer = r.i32();
    const customOffset = r.u32();
    const size = saveFlags & 4 ? r.u32() : 0;
    const data = r.take(customOffset);
    const custom = size ? r.take(size - customOffset) : new Uint8Array(0);
    objects[i] = { type, nameIndex, flags, saveFlags, outer, data, custom };
  }
  const actorCount = r.u32();
  const actors = new Array<ActorRecord>(actorCount);
  for (let i = 0; i < actorCount; i++) {
    const object = r.i32();
    const cc = r.i32();
    const children = [];
    for (let j = 0; j < cc; j++) children.push({ name: r.i32(), actor: r.i32() });
    const oc = r.i32();
    const components = [];
    for (let j = 0; j < oc; j++) components.push({ name: r.i32(), object: r.i32() });
    actors[i] = { object, children, components, transform: readTransform(r) };
  }
  const rootCount = r.u32();
  const rootActors = new Array<number>(rootCount);
  for (let i = 0; i < rootCount; i++) rootActors[i] = r.i32();
  const firstImport = r.u32();
  return { version, names, objects, actors, rootActors, firstImport };
}
function skipTaggedProperties(r: Reader): void {
  for (;;) {
    const name = r.fstring();
    if (name === "None" || name === "") return;
    r.fstring();
    const size = r.i64();
    r.skip(size + 1);
  }
}
export function parseContainer(raw: Uint8Array): RawSave {
  const r = new Reader(raw);
  if (r.u32() !== 0x53415647) throw new Error("Missing GVAS tag after decompression");
  const saveGameVersion = r.i32();
  const packageVersion = r.i32();
  const engine = `${r.u16()}.${r.u16()}.${r.u16()}`;
  r.u32();
  const build = r.fstring();
  r.i32();
  const cvCount = r.u32();
  r.skip(cvCount * 20);
  const saveClass = r.fstring();
  skipTaggedProperties(r);
  r.i32();
  const levelVersion = r.u32();
  r.u8();
  const levelName = r.fstring();
  r.u32();
  const level = readChunk(r);
  const pcCount = r.i32();
  const playerControllers = [];
  for (let i = 0; i < pcCount; i++) playerControllers.push({ actor: r.u32(), pawn: r.u32(), uuid: r.u64hex() });
  const remotePlayers = [];
  if (r.remaining >= 4) {
    const rpCount = r.i32();
    for (let i = 0; i < rpCount && r.remaining > 0; i++) {
      try {
        const chunk = readChunk(r);
        remotePlayers.push({ chunk, uuid: r.u64hex() });
      } catch {
        break;
      }
    }
  }
  return {
    header: { saveGameVersion, packageVersion, engine, build, saveClass },
    levelVersion,
    levelName,
    level,
    playerControllers,
    remotePlayers,
    decompressedSize: raw.length,
  };
}
