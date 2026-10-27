import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  setOptOut,
  trackChange,
  trackClick,
  trackPageEnter,
  trackPageHide,
  trackPageShow,
  trackScroll,
} from '../lib/tracker';

const SCROLL_THROTTLE_MS = 200;

// Registra por onde a pessoa passa (páginas, cliques, rolagem, tempo) para o painel de análises.
// Fica dentro do HashRouter e não desenha nada.
export const TrackerProvider: React.FC = () => {
  const location = useLocation();

  // ?no_track=1 (no endereço ou depois do #) desliga o registro neste navegador.
  useEffect(() => {
    if (new URLSearchParams(location.search).get('no_track') === '1' || new URLSearchParams(window.location.search).get('no_track') === '1') {
      setOptOut(true);
    }
  }, [location.search]);

  useEffect(() => {
    trackPageEnter(location.pathname);
  }, [location.pathname]);

  useEffect(() => {
    let last = 0;
    const onScroll = () => {
      const now = Date.now();
      if (now - last < SCROLL_THROTTLE_MS) return;
      last = now;
      trackScroll();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') trackPageHide();
      else trackPageShow();
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('click', trackClick, { passive: true, capture: true });
    document.addEventListener('change', trackChange, { passive: true, capture: true });
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', trackPageHide);
    return () => {
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('click', trackClick, { capture: true });
      document.removeEventListener('change', trackChange, { capture: true });
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', trackPageHide);
    };
  }, []);

  return null;
};
