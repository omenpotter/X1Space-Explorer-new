import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { geoGraticule10, geoNaturalEarth1, geoPath } from 'd3-geo';
import { feature, mesh } from 'topojson-client';
import { Minus, Plus, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

const WIDTH = 960;
const HEIGHT = 500;
const MIN_ZOOM = 1;
const MAX_ZOOM = 8;

const projection = geoNaturalEarth1().fitExtent([[8, 8], [WIDTH - 8, HEIGHT - 8]], { type: 'Sphere' });
const path = geoPath(projection);

const clampView = (v) => {
  const k = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.k));
  // Keep the map inside the frame at every zoom level.
  const x = Math.min(0, Math.max(WIDTH * (1 - k), v.x));
  const y = Math.min(0, Math.max(HEIGHT * (1 - k), v.y));
  return { k, x, y };
};

/**
 * Self-contained SVG world map. No tile servers or third-party requests: the country
 * outlines ship with the app, so the map renders even when external hosts are blocked.
 *
 * markers: [{ id, lat, lon, radius, tone, hollow, label }]
 */
/** @param {{ markers?: any, selectedId?: any, onSelect?: any, renderTooltip?: any, className?: any, [key: string]: any }} props */
export default function WorldMap({ markers, selectedId, onSelect, renderTooltip, className }) {
  const [shapes, setShapes] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [view, setView] = useState({ k: 1, x: 0, y: 0 });
  const [hover, setHover] = useState(null);
  const svgRef = useRef(null);
  const drag = useRef(null);

  useEffect(() => {
    let alive = true;
    // Loaded on demand so the outlines are not part of the initial bundle.
    import('world-atlas/countries-110m.json')
      .then((mod) => {
        if (!alive) return;
        /** @type {any} */
        const topo = mod.default || mod;
        setShapes({
          land: path(feature(topo, topo.objects.land)),
          borders: path(mesh(topo, topo.objects.countries, (a, b) => a !== b)),
          sphere: path({ type: 'Sphere' }),
          graticule: path(geoGraticule10()),
        });
      })
      .catch(() => alive && setLoadError(true));
    return () => {
      alive = false;
    };
  }, []);

  const placed = useMemo(
    () => (markers || [])
      .map((m) => {
        const p = projection([m.lon, m.lat]);
        return p && Number.isFinite(p[0]) && Number.isFinite(p[1]) ? { ...m, x: p[0], y: p[1] } : null;
      })
      .filter(Boolean)
      // Draw large markers first so small ones stay clickable on top.
      .sort((a, b) => b.radius - a.radius),
    [markers],
  );

  const zoomBy = useCallback((factor, cx = WIDTH / 2, cy = HEIGHT / 2) => {
    setView((v) => {
      const k = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.k * factor));
      const ratio = k / v.k;
      return clampView({ k, x: cx - (cx - v.x) * ratio, y: cy - (cy - v.y) * ratio });
    });
  }, []);

  const toSvg = (e) => {
    const rect = svgRef.current.getBoundingClientRect();
    return [((e.clientX - rect.left) / rect.width) * WIDTH, ((e.clientY - rect.top) / rect.height) * HEIGHT];
  };

  // Ctrl/Cmd + wheel zooms; a plain wheel scrolls the page as usual.
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return undefined;
    const onWheel = (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const [cx, cy] = toSvg(e);
      zoomBy(e.deltaY < 0 ? 1.25 : 0.8, cx, cy);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomBy]);

  const onPointerDown = (e) => {
    if (e.button !== 0 || e.target.closest('[data-marker]')) return;
    drag.current = { px: e.clientX, py: e.clientY, x: view.x, y: view.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!drag.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const dx = ((e.clientX - drag.current.px) / rect.width) * WIDTH;
    const dy = ((e.clientY - drag.current.py) / rect.height) * HEIGHT;
    setView((v) => clampView({ k: v.k, x: drag.current.x + dx, y: drag.current.y + dy }));
  };
  const onPointerUp = () => {
    drag.current = null;
  };

  const onKeyDown = (e) => {
    const step = 40;
    const moves = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    if (moves[e.key]) {
      e.preventDefault();
      setView((v) => clampView({ k: v.k, x: v.x + moves[e.key][0], y: v.y + moves[e.key][1] }));
    } else if (e.key === '+' || e.key === '=') zoomBy(1.4);
    else if (e.key === '-') zoomBy(1 / 1.4);
    else if (e.key === '0') setView({ k: 1, x: 0, y: 0 });
  };

  const tip = hover && placed.find((m) => m.id === hover);
  const tipLeft = tip ? ((tip.x * view.k + view.x) / WIDTH) * 100 : 0;
  const tipTop = tip ? ((tip.y * view.k + view.y) / HEIGHT) * 100 : 0;

  return (
    <div className={cn('relative overflow-hidden rounded-xl bg-[radial-gradient(ellipse_at_50%_40%,hsl(var(--surface-2)),hsl(var(--canvas))_75%)]', className)}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="group"
        aria-label="World map of validator locations. Use arrow keys to pan, plus and minus to zoom, zero to reset."
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className={cn('block h-auto w-full touch-pan-y select-none', drag.current ? 'cursor-grabbing' : 'cursor-grab')}
        style={{ aspectRatio: `${WIDTH} / ${HEIGHT}` }}
      >
        <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
          {shapes && (
            <>
              <path d={shapes.sphere} fill="hsl(var(--surface-1))" stroke="hsl(var(--line))" strokeWidth={1 / view.k} />
              <path d={shapes.graticule} fill="none" stroke="hsl(var(--line))" strokeOpacity="0.45" strokeWidth={0.4 / view.k} />
              <path d={shapes.land} fill="hsl(var(--surface-3))" />
              <path d={shapes.borders} fill="none" stroke="hsl(var(--canvas))" strokeOpacity="0.7" strokeWidth={0.6 / view.k} />
            </>
          )}
          {placed.map((m) => {
            const r = m.radius / Math.sqrt(view.k);
            const color = m.tone === 'negative' ? 'hsl(var(--negative))' : m.tone === 'warning' ? 'hsl(var(--warning))' : 'hsl(var(--brand))';
            const active = m.id === selectedId;
            return (
              <g
                key={m.id}
                data-marker={m.id}
                role="button"
                tabIndex={0}
                aria-label={m.label}
                aria-pressed={active}
                transform={`translate(${m.x} ${m.y})`}
                className="cursor-pointer outline-none [&:focus-visible>circle:first-child]:stroke-white"
                onClick={() => onSelect?.(m.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    onSelect?.(m.id);
                  }
                }}
                onMouseEnter={() => setHover(m.id)}
                onMouseLeave={() => setHover((h) => (h === m.id ? null : h))}
                onFocus={() => setHover(m.id)}
                onBlur={() => setHover((h) => (h === m.id ? null : h))}
              >
                {/* Country-level positions are drawn hollow and dashed: they mark a country, not a site. */}
                <circle
                  r={r}
                  fill={color}
                  fillOpacity={m.hollow ? 0.1 : 0.32}
                  stroke={active ? '#fff' : color}
                  strokeWidth={(active ? 2 : 1.2) / view.k}
                  strokeDasharray={m.hollow ? `${3 / view.k} ${2.5 / view.k}` : undefined}
                />
                {!m.hollow && <circle r={Math.max(1.2, r * 0.22)} fill={color} />}
              </g>
            );
          })}
        </g>
      </svg>

      {!shapes && !loadError && <div className="skeleton absolute inset-0" role="status" aria-label="Loading map" />}
      {loadError && <p role="alert" className="absolute inset-x-0 top-4 text-center text-sm text-negative">The map outlines could not be loaded. Location data is still listed below.</p>}

      {tip && renderTooltip && (
        <div
          role="tooltip"
          className="pointer-events-none absolute z-10 w-56 -translate-x-1/2 rounded-lg border border-line-strong bg-surface-2/95 p-3 text-xs shadow-2xl backdrop-blur"
          style={{ left: `${Math.min(84, Math.max(16, tipLeft))}%`, top: `${tipTop}%`, transform: `translate(-50%, ${tipTop > 55 ? 'calc(-100% - 14px)' : '14px'})` }}
        >
          {renderTooltip(tip)}
        </div>
      )}

      <div className="absolute bottom-3 right-3 flex flex-col overflow-hidden rounded-lg border border-line-strong bg-surface-2/90 backdrop-blur">
        <button type="button" onClick={() => zoomBy(1.5)} disabled={view.k >= MAX_ZOOM} aria-label="Zoom in" className="p-2 text-ink-soft transition-colors hover:bg-surface-3 hover:text-ink disabled:opacity-40">
          <Plus className="h-4 w-4" aria-hidden="true" />
        </button>
        <button type="button" onClick={() => zoomBy(1 / 1.5)} disabled={view.k <= MIN_ZOOM} aria-label="Zoom out" className="border-t border-line p-2 text-ink-soft transition-colors hover:bg-surface-3 hover:text-ink disabled:opacity-40">
          <Minus className="h-4 w-4" aria-hidden="true" />
        </button>
        <button type="button" onClick={() => setView({ k: 1, x: 0, y: 0 })} disabled={view.k === 1 && view.x === 0 && view.y === 0} aria-label="Reset map view" className="border-t border-line p-2 text-ink-soft transition-colors hover:bg-surface-3 hover:text-ink disabled:opacity-40">
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
