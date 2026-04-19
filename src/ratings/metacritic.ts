import { fetchNoCors } from '@decky/api'
import { RatingResult } from './types'
import { sanitizeName } from '../utils'
import { getCached, setCache } from '../cache'
import { fetchSteamGameName } from './steamApi'

async function fetchMetacriticFallback(gameName: string): Promise<RatingResult | null> {
  const fallbackUrl = 'https://www.metacritic.com/'
  try {
    const encoded = encodeURIComponent(gameName)
    const resp = await fetchNoCors(
      `https://backend.metacritic.com/finder/metacritic/autosuggest/${encoded}`,
      { method: 'GET' }
    )
    const data = await resp.json()
    const items: any[] = data?.data?.items ?? []
    const games = items.filter((i: any) => i.type === 'game-title')
    if (!games.length) return null
    const normalizedName = sanitizeName(gameName)
    const best = games.find((i: any) => sanitizeName(i.title ?? '') === normalizedName)
    if (!best) return null
    const rawScore = best?.criticScoreSummary?.score
    const score: number | null = (rawScore !== null && rawScore !== undefined && rawScore > 0) ? rawScore : null
    const slug: string | null = best?.slug ?? null
    const url = slug ? `https://www.metacritic.com/game/${slug}/` : fallbackUrl
    return { score, label: score !== null ? `${score}` : '-', url, error: null }
  } catch {
    return null
  }
}

export async function fetchMetacriticRating(appId: string): Promise<RatingResult> {
  const fallback: RatingResult = { score: null, label: '-', url: 'https://www.metacritic.com/', error: null }

  const cached = await getCached(appId, 'metacritic')
  if (cached) return cached

  try {
    const resp = await fetchNoCors(
      `https://store.steampowered.com/api/appdetails?appids=${appId}&filters=metacritic`,
      { method: 'GET' }
    )
    const data = await resp.json()
    const appData = data?.[appId]
    if (!appData?.success) return { ...fallback, error: 'App not found' }

    const metacritic = appData?.data?.metacritic
    const rawScore = metacritic?.score
    let score: number | null = (rawScore !== null && rawScore !== undefined && rawScore > 0) ? rawScore : null
    let url: string = metacritic?.url ?? null

    if (score === null || url === null) {
      // Fallback: search backend.metacritic.com by game name
      const gameName = appData?.data?.name ?? (await fetchSteamGameName(appId))
      if (gameName) {
        const fallbackResult = await fetchMetacriticFallback(gameName)
        if (fallbackResult) {
          await setCache(appId, 'metacritic', fallbackResult)
          return fallbackResult
        }
      }
      const result: RatingResult = { score: null, label: '-', url: 'https://www.metacritic.com/', error: null }
      await setCache(appId, 'metacritic', result)
      return result
    }

    const result: RatingResult = { score, label: `${score}`, url, error: null }
    await setCache(appId, 'metacritic', result)
    return result
  } catch (e: any) {
    return { ...fallback, error: String(e) }
  }
}
