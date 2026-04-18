import { callable } from '@decky/api'
import { RatingResult } from './types'

const getOpencriticRating = callable<[app_id: string], { score: number | null; tier: string | null; url: string | null; error: string | null }>('get_opencritic_rating')

export async function fetchOpencriticRating(appId: string): Promise<RatingResult> {
  const data = await getOpencriticRating(appId)
  return {
    score: data.score,
    label: data.score !== null ? `${data.score}%` : 'N/A',
    url: data.url ?? `https://opencritic.com/`,
    error: data.error,
  }
}
