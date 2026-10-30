import { inflate, parseContainer } from "./save/container.ts";
import { buildWorld, type BuiltWorld } from "./model/extract.ts";
import type { ChunkId } from "./model/types.ts";
export type WorkerRequest =
  | {
      kind: "parse";
      name: string;
      bytes: ArrayBuffer;
    }
  | {
      kind: "details";
      id: number;
      seq: number;
    }
  | {
      kind: "query";
      seq: number;
      op: "catalog";
    }
  | {
      kind: "query";
      seq: number;
      op: "objects";
      chunk: ChunkId;
      type: string;
    }
  | {
      kind: "query";
      seq: number;
      op: "object";
      chunk: ChunkId;
      index: number;
    };
export type WorkerResponse =
  | { kind: "model"; model: BuiltWorld["model"] }
  | { kind: "error"; message: string }
  | { kind: "details"; seq: number; id: number; nodes: ReturnType<BuiltWorld["details"]> }
  | { kind: "query"; seq: number; result: unknown };
let world: BuiltWorld | null = null;
self.onmessage = async (ev: MessageEvent<WorkerRequest>) => {
  const msg = ev.data;
  if (msg.kind === "parse") {
    try {
      const t0 = performance.now();
      const raw = parseContainer(await inflate(new Uint8Array(msg.bytes)));
      world = buildWorld(raw, msg.name, performance.now() - t0);
      postMessage({ kind: "model", model: world.model });
    } catch (err) {
      postMessage({ kind: "error", message: err instanceof Error ? err.message : String(err) });
    }
  } else if (msg.kind === "query") {
    const result = !world
      ? null
      : msg.op === "catalog"
        ? world.catalog()
        : msg.op === "objects"
          ? world.objects(msg.chunk, msg.type)
          : world.object(msg.chunk, msg.index);
    postMessage({ kind: "query", seq: msg.seq, result });
  } else if (msg.kind === "details") {
    postMessage({ kind: "details", seq: msg.seq, id: msg.id, nodes: world ? world.details(msg.id) : [] });
  }
};
