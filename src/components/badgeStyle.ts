// Shared badge style constants used by both RatingBadges (React) and StorePatch (inline CSS string)

export const BADGE_PADDING = '2px 8px'
export const BADGE_BORDER_RADIUS = 4
export const BADGE_FONT_SIZE = 12
export const BADGE_BG = 'rgba(0,0,0,0.6)'
export const BADGE_BACKDROP_FILTER = 'blur(8px)'
export const BADGE_GAP = 4

export const badgeReactStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: BADGE_GAP,
  padding: BADGE_PADDING,
  borderRadius: BADGE_BORDER_RADIUS,
  fontSize: BADGE_FONT_SIZE,
  fontWeight: 'bold',
  background: BADGE_BG,
  backdropFilter: BADGE_BACKDROP_FILTER,
  color: '#fff',
  whiteSpace: 'nowrap',
  cursor: 'pointer',
}

/** Inline CSS string equivalent — used by StorePatch injected JS */
export const BADGE_INLINE_STYLE =
  `display:flex;align-items:center;justify-content:space-between;gap:${BADGE_GAP}px;` +
  `background:${BADGE_BG};backdrop-filter:${BADGE_BACKDROP_FILTER};color:#fff;padding:${BADGE_PADDING};` +
  `border-radius:${BADGE_BORDER_RADIUS}px;font-size:${BADGE_FONT_SIZE}px;` +
  `font-weight:bold;cursor:pointer;white-space:nowrap;`
