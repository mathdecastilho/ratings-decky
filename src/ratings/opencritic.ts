import { fetchNoCors } from '@decky/api'
import { RatingResult } from './types'
import { sanitizeName } from '../utils'
import { getCached, setCache } from '../cache'
import { fetchSteamGameName } from './steamApi'

const OC_TOKEN = 'Bearer R2tBRkdvUU9WSHpoUXpaSXVYa2g5cGU5NEFsWUgyeXQ='

async function ocFetch(url: string): Promise<any> {
  const resp = await fetchNoCors(url, { method: 'GET', headers: { Authorization: OC_TOKEN } })
  return resp.json()
}

export async function fetchOpencriticRating(appId: string): Promise<RatingResult> {
  const fallback: RatingResult = { score: null, label: '-', url: 'https://opencritic.com/', error: null }

  const cached = await getCached(appId, 'opencritic')
  if (cached) return cached

  try {
    // Step 1: resolve game name from Steam
    const gameName = await fetchSteamGameName(appId)
    if (!gameName) return { ...fallback, error: 'Could not resolve game name from Steam' }

    // Step 2: search OpenCritic by name, keep only exact name matches
    const searchResults: { id: number; name: string; dist: number; relation: string }[] =
      await ocFetch(`https://api.opencritic.com/api/meta/search?criteria=${encodeURIComponent(gameName)}`)
    const normalizedGameName = sanitizeName(gameName)
    const gameMatches = searchResults.filter(
      (r) => r.relation === 'game' && sanitizeName(r.name) === normalizedGameName
    )
    if (!gameMatches.length) return { ...fallback, error: 'Not found on OpenCritic' }

    // Pick closest name match by lowest dist
    const best = gameMatches.reduce((a, b) => (a.dist <= b.dist ? a : b))

    // Step 3: fetch full game details
    const game = await ocFetch(`https://api.opencritic.com/api/game/${best.id}`)
    const rawScore = game?.topCriticScore
    const score: number | null = (rawScore !== null && rawScore !== undefined && rawScore >= 0) ? Math.round(rawScore) : null
    const slug: string = game?.url ?? ''
    const url = slug.startsWith('http') ? slug : `https://opencritic.com/game/${best.id}/${slug}`
    const result: RatingResult = { score, label: score !== null ? `${score}` : '-', url, error: null }
    await setCache(appId, 'opencritic', result)
    return result
  } catch (e: any) {
    return { ...fallback, error: String(e) }
  }
}
