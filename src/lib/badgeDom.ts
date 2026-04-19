// ── Class name constants ────────────────────────────────────────────────────────
// These classes are the public API for querying/updating badge DOM nodes.

/** Root container holding all badge rows */
export const CLASS_CONTAINER = 'js-rating-badge'

/** Individual badge row: js-rating-steamdb, js-rating-opencritic, js-rating-metacritic */
export function classBadgeRow(name: string): string { return `js-rating-${name}` }

/** Span displaying the source name (e.g. "SteamDB") */
export const CLASS_LABEL = 'js-rating-label'

/** Span displaying the score value (e.g. "82%") */
export const CLASS_VALUE = 'js-rating-value'

// ── Style constants ─────────────────────────────────────────────────────────────

export const BADGE_PADDING   = '2px 8px'
export const BADGE_RADIUS    = 4
export const BADGE_FONT_SIZE = 12
export const BADGE_BG        = 'rgba(0,0,0,0.6)'
export const BADGE_BLUR      = 'blur(8px)'
export const BADGE_GAP       = 4

export function badgeRowCss(): string {
  return (
    `display:flex;align-items:center;justify-content:space-between;gap:${BADGE_GAP}px;` +
    `background:${BADGE_BG};backdrop-filter:${BADGE_BLUR};color:#fff;` +
    `padding:${BADGE_PADDING};border-radius:${BADGE_RADIUS}px;` +
    `font-size:${BADGE_FONT_SIZE}px;font-weight:bold;cursor:pointer;white-space:nowrap;`
  )
}

export function containerCss(positionCss: string): string {
  return `position:fixed;${positionCss}z-index:999999;display:flex;flex-direction:column;gap:${BADGE_GAP}px;`
}

// ── Badge sources ───────────────────────────────────────────────────────────────

export interface BadgeSource {
  name: string
  label: string
  defaultUrl: string
}

export const BADGE_SOURCES: BadgeSource[] = [
  { name: 'steamdb',     label: 'SteamDB',     defaultUrl: 'https://www.steamdb.info/' },
  { name: 'opencritic',  label: 'OpenCritic',  defaultUrl: 'https://opencritic.com/'   },
  { name: 'metacritic',  label: 'Metacritic',  defaultUrl: 'https://www.metacritic.com/' },
]

// ── DOM functions ───────────────────────────────────────────────────────────────
// These are plain functions with no imports so they can be .toString()'d and
// inlined into injected scripts (e.g. StorePatch's WebSocket-based injection).

/**
 * Creates and appends a badge container to `document.body`.
 * If a container already exists it is removed first.
 *
 * @param positionCss  Inline CSS fragment for positioning, e.g. `"bottom:24px;left:24px;"`
 * @returns The created container element
 */
export function createBadgeContainer(positionCss: string): HTMLElement {
  const CONTAINER_CLASS = 'js-rating-badge'
  const ROW_PREFIX      = 'js-rating-'
  const LABEL_CLASS     = 'js-rating-label'
  const VALUE_CLASS     = 'js-rating-value'
  const GAP             = 4
  const BG              = 'rgba(0,0,0,0.6)'
  const BLUR            = 'blur(8px)'
  const PADDING         = '2px 8px'
  const RADIUS          = 4
  const FONT_SIZE       = 12

  const sources = [
    { name: 'steamdb',    label: 'SteamDB',    url: 'https://www.steamdb.info/'         },
    { name: 'opencritic', label: 'OpenCritic', url: 'https://opencritic.com/'           },
    { name: 'metacritic', label: 'Metacritic', url: 'https://www.metacritic.com/'       },
  ]

  function createLoadingPlaceholder(): HTMLElement {
    const wrapper = document.createElement('span')
    for (var d = 0; d < 3; d++) {
      var dot = document.createElement('span')
      dot.className = 'js-rating-dot'
      dot.textContent = '.'
      wrapper.appendChild(dot)
    }
    return wrapper
  }

  // Remove existing container
  const existing = document.querySelector('.' + CONTAINER_CLASS)
  if (existing) existing.remove()

  // Inject bouncing-dots keyframe animation once
  const STYLE_ID = 'js-rating-bounce-style'
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style')
    style.id = STYLE_ID
    style.textContent = (
      '@keyframes js-rating-bounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-4px)}}' +
      '.js-rating-dot{display:inline-block;animation:js-rating-bounce 1.2s ease-in-out infinite}' +
      '.js-rating-dot:nth-child(2){animation-delay:0.2s}' +
      '.js-rating-dot:nth-child(3){animation-delay:0.4s}'
    )
    document.head.appendChild(style)
  }

  // Build container
  const container = document.createElement('div')
  container.className = CONTAINER_CLASS
  container.style.cssText = (
    'position:fixed;' + positionCss +
    'z-index:999999;display:flex;flex-direction:column;gap:' + GAP + 'px;'
  )

  // Build badge rows
  const rowCss = (
    'display:flex;align-items:center;justify-content:space-between;gap:' + GAP + 'px;' +
    'background:' + BG + ';backdrop-filter:' + BLUR + ';color:#fff;' +
    'padding:' + PADDING + ';border-radius:' + RADIUS + 'px;' +
    'font-size:' + FONT_SIZE + 'px;font-weight:bold;cursor:pointer;white-space:nowrap;'
  )

  sources.forEach(function(source) {
    const row = document.createElement('div')
    row.className = ROW_PREFIX + source.name
    row.style.cssText = rowCss
    row.setAttribute('data-url', source.url)
    row.addEventListener('click', function() {
      window.open(row.getAttribute('data-url') || source.url, '_blank')
    })

    const labelSpan = document.createElement('span')
    labelSpan.className = LABEL_CLASS
    labelSpan.style.cssText = 'opacity:0.75;'
    labelSpan.textContent = source.label

    const valueSpan = document.createElement('span')
    valueSpan.className = VALUE_CLASS
    valueSpan.style.cssText = 'text-align:right;'
    valueSpan.appendChild(createLoadingPlaceholder())

    row.appendChild(labelSpan)
    row.appendChild(valueSpan)
    container.appendChild(row)
  })

  document.body.appendChild(container)
  return container
}

/**
 * Updates the value and URL of a specific badge row inside the container.
 *
 * @param name   Badge name matching the `js-rating-{name}` class (e.g. `"steamdb"`)
 * @param value  Display text for the score (e.g. `"82%"` or `"-"`)
 * @param url    URL to navigate to on click
 * @param root   Optional root element to search within (defaults to `document`)
 */
export function updateBadgeValue(name: string, value: string, url: string, root?: Document | Element): void {
  const ROW_PREFIX  = 'js-rating-'
  const VALUE_CLASS = 'js-rating-value'
  const searchRoot  = root || document
  const row = searchRoot.querySelector('.' + ROW_PREFIX + name) as HTMLElement | null
  if (!row) return
  const valueSpan = row.querySelector('.' + VALUE_CLASS) as HTMLElement | null
  if (valueSpan) valueSpan.textContent = value
  row.setAttribute('data-url', url)
}

/**
 * Repositions the badge container by updating its inline style.
 *
 * @param positionCss  Inline CSS fragment, e.g. `"bottom:24px;right:24px;"`
 * @param root         Optional root element to search within (defaults to `document`)
 */
export function repositionBadgeContainer(positionCss: string, root?: Document | Element): void {
  const CONTAINER_CLASS = 'js-rating-badge'
  const GAP             = 4
  const searchRoot = root || document
  const container = searchRoot.querySelector('.' + CONTAINER_CLASS) as HTMLElement | null
  if (!container) return
  container.style.cssText = (
    'position:fixed;' + positionCss +
    'z-index:999999;display:flex;flex-direction:column;gap:' + GAP + 'px;'
  )
}

/**
 * Removes the badge container from the DOM.
 *
 * @param root  Optional root element to search within (defaults to `document`)
 */
export function removeBadgeContainer(root?: Document | Element): void {
  const CONTAINER_CLASS = 'js-rating-badge'
  const searchRoot = root || document
  const container = searchRoot.querySelector('.' + CONTAINER_CLASS)
  if (container) container.remove()
}

/**
 * Finds an existing badge container.
 *
 * @param root  Optional root element to search within (defaults to `document`)
 */
export function getBadgeContainer(root?: Document | Element): HTMLElement | null {
  const CONTAINER_CLASS = 'js-rating-badge'
  const searchRoot = root || document
  return searchRoot.querySelector('.' + CONTAINER_CLASS) as HTMLElement | null
}
