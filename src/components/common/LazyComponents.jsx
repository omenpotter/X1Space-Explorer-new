import React, { lazy, Suspense, memo } from 'react';
import { Loader2 } from 'lucide-react';

// Minimal loading spinner
const LoadingSpinner = memo(() => (
  <div className="flex items-center justify-center p-8">
    <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
  </div>
));

LoadingSpinner.displayName = 'LoadingSpinner';

// Full page loading
const PageLoader = memo(() => (
  <div className="min-h-[50vh] flex items-center justify-center">
    <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
  </div>
));

PageLoader.displayName = 'PageLoader';

// Lazy wrapper with error boundary
export function lazyWithPreload(importFn) {
  const LazyComponent = lazy(importFn);
  LazyComponent.preload = importFn;
  return LazyComponent;
}

// Suspense wrapper for components
export function withSuspense(Component, fallback = <LoadingSpinner />) {
  return function SuspenseWrapper(props) {
    return (
      <Suspense fallback={fallback}>
        <Component {...props} />
      </Suspense>
    );
  };
}

// Lazy load heavy chart components
export const LazyLineChart = lazyWithPreload(() => 
  import('recharts').then(m => ({ default: m.LineChart }))
);

export const LazyPieChart = lazyWithPreload(() =>
  import('recharts').then(m => ({ default: m.PieChart }))
);

export const LazyBarChart = lazyWithPreload(() =>
  import('recharts').then(m => ({ default: m.BarChart }))
);

// Export loaders
export { LoadingSpinner, PageLoader };