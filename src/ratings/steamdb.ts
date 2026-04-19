import { fetchNoCors } from '@decky/api'
import { RatingResult } from './types'
import { getCached, setCache } from '../cache'

export async function fetchSteamdbRating(appId: string): Promise<RatingResult> {
  const cached = await getCached(appId, 'steamdb')
  if (cached) return cached

  try {
    const resp = await fetchNoCors(
      `https://store.steampowered.com/appreviews/${appId}?json=1&language=all&purchase_type=all&num_per_page=0`,
      { method: 'GET' }
    )
    const data = await resp.json()
    const summary = data?.query_summary
    const total: number = summary?.total_reviews ?? 0
    const positive: number = summary?.total_positive ?? 0
    let score: number | null = null
    if (total > 0) {
      const average = positive / total
      const rating = average - (average - 0.5) * Math.pow(2, -Math.log10(total + 1))
      score = Math.trunc(rating * 100)
    }
    const result: RatingResult = { score, label: score !== null ? `${score}%` : '-', url: `https://www.steamdb.info/app/${appId}/`, error: null }
    await setCache(appId, 'steamdb', result)
    return result
  } catch (e: any) {
    return { score: null, label: '-', url: `https://www.steamdb.info/app/${appId}/`, error: String(e) }
  }
}
