import React, { useState, useEffect, memo } from 'react';

// Defers rendering of non-critical content until after initial paint
const DeferredRender = memo(({ 
  children, 
  delay = 0,
  fallback = null,
  priority = 'low' // 'high' = requestAnimationFrame, 'low' = requestIdleCallback
}) => {
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (priority === 'high') {
      // Use rAF for higher priority deferred content
      const id = requestAnimationFrame(() => {
        if (delay > 0) {
          setTimeout(() => setShouldRender(true), delay);
        } else {
          setShouldRender(true);
        }
      });
      return () => cancelAnimationFrame(id);
    } else {
      // Use requestIdleCallback for low priority content
      if ('requestIdleCallback' in window) {
        const id = requestIdleCallback(() => {
          if (delay > 0) {
            setTimeout(() => setShouldRender(true), delay);
          } else {
            setShouldRender(true);
          }
        }, { timeout: 2000 });
        return () => cancelIdleCallback(id);
      } else {
        // Fallback for browsers without requestIdleCallback
        const id = setTimeout(() => setShouldRender(true), delay + 100);
        return () => clearTimeout(id);
      }
    }
  }, [delay, priority]);

  return shouldRender ? children : fallback;
});

DeferredRender.displayName = 'DeferredRender';

// Hook for deferred initialization
export function useDeferred(delay = 0) {
  const [ready, setReady] = useState(false);
  
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      if (delay > 0) {
        setTimeout(() => setReady(true), delay);
      } else {
        setReady(true);
      }
    });
    return () => cancelAnimationFrame(id);
  }, [delay]);
  
  return ready;
}

export default DeferredRender;