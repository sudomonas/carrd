import { useCallback, useEffect, useState } from 'react';
import Studio from './App.jsx';
import Landing from './Landing.jsx';

const isStudio = (path) => path === '/studio' || path.startsWith('/studio/');

/** Two routes: "/" (landing) and "/studio" (the editor). */
export default function Root() {
  const [path, setPath] = useState(() => window.location.pathname);

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    document.title = isStudio(path) ? 'Studio · carrd' : 'carrd · content in, card out';
  }, [path]);

  const navigate = useCallback((to) => {
    if (to !== window.location.pathname) window.history.pushState(null, '', to);
    setPath(to);
    window.scrollTo(0, 0);
  }, []);

  return isStudio(path) ? <Studio onNavigate={navigate} /> : <Landing onNavigate={navigate} />;
}
