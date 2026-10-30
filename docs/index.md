---
layout: home
hero:
  name: Astroneer Viewer
  text: Your worlds, mapped in 3D.
  tagline: Open a save and see bases, tethers, vehicles, deaths, research and missions. Nothing leaves your browser.
  actions:
    - theme: brand
      text: Open the viewer
      link: https://dcversus.github.io/astroneer-viewer/
    - theme: alt
      text: Save format notes
      link: /save-format
features:
  - title: Real terrain
    details: Elevation is rebuilt from the measured altitude of every object in your save; untouched regions use procedural relief in each planet's style.
  - title: Google-Earth control
    details: Grab the ground, zoom toward the cursor, lean over as you get close, tilt with right-drag or two fingers.
  - title: Spoiler-free by default
    details: You, your home and what you built. Turn on more layers when you want to discover.
  - title: Everything in the save
    details: All objects are decoded, with an Advanced browser for the raw data when you want it.
---

## Where saves live

| Platform                    | Path                                                                                                                              |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Steam on Windows            | `%LocalAppData%\Astro\Saved\SaveGames`                                                                                            |
| Steam on Linux (Proton)     | `~/.steam/steam/steamapps/compatdata/361420/pfx/drive_c/users/steamuser/AppData/Local/Astro/Saved/SaveGames`                      |
| Steam Deck                  | `/home/deck/.local/share/Steam/steamapps/compatdata/361420/pfx/drive_c/users/steamuser/AppData/Local/Astro/Saved/SaveGames`       |
| Microsoft Store / Game Pass | `%LocalAppData%\Packages\SystemEraSoftworks.29415440E1269_ftk5pbg2rayv2\SystemAppData\wgs`, convert with AstroSaveConverter first |

## Controls

| Gesture                  | Effect                                                       |
| ------------------------ | ------------------------------------------------------------ |
| Drag                     | Spin the globe from far away, pan the ground up close        |
| Wheel / pinch            | Zoom toward the cursor; the view leans over as you get close |
| Right-drag / two fingers | Tilt and turn                                                |
| Double-click             | Dive toward that spot                                        |
| Orbit button             | Back to space                                                |
| `/`                      | Focus the search box                                         |
| `x`                      | Toggle X-ray                                                 |
