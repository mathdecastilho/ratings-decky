import { fetchNoCors } from '@decky/api'

// In-memory cache for the current session — keyed by appId.
// Avoids redundant Steam API calls when multiple rating providers need the game name.
const gameNameCache = new Map<string, string | null>()

// In-flight promise cache — prevents duplicate concurrent requests for the same appId.
const inFlight = new Map<string, Promise<string | null>>()

/**
 * Returns the game name for the given Steam appId.
 *
 * Results are cached in memory for the lifetime of the plugin session.
 * Concurrent calls for the same appId share a single in-flight request.
 */
export async function fetchSteamGameName(appId: string): Promise<string | null> {
  if (gameNameCache.has(appId)) return gameNameCache.get(appId)!

  const existing = inFlight.get(appId)
  if (existing) return existing

  const request = (async (): Promise<string | null> => {
    try {
      const resp = await fetchNoCors(
        `https://store.steampowered.com/api/appdetails?appids=${appId}&filters=basic`,
        { method: 'GET' }
      )
      const data = await resp.json()
      const name: string | null = data?.[appId]?.data?.name ?? null
      gameNameCache.set(appId, name)
      return name
    } catch {
      gameNameCache.set(appId, null)
      return null
    } finally {
      inFlight.delete(appId)
    }
  })()

  inFlight.set(appId, request)
  return request
}

/** Clears the in-memory game name cache (useful in tests). */
export function clearSteamGameNameCache(): void {
  gameNameCache.clear()
  inFlight.clear()
}
