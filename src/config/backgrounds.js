export const BACKGROUNDS = [
  { id: 'paper', label: 'Solid', needs: null },
  { id: 'texture', label: 'Texture', needs: null },
  { id: 'gradient', label: 'Gradient', needs: null },
  { id: 'photo', label: 'Photo', needs: 'backgroundImage' },
  { id: 'source', label: 'Source image', needs: 'contentImage' },
];

export const DEFAULT_BACKGROUND_ID = 'paper';
