import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { loadFamilies, loadFonts } from '../render/fonts.js';
import { createMeasure } from '../render/measure.js';

/**
 * A canvas measurer, ready once `families` have loaded (all bundled fonts
 * when omitted). Other families keep loading in the background.
 */
export function useMeasure(families) {
  const [ready, setReady] = useState(false);
  const key = families ? families.join('|') : '';
  useEffect(() => {
    let alive = true;
    const needed = key ? loadFamilies(key.split('|')) : loadFonts();
    needed.then(() => alive && setReady(true));
    if (key) loadFonts();
    return () => {
      alive = false;
    };
  }, [key]);
  return useMemo(() => (ready ? createMeasure() : null), [ready]);
}

/** Tracks an element's content width. */
export function useWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([e]) => setWidth(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

/** Adds `is-in` to [data-reveal] children as they scroll into view. */
export function useReveal(rootRef) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    const items = root.querySelectorAll('[data-reveal]');
    if (!('IntersectionObserver' in window)) return undefined;
    root.classList.add('reveal-ready');
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('is-in');
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    );
    items.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [rootRef]);
}
