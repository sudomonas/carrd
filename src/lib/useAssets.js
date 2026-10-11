// Image assets kept outside the document: blobs, object URLs, decoded
// elements and luminance stats. Object URLs are revoked on replace/unmount.
import { useCallback, useEffect, useRef, useState } from 'react';
import { constrainImage, decodeImage, lumaGrid } from '../render/images.js';
import { deleteAsset, getAsset, putAsset } from './storage.js';

export const ASSET_IDS = ['upload', 'link', 'background'];

export function useAssets({ onStorageError } = {}) {
  const [assets, setAssets] = useState({});
  const urls = useRef({});
  const tokens = useRef({});

  const release = (id) => {
    if (urls.current[id]) URL.revokeObjectURL(urls.current[id]);
    delete urls.current[id];
  };

  /** Decodes and stores a blob under `id`. Resolves to true on success. */
  const setFromBlob = useCallback(async (id, blob, { persist = true } = {}) => {
    const token = (tokens.current[id] ?? 0) + 1;
    tokens.current[id] = token;
    setAssets((a) => ({ ...a, [id]: { ...a[id], status: 'loading' } }));
    let url = URL.createObjectURL(blob);
    try {
      let img = await decodeImage(url);
      const smaller = await constrainImage(blob, img);
      if (smaller) {
        URL.revokeObjectURL(url);
        blob = smaller;
        url = URL.createObjectURL(blob);
        img = await decodeImage(url);
      }
      if (tokens.current[id] !== token) {
        URL.revokeObjectURL(url);
        return false;
      }
      release(id);
      urls.current[id] = url;
      setAssets((a) => ({
        ...a,
        [id]: { status: 'ready', url, img, blob, width: img.naturalWidth, height: img.naturalHeight, luma: lumaGrid(img) },
      }));
      if (persist) putAsset(id, blob).catch((e) => onStorageError?.(e));
      return true;
    } catch (e) {
      URL.revokeObjectURL(url);
      if (tokens.current[id] === token) {
        setAssets((a) => ({ ...a, [id]: { status: 'error', error: e.message } }));
      }
      return false;
    }
  }, [onStorageError]);

  const remove = useCallback((id) => {
    tokens.current[id] = (tokens.current[id] ?? 0) + 1;
    release(id);
    setAssets((a) => {
      const next = { ...a };
      delete next[id];
      return next;
    });
    deleteAsset(id).catch(() => {});
  }, []);

  // Restore persisted images once.
  useEffect(() => {
    for (const id of ASSET_IDS) {
      getAsset(id)
        .then((blob) => blob instanceof Blob && setFromBlob(id, blob, { persist: false }))
        .catch(() => {});
    }
    return () => {
      for (const id of Object.keys(urls.current)) release(id);
    };
  }, [setFromBlob]);

  return { assets, setFromBlob, remove };
}
