# Save format notes

Reverse-engineered on a 2026 save (Unreal 4.27, `AstroSave` version 52).
Every object decodes with zero unreadable properties.

1. A 16-byte header (`BE 40 37 4A …`), then one zlib stream.
2. GVAS header: engine version, custom versions, the save class `AstroSave`,
   and an empty property list.
3. Level chunk: `u32 version, u8, FString level, u32`, then the chunk body:
   a name table (`i64 count`, 1-based), object records
   (`type, name, flags, saveFlags, outer, customOffset, [size], data, custom`),
   actor records (object, children, components, transform as quaternion +
   translation + scale), root actor indices and the first import index.
4. Player controller records, then one remote-player chunk holding your
   astroneer (`DesignAstro_C`) and backpack items.
5. Object data uses Unreal tagged properties. Names are a single `i32` index
   into the chunk's name table; object references are `i32` object indices.
6. `*ComponentContainer` objects are entity-system blobs with embedded tagged
   property lists, found by tag signature. Class references inside them are
   `(negative tag, name)` pairs. Research progression, research rewards,
   harvest state and power networks live there.
7. Planets sit at fixed offsets in the packed staging map: Sylva at the
   origin, the others at ±816,040 units on an axis. Surface radius is
   estimated from natural landing pads (about 1.2 km for Sylva).
8. Networks: tether posts list the posts they touch; every cable actor records
   its two slots (`SourceSlot.Component`, `TargetSlot.Component`); explicit
   oxygen connections name the cable actor, whose class says whether it is
   power or oxygen.

Coordinates are Unreal's left-handed Z-up frame; the viewer swaps Y and Z and
negates the quaternion's w to get a right-handed Y-up scene.
