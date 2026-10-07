import { useMemo } from 'react'
import { geoEquirectangular, geoPath } from 'd3-geo'
import { feature } from 'topojson-client'
import land110m from 'world-atlas/land-110m.json'
import { cn } from '@/lib/cn'

/**
 * A world map with a pin per site.
 *
 * ── Why this is vector and not tiles ──────────────────────────────────────
 * Natural Earth land geometry, bundled — `world-atlas` (ISC, public-domain
 * data) projected by `d3-geo` (ISC). No API key, no tile server, no network
 * call at runtime, and the whole thing is an SVG, which means it takes theme
 * tokens like every other surface in this product. A raster tile map would be
 * a third-party request on every page load and would still be light grey in
 * dark mode.
 *
 * `land-110m` and not `countries-110m`: 55KB against 108KB, and this is a
 * status map. Borders would be detail nobody on it is reading.
 *
 * ── Why the prototype's version could not work ────────────────────────────
 * It positions pins with `left: {s.lat}%; top: {s.lng}%` on an empty rounded
 * rectangle. Those are not coordinates — a latitude is not a percentage of a
 * width — so its three sites land wherever the arithmetic puts them. Here a
 * real latitude and longitude go through a real projection, and Findlay comes
 * out in Ohio.
 *
 * ── Colour ────────────────────────────────────────────────────────────────
 * Every fill and stroke is a token, so light, dark and colour-blind mode all
 * work. `verify:colors` would fail the build on a literal here, which is
 * exactly the protection an imported map wants.
 *
 * @param {object} props
 * @param {Array<{id: string, name: string, coords: {lat: number, lon: number}, tone: string|null}>} props.sites
 * @param {string} [props.selectedId]
 * @param {(id: string) => void} [props.onSelect]
 */
export function WorldMap({ sites, selectedId, onSelect, label, className }) {
  /* The projection is fixed to the viewBox rather than fitted to the data. A
     three-site estate fitted to its own extent would zoom to the North Atlantic
     and stop reading as the world.

     The 14px vertical offset drops the equator below centre, which puts the
     inhabited northern hemisphere in the middle of the frame and lets Antarctica
     run off the bottom rather than taking a tenth of the height. */
  const { path, place } = useMemo(() => {
    const projection = geoEquirectangular()
      .scale(WIDTH / (2 * Math.PI))
      .translate([WIDTH / 2, HEIGHT / 2 + 14])

    return {
      path: geoPath(projection)(feature(land110m, land110m.objects.land)),
      place: (coords) => projection([coords.lon, coords.lat]),
    }
  }, [])

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label={label}
      className={cn('block h-auto w-full', className)}
    >
      {/* The landmass. One path for the whole world — `land-110m` is already
          dissolved, so there is nothing per-country to draw. */}
      <path d={path} fill="var(--surface-sunken)" stroke="var(--border-hairline)" strokeWidth="0.5" />

      {sites.map((site) => {
        if (!site.coords) return null
        const point = place(site.coords)
        if (!point) return null
        const [x, y] = point
        const selected = site.id === selectedId
        const hue = site.tone ? `var(--hue-${site.tone})` : 'var(--ink-mute)'

        return (
          <g
            key={site.id}
            role={onSelect ? 'button' : undefined}
            tabIndex={onSelect ? 0 : undefined}
            aria-label={site.name}
            aria-pressed={onSelect ? selected : undefined}
            onClick={onSelect ? () => onSelect(site.id) : undefined}
            onKeyDown={
              onSelect
                ? (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      onSelect(site.id)
                    }
                  }
                : undefined
            }
            className={onSelect ? 'cursor-pointer outline-none' : undefined}
          >
            {/* The halo. Sized rather than animated — a pulsing ring on three
                pins is motion with no information in it, and the reduced-motion
                rule would have to switch it off anyway. */}
            <circle cx={x} cy={y} r={selected ? 11 : 8} fill={hue} opacity="0.18" />
            <circle
              cx={x}
              cy={y}
              r={selected ? 5 : 4}
              fill={hue}
              stroke="var(--surface-card)"
              strokeWidth="1.5"
            />
          </g>
        )
      })}
    </svg>
  )
}

/* 2:1, which is the equirectangular projection's own aspect ratio. Any other
   ratio stretches the continents. */
const WIDTH = 720
const HEIGHT = 360
