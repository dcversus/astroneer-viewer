export class Reader {
  readonly bytes: Uint8Array;
  readonly view: DataView;
  pos: number;
  readonly end: number;
  constructor(bytes: Uint8Array, start = 0, end = bytes.length) {
    this.bytes = bytes;
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    this.pos = start;
    this.end = end;
  }
  get remaining(): number {
    return this.end - this.pos;
  }
  need(n: number): void {
    if (n < 0 || this.pos + n > this.end) {
      throw new RangeError(`read past end: need ${n} at ${this.pos}, end ${this.end}`);
    }
  }
  u8(): number {
    this.need(1);
    return this.bytes[this.pos++];
  }
  u16(): number {
    this.need(2);
    const v = this.view.getUint16(this.pos, true);
    this.pos += 2;
    return v;
  }
  i32(): number {
    this.need(4);
    const v = this.view.getInt32(this.pos, true);
    this.pos += 4;
    return v;
  }
  u32(): number {
    this.need(4);
    const v = this.view.getUint32(this.pos, true);
    this.pos += 4;
    return v;
  }
  i64(): number {
    this.need(8);
    const v = this.view.getBigInt64(this.pos, true);
    this.pos += 8;
    return Number(v);
  }
  u64hex(): string {
    this.need(8);
    let s = "";
    for (let i = 7; i >= 0; i--) s += this.bytes[this.pos + i].toString(16).padStart(2, "0");
    this.pos += 8;
    return s;
  }
  f32(): number {
    this.need(4);
    const v = this.view.getFloat32(this.pos, true);
    this.pos += 4;
    return v;
  }
  f64(): number {
    this.need(8);
    const v = this.view.getFloat64(this.pos, true);
    this.pos += 8;
    return v;
  }
  take(n: number): Uint8Array {
    this.need(n);
    const v = this.bytes.subarray(this.pos, this.pos + n);
    this.pos += n;
    return v;
  }
  skip(n: number): void {
    this.need(n);
    this.pos += n;
  }
  guid(): string {
    const b = this.take(16);
    let s = "";
    for (let i = 0; i < 16; i++) s += b[i].toString(16).padStart(2, "0");
    return s;
  }
  fstring(): string {
    const n = this.i32();
    if (n === 0) return "";
    if (n < 0) {
      const len = -n * 2;
      const b = this.take(len);
      return utf16.decode(b.subarray(0, len - 2));
    }
    const b = this.take(n);
    return utf8.decode(b.subarray(0, n - 1));
  }
}
const utf8 = new TextDecoder("utf-8");
const utf16 = new TextDecoder("utf-16le");
