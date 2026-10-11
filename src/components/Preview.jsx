import { useLayoutEffect, useRef, useState } from 'react';
import SceneCanvas from './SceneCanvas.jsx';
import { describeCard } from '../engine/compose.js';
import { getLayout } from '../engine/layouts/index.js';

export default function Preview({ scene, images, textures, output, content, fontsReady, fontWarning }) {
  const frameRef = useRef(null);
  const [box, setBox] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setBox({ w: Math.floor(width), h: Math.floor(height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Fit the card inside the stage without changing its output size.
  const aspect = output.width / output.height;
  const displayWidth = Math.max(0, Math.floor(Math.min(box.w, box.h * aspect)));
  const layout = scene?.layoutId ? getLayout(scene.layoutId) : null;
  const notices = scene?.ok ? [...scene.notices] : [];
  if (fontWarning) notices.push({ level: 'warn', text: fontWarning });

  return (
    <div className="preview">
      <div className="preview-frame" ref={frameRef}>
        {!fontsReady || !scene ? (
          <div className="preview-loading" style={{ aspectRatio: `${output.width} / ${output.height}`, width: displayWidth || undefined }}>
            <span>Loading fonts…</span>
          </div>
        ) : scene.ok ? (
          displayWidth > 0 && (
            <SceneCanvas
              key={`${scene.width}x${scene.height}`}
              className="preview-canvas"
              scene={scene}
              displayWidth={displayWidth}
              images={images}
              textures={textures}
              label={`Card preview, ${layout?.label ?? ''} layout. ${describeCard(content)}`}
            />
          )
        ) : (
          <div className="preview-empty" style={{ aspectRatio: `${output.width} / ${output.height}`, width: displayWidth || undefined }}>
            <p>{scene.notices[0]?.text}</p>
          </div>
        )}
      </div>
      <div className="preview-meta">
        <span className="preview-dims">
          <strong>{output.name}</strong> {output.width} × {output.height} px
        </span>
        {layout && <span className="preview-layout">{layout.label}</span>}
      </div>
      {notices.length > 0 && (
        <ul className="notices" aria-live="polite">
          {notices.map((n) => (
            <li key={n.text} className={`note note-${n.level}`}>{n.text}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
