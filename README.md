# Astroneer Viewer

[![CI](https://github.com/dcversus/astroneer-viewer/actions/workflows/ci.yml/badge.svg)](https://github.com/dcversus/astroneer-viewer/actions/workflows/ci.yml)
[![License: GPL v3](https://img.shields.io/badge/license-GPL--3.0-blue.svg)](LICENSE)
[![Open the viewer](https://img.shields.io/badge/open-viewer-ffb547)](https://dcversus.github.io/astroneer-viewer/)
[![Docs](https://img.shields.io/badge/docs-vitepress-5ce1e6)](https://dcversus.github.io/astroneer-viewer/docs/)

Open an Astroneer `.savegame` and explore your worlds in 3D, entirely in the
browser. Nothing is uploaded; the file is parsed in a Web Worker on your
machine.

**[Open the viewer](https://dcversus.github.io/astroneer-viewer/)** ·
**[Documentation](https://dcversus.github.io/astroneer-viewer/docs/)**

## What you get

- **A world chooser**: Sylva, Desolo, Calidor, Vesania, Novus, Glacio, Atrox
  and Orbit, each with your counts and status.
- **A 3D map** shaped from the real elevations in your save, with low-poly
  miniatures for every object placed at its true position and heading:
  shelter, platforms and modules, rovers, beacons, tethers, research, wrecks,
  plants, deaths and more.
- **Google-Earth-style control**: drag to spin or pan, wheel or pinch to zoom
  toward the cursor, the view leans over as you get close, right-drag or two
  fingers to tilt and turn, double-click to dive, "Orbit" to return.
- **Pins that cluster**: counted bubbles form on crowded spots and only
  re-form when the zoom changes; click one to zoom in. Labels for key things.
- **Networks**: blue oxygen tethers and yellow power cables drawn between the
  things they connect, underground runs included.
- **One search box** for everything: type to find, toggle layers with icon
  chips, filter to this world or all worlds, and get a "Worth a visit" list.
  Defaults are spoiler-free (you, your home and what you built); "My stuff
  only" brings that back.
- **X-ray** makes the ground translucent and dives underground to show cave
  tethers, buried items and gateway cores.
- **Journey**: research bytes earned and still lying around, blueprints,
  missions with progress and a timeline, deaths, backpack contents, settings,
  and a browser for every object in the save.

## Where saves live

| Platform                    | Path                                                                                                                                                                                           |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Steam on Windows            | `%LocalAppData%\Astro\Saved\SaveGames`                                                                                                                                                         |
| Steam on Linux (Proton)     | `~/.steam/steam/steamapps/compatdata/361420/pfx/drive_c/users/steamuser/AppData/Local/Astro/Saved/SaveGames`                                                                                   |
| Steam Deck                  | `/home/deck/.local/share/Steam/steamapps/compatdata/361420/pfx/drive_c/users/steamuser/AppData/Local/Astro/Saved/SaveGames`                                                                    |
| Microsoft Store / Game Pass | `%LocalAppData%\Packages\SystemEraSoftworks.29415440E1269_ftk5pbg2rayv2\SystemAppData\wgs` (container format; convert with [AstroSaveConverter](https://github.com/Tignus/AstroSaveConverter)) |

## Run it locally

```bash
npm install
npm run dev
```

`npm run check` runs types, lint, formatting and tests; `npm run build`
produces the static site. Node 22 or newer.

## How it works

The save is a 16-byte header followed by a zlib stream containing a GVAS
archive: a name table, object records with tagged properties, actor records
with transforms, and a player chunk. See the
[save format notes](https://dcversus.github.io/astroneer-viewer/docs/save-format)
for the details that were reverse-engineered for this project.

Terrain shape comes from the measured altitude of every surface object in your
save; procedural relief fills the parts you have not visited. Miniatures are
built in code, so a smelter looks like a smelter without using game assets.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). The code has no comments by rule, so
good names and small functions matter.

## Credits

Container layout first documented by
[ricky-davis/astro_save_parser](https://github.com/ricky-davis/astro_save_parser)
(also used by [Floffah/astroeditor](https://github.com/Floffah/astroeditor)).
[Tignus/AstroSaveConverter](https://github.com/Tignus/AstroSaveConverter)
handles Microsoft Store containers.

## License

GPL-3.0-only. See [LICENSE](LICENSE).
