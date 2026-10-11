import { useEffect, useRef } from 'react';
import { renderScene } from '../render/canvas.js';

/**
 * Renders a composed scene at `displayWidth` CSS pixels. The bitmap is drawn
 * at device resolution (never above the output size) from the same vector
 * scene used for export, so the preview is never a stretched bitmap.
 */
export default function SceneCanvas({ scene, displayWidth, images, texture, label, className }) {
  const ref = useRef(null);
  const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 3) : 1;
  const scale = scene ? Math.min(1, (displayWidth * dpr) / scene.width) : 1;
  const bw = scene ? Math.max(1, Math.round(scene.width * scale)) : 1;
  const bh = scene ? Math.max(1, Math.round(scene.height * scale)) : 1;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !scene) return;
    const ctx = canvas.getContext('2d');
    renderScene(ctx, scene, { scale: bw / scene.width, images, texture });
  }, [scene, bw, images, texture]);

  if (!scene) return null;
  return (
    <canvas
      ref={ref}
      width={bw}
      height={bh}
      className={className}
      style={{ width: displayWidth, height: (displayWidth * scene.height) / scene.width }}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}
