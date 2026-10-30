import { svg } from "./dom.ts";

const base = (body: string, viewBox = "0 0 24 24") =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

const ICONS = {
  search: base('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
  chevron: base('<path d="m6 9 6 6 6-6"/>'),
  journey: base('<path d="M4 19V5"/><path d="M4 6h11l-2 3 2 3H4"/><path d="M14 19h6"/><path d="M17 16v6"/>'),
  folder: base('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'),
  plus: base('<path d="M12 5v14M5 12h14"/>'),
  minus: base('<path d="M5 12h14"/>'),
  orbit: base('<circle cx="12" cy="12" r="5"/><path d="M3.5 9.5c-1.6 2.6 5.3 9.4 11.6 11.1 2.3.6 4.2.3 4.9-.9 1-1.8-1.6-5.3-5.9-8.5"/>'),
  xray: base('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
  home: base('<path d="m3 11 9-7 9 7"/><path d="M5 10v10h14V10"/>'),
  close: base('<path d="M6 6l12 12M18 6 6 18"/>'),
  layers: base('<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>'),
  reset: base('<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>'),
  globe: base('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>'),
  upload: base('<path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M4 20h16"/>'),
  fly: base('<path d="M2 12 22 3l-4 18-6-7z"/><path d="m12 14 10-11"/>'),
  copy: base('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>'),
  windows: base('<path d="M3 5.5 11 4.4v7.1H3zM12 4.2 21 3v8.5h-9zM3 12.5h8v7.1L3 18.5zM12 12.5h9V21l-9-1.3z"/>'),
  linux: base(
    '<path d="M12 3c-2.5 0-4 2-4 5 0 1.4-.6 2.3-1.4 3.4C5.6 12.8 5 14.3 5 16c0 1.8 1 3 2.5 3h9c1.5 0 2.5-1.2 2.5-3 0-1.7-.6-3.2-1.6-4.6C16.6 10.3 16 9.4 16 8c0-3-1.5-5-4-5z"/><circle cx="10.5" cy="8" r=".6"/><circle cx="13.5" cy="8" r=".6"/>',
  ),
  deck: base('<rect x="2" y="7" width="20" height="10" rx="3"/><circle cx="7" cy="12" r="1.5"/><circle cx="17" cy="12" r="1.5"/>'),
  xbox: base('<circle cx="12" cy="12" r="9"/><path d="M7 7c3 3 7 7 10 10M17 7c-3 3-7 7-10 10"/>'),
};

export type IconName = keyof typeof ICONS;

export function icon(name: IconName): SVGElement {
  return svg(ICONS[name]);
}
