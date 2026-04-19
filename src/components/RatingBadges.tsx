import React, { useEffect, useRef, useState } from 'react'
import { Navigation, appDetailsHeaderClasses } from '@decky/ui'
import { fetchSteamdbRating } from '../ratings/steamdb'
import { fetchOpencriticRating } from '../ratings/opencritic'
import { fetchMetacriticRating } from '../ratings/metacritic'
import { RatingResult } from '../ratings/types'
import { getSettings, subscribe, BadgePosition } from '../hooks/useSettings'
import {
  CLASS_CONTAINER,
  CLASS_LABEL,
  CLASS_VALUE,
  classBadgeRow,
  BADGE_SOURCES,
  BADGE_PADDING,
  BADGE_RADIUS,
  BADGE_FONT_SIZE,
  BADGE_BG,
  BADGE_BLUR,
  BADGE_GAP,
} from '../lib/badgeDom'

interface RatingBadgesProps {
  appId: string | null
}

interface Ratings {
  steamdb: RatingResult | null
  opencritic: RatingResult | null
  metacritic: RatingResult | null
}

const EDGE_OFFSET = 24  // px from hero edges
const TOP_BAR_HEIGHT = 40 // px from the top bar height
const TOP_OFFSET = TOP_BAR_HEIGHT + EDGE_OFFSET // px from top edge

function getPositionStyle(position: BadgePosition): React.CSSProperties {
  switch (position) {
    case 'tl': return { top: TOP_OFFSET, left: EDGE_OFFSET }
    case 'tr': return { top: TOP_OFFSET, right: EDGE_OFFSET }
    default:   return { top: TOP_OFFSET, left: EDGE_OFFSET }
  }
}

const badgeRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: BADGE_GAP,
  padding: BADGE_PADDING,
  borderRadius: BADGE_RADIUS,
  fontSize: BADGE_FONT_SIZE,
  fontWeight: 'bold',
  background: BADGE_BG,
  backdropFilter: BADGE_BLUR,
  color: '#fff',
  whiteSpace: 'nowrap',
  cursor: 'pointer',
}

const bouncingDotsStyle = `
  @keyframes ratings-bounce {
    0%, 80%, 100% { transform: translateY(0); }
    40%            { transform: translateY(-4px); }
  }
  .ratings-dot {
    display: inline-block;
    animation: ratings-bounce 1.2s ease-in-out infinite;
  }
  .ratings-dot:nth-child(2) { animation-delay: 0.2s; }
  .ratings-dot:nth-child(3) { animation-delay: 0.4s; }
`

function BouncingDots() {
  return (
    <span>
      <span className="ratings-dot">.</span>
      <span className="ratings-dot">.</span>
      <span className="ratings-dot">.</span>
    </span>
  )
}

function Badge({ name, label, value, url }: { name: string; label: string; value: string; url?: string }) {
  return (
    <div
      className={classBadgeRow(name)}
      style={badgeRowStyle}
      onClick={() => url && Navigation.NavigateToExternalWeb(url)}
    >
      <span className={CLASS_LABEL} style={{ opacity: 0.75 }}>{label}</span>
      <span className={CLASS_VALUE} style={{ textAlign: 'right' }}>
        {value === '...' ? <BouncingDots /> : value}
      </span>
    </div>
  )
}

export default function RatingBadges({ appId }: RatingBadgesProps) {
  const [ratings, setRatings] = useState<Ratings>({ steamdb: null, opencritic: null, metacritic: null })
  const [hidden, setHidden] = useState(false)
  const [settings, setSettings] = useState(getSettings())
  const mutationObserverRef = useRef<MutationObserver | null>(null)

  // Subscribe to settings changes
  useEffect(() => {
    return subscribe((s) => setSettings({ ...s }))
  }, [])

  // Fetch ratings when appId changes
  useEffect(() => {
    setRatings({ steamdb: null, opencritic: null, metacritic: null })
    if (!appId) return
    let cancelled = false
    fetchSteamdbRating(appId).then((r)    => { if (!cancelled) setRatings((p) => ({ ...p, steamdb: r })) })
    fetchOpencriticRating(appId).then((r) => { if (!cancelled) setRatings((p) => ({ ...p, opencritic: r })) })
    fetchMetacriticRating(appId).then((r) => { if (!cancelled) setRatings((p) => ({ ...p, metacritic: r })) })
    return () => { cancelled = true }
  }, [appId])

  // Observe the hero (TopCapsule) for fullscreen changes.
  // Re-runs on appId change so a fresh DOM query is made after navigation.
  useEffect(() => {
    if (!appId) return

    // Hero may not be in the DOM yet immediately after navigation — retry briefly
    let attempts = 0
    let hero: HTMLElement | null = null
    const tryAttach = () => {
      hero = document.querySelector(`.${appDetailsHeaderClasses.TopCapsule}`) as HTMLElement | null
      if (!hero && attempts++ < 10) {
        setTimeout(tryAttach, 100)
        return
      }
      if (!hero) return

      mutationObserverRef.current?.disconnect()
      mutationObserverRef.current = new MutationObserver(() => {
        const cls = hero!.className
        const isFullscreen =
          cls.includes(appDetailsHeaderClasses.FullscreenEnterStart  ?? '__noop__') ||
          cls.includes(appDetailsHeaderClasses.FullscreenEnterActive ?? '__noop__') ||
          cls.includes(appDetailsHeaderClasses.FullscreenEnterDone   ?? '__noop__')
        setHidden(isFullscreen)
      })
      mutationObserverRef.current.observe(hero, { attributes: true, attributeFilter: ['class'] })
    }
    tryAttach()

    return () => {
      mutationObserverRef.current?.disconnect()
    }
  }, [appId])

  if (hidden || !appId) return null

  const containerStyle: React.CSSProperties = {
    position: 'absolute',
    display: 'flex',
    flexDirection: 'column',
    gap: BADGE_GAP,
    zIndex: 9999,
    ...getPositionStyle(settings.position),
  }

  return (
    <div className={CLASS_CONTAINER} style={containerStyle}>
      <style>{bouncingDotsStyle}</style>
      {BADGE_SOURCES.map((source) => (
        <Badge
          key={source.name}
          name={source.name}
          label={source.label}
          value={(ratings as any)[source.name]?.label ?? '...'}
          url={(ratings as any)[source.name]?.url}
        />
      ))}
    </div>
  )
}
