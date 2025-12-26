import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import Stats from 'stats.js';

const StatsPanel = () => {
  const statsRef = useRef<Stats | null>(null);

  useEffect(() => {
    if (!import.meta.env.DEV) return undefined;

    const stats = new Stats();
    stats.showPanel(0);
    stats.dom.style.cssText =
      'position:fixed;left:12px;top:12px;z-index:30;opacity:0.9;filter:drop-shadow(0 4px 10px rgba(0,0,0,0.35));';

    document.body.appendChild(stats.dom);
    statsRef.current = stats;

    return () => {
      stats.dom.remove();
      statsRef.current = null;
    };
  }, []);

  useFrame(() => {
    statsRef.current?.update();
  });

  return null;
};

export default StatsPanel;
