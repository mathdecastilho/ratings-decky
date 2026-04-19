import React, { useEffect, useRef, useState } from 'react'
import { Navigation, appDetailsHeaderClasses } from '@decky/ui'
import { fetchSteamdbRating } from '../ratings/steamdb'
import { fetchOpencriticRating } from '../ratings/opencritic'
import { fetchMetacriticRating } from '../ratings/metacritic'
import { RatingResult } from '../ratings/types'
import { getSettings, subscribe, BadgePosition } from '../hooks/useSettings'
import { badgeReactStyle } from './badgeStyle'

interface RatingBadgesProps {
  appId: string
}

interface Ratings {
  steamdb: RatingResult | null
  opencritic: RatingResult | null
  metacritic: RatingResult | null
}

const EDGE_OFFSET = 24  // px from hero edges
const TOP_OFFSET = 51   // px from top edge

function getPositionStyle(position: BadgePosition): React.CSSProperties {
  switch (position) {
    case 'tl': return { top: TOP_OFFSET, left: EDGE_OFFSET }
    case 'tr': return { top: TOP_OFFSET, right: EDGE_OFFSET }
    default:   return { top: TOP_OFFSET, left: EDGE_OFFSET }
  }
}

const badgeStyle = badgeReactStyle

function Badge({ label, value, url }: { label: string; value: string; url?: string }) {
  return (
    <div style={badgeStyle} onClick={() => url && Navigation.NavigateToExternalWeb(url)}>
      <span style={{ opacity: 0.75 }}>{label}</span>
      <span style={{ textAlign: 'right' }}>{value}</span>
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
    fetchSteamdbRating(appId).then((r) => { if (!cancelled) setRatings((p) => ({ ...p, steamdb: r })) })
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
          cls.includes(appDetailsHeaderClasses.FullscreenEnterStart ?? '__noop__') ||
          cls.includes(appDetailsHeaderClasses.FullscreenEnterActive ?? '__noop__') ||
          cls.includes(appDetailsHeaderClasses.FullscreenEnterDone ?? '__noop__')
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
    gap: 4,
    zIndex: 9999,
    ...getPositionStyle(settings.position),
  }

  return (
    <div style={containerStyle}>
      {(ratings.steamdb === null || ratings.steamdb.score !== null) && (
        <Badge label="SteamDB"    value={ratings.steamdb?.label    ?? '...'} url={ratings.steamdb?.url} />
      )}
      {(ratings.opencritic === null || ratings.opencritic.score !== null) && (
        <Badge label="OpenCritic" value={ratings.opencritic?.label ?? '...'} url={ratings.opencritic?.url} />
      )}
      {(ratings.metacritic === null || ratings.metacritic.score !== null) && (
        <Badge label="Metacritic" value={ratings.metacritic?.label ?? '...'} url={ratings.metacritic?.url} />
      )}
    </div>
  )
}
