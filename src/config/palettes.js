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
  {
    id: 'linen',
    label: 'Linen',
    tone: 'light',
    roles: { canvas: '#EFE9DD', surface: '#F8F4EC', text: '#2B2620', mutedText: '#6B6256', accent: '#A84D29', divider: '#DCD3C3' },
  },
  {
    id: 'mist',
    label: 'Mist',
    tone: 'light',
    roles: { canvas: '#E6ECEF', surface: '#F5F8F9', text: '#16232B', mutedText: '#55636C', accent: '#2A6587', divider: '#CDD7DC' },
  },
  {
    id: 'blush',
    label: 'Blush',
    tone: 'muted',
    roles: { canvas: '#F1DFDA', surface: '#F9EFEC', text: '#3A1F1C', mutedText: '#77524D', accent: '#A63A47', divider: '#E2C8C2' },
  },
  {
    id: 'ochre',
    label: 'Ochre',
    tone: 'muted',
    roles: { canvas: '#E9D8A6', surface: '#F4E9C6', text: '#2E2410', mutedText: '#66552B', accent: '#8A3A12', divider: '#D6C088' },
  },
  {
    id: 'lilac',
    label: 'Lilac',
    tone: 'muted',
    roles: { canvas: '#E4E0F0', surface: '#F2EFF9', text: '#221C36', mutedText: '#5B5374', accent: '#5A3EA6', divider: '#CFC8E2' },
  },
  {
    id: 'forest',
    label: 'Forest',
    tone: 'dark',
    roles: { canvas: '#13241C', surface: '#1B3127', text: '#E8EFE6', mutedText: '#9DB3A4', accent: '#D9B44A', divider: '#2A4537' },
  },
  {
    id: 'espresso',
    label: 'Espresso',
    tone: 'dark',
    roles: { canvas: '#231A15', surface: '#2E231C', text: '#F1E6D8', mutedText: '#B39F8A', accent: '#E08A4F', divider: '#43352B' },
  },
  {
    id: 'plum',
    label: 'Plum',
    tone: 'dark',
    roles: { canvas: '#2A1730', surface: '#35203C', text: '#F3E8F2', mutedText: '#B9A2B8', accent: '#F08FB0', divider: '#4A3152' },
  },
  {
    id: 'graphite',
    label: 'Graphite',
    tone: 'dark',
    roles: { canvas: '#26282B', surface: '#2F3236', text: '#F2F2F0', mutedText: '#A5A8AC', accent: '#8FD3C1', divider: '#3E4247' },
  },
  {
    id: 'cobalt',
    label: 'Cobalt',
    tone: 'bold',
    roles: { canvas: '#1F3FCC', surface: '#2848D4', text: '#FFFFFF', mutedText: '#D6DDFF', accent: '#FFD43B', divider: '#5470E0' },
  },
  {
    id: 'tomato',
    label: 'Tomato',
    tone: 'bold',
    roles: { canvas: '#B5301B', surface: '#BF3B25', text: '#FFF4EC', mutedText: '#FFD9C9', accent: '#FFD166', divider: '#CC5A44' },
  },
  {
    id: 'sunflower',
    label: 'Sunflower',
    tone: 'bold',
    roles: { canvas: '#F6CF3A', surface: '#FAE07C', text: '#1A1606', mutedText: '#4A3F12', accent: '#9E1F17', divider: '#DDB72A' },
  },
];

// Display order in the picker: light → muted → dark → high-contrast/bold.
const TONE_ORDER = ['light', 'muted', 'dark', 'high-contrast', 'bold'];
PALETTES.sort((a, b) => TONE_ORDER.indexOf(a.tone) - TONE_ORDER.indexOf(b.tone));

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
