import React, { useEffect, useState } from 'react'
import { Navigation } from '@decky/ui'
import { fetchSteamdbRating } from '../ratings/steamdb'
import { fetchOpencriticRating } from '../ratings/opencritic'
import { fetchMetacriticRating } from '../ratings/metacritic'
import { RatingResult } from '../ratings/types'

interface RatingBadgesProps {
  appId: string
}

interface Ratings {
  steamdb: RatingResult | null
  opencritic: RatingResult | null
  metacritic: RatingResult | null
}

const badgeStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '2px 8px',
  borderRadius: 4,
  fontSize: 12,
  fontWeight: 'bold',
  background: 'rgba(0,0,0,0.6)',
  color: '#fff',
  whiteSpace: 'nowrap',
  cursor: 'pointer',
}

const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 4,
  padding: '6px 0',
}

function Badge({ label, value, url }: { label: string; value: string; url?: string }) {
  const handleClick = () => {
    if (url) Navigation.NavigateToExternalWeb(url)
  }

  return (
    <div style={badgeStyle} onClick={handleClick}>
      <span style={{ opacity: 0.75, marginRight: 4 }}>{label}</span>
      <span>{value}</span>
    </div>
  )
}

export default function RatingBadges({ appId }: RatingBadgesProps) {
  const [ratings, setRatings] = useState<Ratings>({ steamdb: null, opencritic: null, metacritic: null })

  useEffect(() => {
    if (!appId) return
    let cancelled = false
    fetchSteamdbRating(appId).then((r) => { if (!cancelled) setRatings((prev) => ({ ...prev, steamdb: r })) })
    fetchOpencriticRating(appId).then((r) => { if (!cancelled) setRatings((prev) => ({ ...prev, opencritic: r })) })
    fetchMetacriticRating(appId).then((r) => { if (!cancelled) setRatings((prev) => ({ ...prev, metacritic: r })) })
    return () => { cancelled = true }
  }, [appId])

  return (
    <div style={containerStyle}>
      <Badge label="SteamDB" value={ratings.steamdb?.label ?? '...'} url={ratings.steamdb?.url} />
      <Badge label="OpenCritic" value={ratings.opencritic?.label ?? '...'} url={ratings.opencritic?.url} />
      <Badge label="Metacritic" value={ratings.metacritic?.label ?? '...'} url={ratings.metacritic?.url} />
    </div>
  )
}
