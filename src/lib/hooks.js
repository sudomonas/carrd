import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { loadFonts } from '../render/fonts.js';
import { createMeasure } from '../render/measure.js';

/** Fonts + a canvas measurer, ready once the bundled faces have loaded. */
export function useMeasure() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    loadFonts().then(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, []);
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
