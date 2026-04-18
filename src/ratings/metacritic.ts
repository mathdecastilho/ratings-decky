import { callable } from '@decky/api'
import { RatingResult } from './types'

const getMetacriticRating = callable<[app_id: string], { score: number | null; url: string | null; error: string | null }>('get_metacritic_rating')

export async function fetchMetacriticRating(appId: string): Promise<RatingResult> {
  const data = await getMetacriticRating(appId)
  return {
    score: data.score,
    label: data.score !== null ? `${data.score}%` : 'N/A',
    url: data.url ?? `https://www.metacritic.com/`,
    error: data.error,
  }
}
