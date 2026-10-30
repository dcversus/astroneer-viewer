import { Reader } from "./reader.ts";
export type Value =
  | null
  | boolean
  | number
  | string
  | Value[]
  | ObjRef
  | {
      [k: string]: Value;
    };
export interface ObjRef {
  $ref: number;
}
export type Props = Record<string, Value>;
const NATIVE_STRUCTS: Record<string, (r: Reader) => Value> = {
  Vector: (r) => ({ x: r.f32(), y: r.f32(), z: r.f32() }),
  Rotator: (r) => ({ pitch: r.f32(), yaw: r.f32(), roll: r.f32() }),
  Quat: (r) => ({ x: r.f32(), y: r.f32(), z: r.f32(), w: r.f32() }),
  Vector2D: (r) => ({ x: r.f32(), y: r.f32() }),
  Vector4: (r) => ({ x: r.f32(), y: r.f32(), z: r.f32(), w: r.f32() }),
  LinearColor: (r) => ({ r: r.f32(), g: r.f32(), b: r.f32(), a: r.f32() }),
  Color: (r) => {
    const b = r.u8(),
      g = r.u8(),
      rr = r.u8(),
      a = r.u8();
    return { r: rr, g, b, a };
  },
  IntPoint: (r) => ({ x: r.i32(), y: r.i32() }),
  IntVector: (r) => ({ x: r.i32(), y: r.i32(), z: r.i32() }),
  Guid: (r) => r.guid(),
  DateTime: (r) => r.i64(),
  Timespan: (r) => r.i64(),
  Box: (r) => ({
    min: { x: r.f32(), y: r.f32(), z: r.f32() },
    max: { x: r.f32(), y: r.f32(), z: r.f32() },
    valid: r.u8(),
  }),
};
export class PropertyDecoder {
  readonly names: string[];
  errors = 0;
  constructor(names: string[]) {
    this.names = names;
  }
  name(i: number): string {
    if (i <= 0) return "None";
    return this.names[i - 1] ?? `#${i}`;
  }
  fname(r: Reader): string {
    return this.name(r.i32());
  }
  readProps(r: Reader): Props {
    const out: Props = {};
    while (r.remaining >= 4) {
      const name = this.fname(r);
      if (name === "None") break;
      const type = this.fname(r);
      const size = r.i32();
      const arrayIndex = r.i32();
      let value: Value;
      try {
        const header = this.readTagHeader(r, type);
        const start = r.pos;
        try {
          value = this.readValue(new Reader(r.bytes, start, start + size), type, header, size);
        } catch {
          this.errors++;
          value = `<${type} ${size}b>`;
        }
        r.pos = start + size;
      } catch {
        this.errors++;
        break;
      }
      const key = arrayIndex > 0 ? `${name}[${arrayIndex}]` : name;
      out[key] = value;
    }
    return out;
  }
  private readTagHeader(r: Reader, type: string): TagHeader {
    const h: TagHeader = {};
    switch (type) {
      case "StructProperty":
        h.struct = this.fname(r);
        r.skip(16);
        break;
      case "BoolProperty":
        h.bool = r.u8() !== 0;
        break;
      case "ByteProperty":
      case "EnumProperty":
        h.enum = this.fname(r);
        break;
      case "ArrayProperty":
      case "SetProperty":
        h.inner = this.fname(r);
        break;
      case "MapProperty":
        h.inner = this.fname(r);
        h.value = this.fname(r);
        break;
    }
    if (r.u8()) r.skip(16);
    return h;
  }
  private readValue(r: Reader, type: string, h: TagHeader, size: number): Value {
    switch (type) {
      case "BoolProperty":
        return h.bool ?? false;
      case "StructProperty":
        return this.readStruct(r, h.struct ?? "");
      case "ArrayProperty":
        return this.readArray(r, h.inner ?? "", size);
      case "SetProperty": {
        r.i32();
        const n = r.i32();
        const arr: Value[] = [];
        for (let i = 0; i < n && r.remaining > 0; i++) arr.push(this.readElement(r, h.inner ?? "", ""));
        return arr;
      }
      case "MapProperty": {
        r.i32();
        const n = r.i32();
        const entries: Value[] = [];
        for (let i = 0; i < n && r.remaining > 0; i++) {
          const k = this.readElement(r, h.inner ?? "", "");
          const v = this.readElement(r, h.value ?? "", "");
          entries.push({ key: k, value: v });
        }
        return entries;
      }
      case "ByteProperty":
        if (size === 1) return r.u8();
        return this.fname(r);
      case "EnumProperty":
        return this.fname(r);
      default:
        return this.readElement(r, type, "");
    }
  }
  private readStruct(r: Reader, struct: string): Value {
    const native = NATIVE_STRUCTS[struct];
    if (native) return native(r);
    if (this.looksTagged(r)) return this.readProps(r);
    const words: number[] = [];
    while (r.remaining >= 4) words.push(r.i32());
    while (r.remaining > 0) words.push(r.u8());
    return { $raw: words };
  }
  private looksTagged(r: Reader): boolean {
    if (r.remaining < 4) return false;
    const first = r.view.getInt32(r.pos, true);
    if (first > 0 && this.name(first) === "None") return true;
    if (r.remaining < 8 || first <= 0 || first > this.names.length) return false;
    const type = r.view.getInt32(r.pos + 4, true);
    return type > 0 && type <= this.names.length && this.name(type).endsWith("Property");
  }
  private readArray(r: Reader, inner: string, size: number): Value {
    const n = r.i32();
    if (inner === "StructProperty") {
      this.fname(r);
      this.fname(r);
      r.i32();
      r.i32();
      const struct = this.fname(r);
      r.skip(16);
      if (r.u8()) r.skip(16);
      const arr: Value[] = [];
      for (let i = 0; i < n && r.remaining > 0; i++) arr.push(this.readStruct(r, struct));
      return arr;
    }
    if (inner === "ByteProperty" && size - 4 === n) {
      return Array.from(r.take(n));
    }
    if (inner === "ObjectProperty" && n > 0 && size - 4 === n * 8) {
      const arr: Value[] = [];
      for (let i = 0; i < n; i++) {
        const a = r.i32();
        const b = r.i32();
        arr.push(a < 0 ? this.name(b) : { $ref: a });
      }
      return arr;
    }
    const arr: Value[] = [];
    for (let i = 0; i < n && r.remaining > 0; i++) arr.push(this.readElement(r, inner, ""));
    return arr;
  }
  private readElement(r: Reader, type: string, struct: string): Value {
    switch (type) {
      case "IntProperty":
        return r.i32();
      case "UInt32Property":
        return r.u32();
      case "Int64Property":
      case "UInt64Property":
        return r.i64();
      case "Int16Property":
        return (r.u16() << 16) >> 16;
      case "UInt16Property":
        return r.u16();
      case "Int8Property":
        return (r.u8() << 24) >> 24;
      case "FloatProperty":
        return r.f32();
      case "DoubleProperty":
        return r.f64();
      case "BoolProperty":
        return r.u8() !== 0;
      case "ByteProperty":
        return r.u8();
      case "EnumProperty":
      case "NameProperty":
        return this.fname(r);
      case "StrProperty":
        return r.fstring();
      case "TextProperty":
        return this.readText(r);
      case "ObjectProperty":
      case "WeakObjectProperty":
      case "LazyObjectProperty":
      case "InterfaceProperty": {
        const i = r.i32();
        return i < 0 ? null : { $ref: i };
      }
      case "SoftObjectProperty":
        return this.fname(r) + (r.remaining >= 4 ? r.fstring() : "");
      case "StructProperty":
        if (struct) return this.readStruct(r, struct);
        return this.readProps(r);
      default:
        throw new Error(`unknown element type ${type}`);
    }
  }
  private readText(r: Reader): Value {
    r.u32();
    const history = (r.u8() << 24) >> 24;
    if (history === -1) {
      const has = r.u32();
      return has ? r.fstring() : "";
    }
    if (history === 0) {
      const ns = r.fstring();
      const key = r.fstring();
      const src = r.fstring();
      return src || `${ns}:${key}`;
    }
    if (history === 11) {
      const table = r.fstring();
      const key = r.fstring();
      return `${table}:${key}`;
    }
    return `<text h${history}>`;
  }
}
interface TagHeader {
  struct?: string;
  bool?: boolean;
  enum?: string;
  inner?: string;
  value?: string;
}
