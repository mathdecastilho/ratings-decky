import { callable } from '@decky/api'
import { RatingResult } from './types'

const getSteamdbRating = callable<[app_id: string], { score: number | null; total: number | null; error: string | null }>('get_steamdb_rating')

export async function fetchSteamdbRating(appId: string): Promise<RatingResult> {
  const data = await getSteamdbRating(appId)
  return {
    score: data.score,
    label: data.score !== null ? `${data.score}%` : 'N/A',
    url: `https://www.steamdb.info/app/${appId}/`,
    error: data.error,
  }
}
