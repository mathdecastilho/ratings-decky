import localforage from 'localforage'
import { RatingResult } from './ratings/types'

const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour

localforage.config({ name: 'ratings-decky-cache' })

type CachedRating = RatingResult & { cachedAt: number }

type RatingsCache = {
  steamdb?: CachedRating
  opencritic?: CachedRating
  metacritic?: CachedRating
}

function isFresh(entry: CachedRating): boolean {
  return Date.now() - entry.cachedAt < CACHE_TTL_MS
}

export async function getCached(appId: string, source: keyof RatingsCache): Promise<RatingResult | null> {
  const data = await localforage.getItem<RatingsCache>(appId)
  const entry = data?.[source]
  if (entry && isFresh(entry)) {
    const { cachedAt: _, ...rating } = entry
    return rating
  }
  return null
}

export async function setCache(appId: string, source: keyof RatingsCache, rating: RatingResult): Promise<void> {
  const existing = (await localforage.getItem<RatingsCache>(appId)) ?? {}
  await localforage.setItem(appId, {
    ...existing,
    [source]: { ...rating, cachedAt: Date.now() },
  })
}

export async function clearCache(appId?: string): Promise<void> {
  if (appId?.length) {
    await localforage.removeItem(appId)
  } else {
    await localforage.clear()
  }
}
