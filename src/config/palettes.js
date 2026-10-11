// Curated palettes. Layouts consume only these semantic roles, never raw colours.
export const PALETTES = [
  {
    id: 'warm-paper',
    label: 'Warm paper',
    tone: 'light',
    roles: { canvas: '#F4EFE6', surface: '#FFFCF7', text: '#24211E', mutedText: '#726B62', accent: '#876B51', divider: '#DED6CA' },
  },
  {
    id: 'porcelain',
    label: 'Porcelain',
    tone: 'light',
    roles: { canvas: '#F3F4F2', surface: '#FFFFFF', text: '#1C1F22', mutedText: '#686E73', accent: '#3A5A78', divider: '#D9DCDD' },
  },
  {
    id: 'sage',
    label: 'Sage',
    tone: 'muted',
    roles: { canvas: '#DCE1D5', surface: '#EEF0E8', text: '#1F2A22', mutedText: '#55624F', accent: '#4F6B45', divider: '#C2CAB9' },
  },
  {
    id: 'clay',
    label: 'Clay',
    tone: 'muted',
    roles: { canvas: '#E8D6C8', surface: '#F5EAE0', text: '#2B1D16', mutedText: '#6E5446', accent: '#A4492B', divider: '#D4BBA9' },
  },
  {
    id: 'ink',
    label: 'Ink',
    tone: 'dark',
    roles: { canvas: '#16181D', surface: '#1F2229', text: '#ECEAE4', mutedText: '#9A9890', accent: '#D8B26E', divider: '#33363E' },
  },
  {
    id: 'midnight',
    label: 'Midnight',
    tone: 'dark',
    roles: { canvas: '#0F1A2B', surface: '#16243A', text: '#E6ECF5', mutedText: '#8D9BB0', accent: '#7FB4E6', divider: '#26364F' },
  },
  {
    id: 'newsprint',
    label: 'Newsprint',
    tone: 'high-contrast',
    roles: { canvas: '#FFFFFF', surface: '#FFFFFF', text: '#000000', mutedText: '#3D3D3D', accent: '#D0021B', divider: '#000000' },
  },
  {
    id: 'blackout',
    label: 'Blackout',
    tone: 'high-contrast',
    roles: { canvas: '#000000', surface: '#0B0B0B', text: '#FFFFFF', mutedText: '#C4C4C4', accent: '#F5D90A', divider: '#FFFFFF' },
  },
];

export const DEFAULT_PALETTE_ID = 'warm-paper';

/** Looks up a palette among the built-ins and any user-made palettes. */
export function getPalette(id, custom = []) {
  return PALETTES.find((p) => p.id === id) ?? custom.find((p) => p.id === id) ?? PALETTES[0];
}

export const PALETTE_ROLES = [
  { id: 'canvas', label: 'Canvas' },
  { id: 'surface', label: 'Surface' },
  { id: 'text', label: 'Text' },
  { id: 'mutedText', label: 'Muted text' },
  { id: 'accent', label: 'Accent' },
  { id: 'divider', label: 'Divider' },
];
