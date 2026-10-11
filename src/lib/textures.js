import { useEffect, useState } from 'react';
import { TEXTURES } from '../config/backgrounds.js';
import paper from '../assets/textures/paper.png';
import linen from '../assets/textures/linen.png';
import grain from '../assets/textures/grain.png';
import dots from '../assets/textures/dots.png';
import grid from '../assets/textures/grid.png';
import lines from '../assets/textures/lines.png';

export const TEXTURE_URLS = { paper, linen, grain, dots, grid, lines };

let loading = null;

/** Loads every texture tile once; resolves to { [id]: HTMLImageElement } (failed tiles omitted). */
export function loadTextures() {
  if (!loading) {
    loading = Promise.all(
      TEXTURES.map(
        (t) =>
          new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve([t.id, img]);
            img.onerror = () => resolve(null);
            img.src = TEXTURE_URLS[t.id];
          }),
      ),
    ).then((entries) => Object.fromEntries(entries.filter(Boolean)));
  }
  return loading;
}

/** React hook: the loaded texture map ({} until ready). */
export function useTextures() {
  const [textures, setTextures] = useState({});
  useEffect(() => {
    let alive = true;
    loadTextures().then((t) => alive && setTextures(t));
    return () => {
      alive = false;
    };
  }, []);
  return textures;
}
