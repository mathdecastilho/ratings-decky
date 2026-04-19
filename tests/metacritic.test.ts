import { describe, it, expect, beforeEach, vi } from 'vitest'
import { clearCache } from '../src/cache'
import { clearSteamGameNameCache } from '../src/ratings/steamApi'

vi.mock('@decky/api', () => ({
  fetchNoCors: vi.fn(),
}))

import { fetchNoCors } from '@decky/api'
import { fetchMetacriticRating } from '../src/ratings/metacritic'

const mockFetch = fetchNoCors as ReturnType<typeof vi.fn>

function makeResponse(data: unknown) {
  return { json: () => Promise.resolve(data) }
}

function makeMetacriticSteamResponse(appId: string, score: number | null, url: string | null, name = 'Some Game') {
  return makeResponse({
    [appId]: {
      success: true,
      data: {
        name,
        metacritic: score !== null ? { score, url } : undefined,
      },
    },
  })
}

beforeEach(async () => {
  vi.clearAllMocks()
  await clearCache()
  clearSteamGameNameCache()
})

// ── fetchMetacriticRating ───────────────────────────────────────────────────────

describe('fetchMetacriticRating', () => {
  it('returns score and url from Steam appdetails metacritic field', async () => {
    mockFetch.mockResolvedValueOnce(
      makeMetacriticSteamResponse('100', 88, 'https://www.metacritic.com/game/some-game/')
    )

    const result = await fetchMetacriticRating('100')
    expect(result.error).toBeNull()
    expect(result.score).toBe(88)
    expect(result.label).toBe('88')
    expect(result.url).toBe('https://www.metacritic.com/game/some-game/')
  })

  it('returns error when Steam says app not found (success: false)', async () => {
    mockFetch.mockResolvedValueOnce(
      makeResponse({ '101': { success: false } })
    )

    const result = await fetchMetacriticRating('101')
    expect(result.score).toBeNull()
    expect(result.error).toBe('App not found')
  })

  it('falls back to metacritic API when Steam has no metacritic score', async () => {
    // Primary Steam response — no metacritic field
    mockFetch.mockResolvedValueOnce(
      makeResponse({
        '102': {
          success: true,
          data: { name: 'Hades', metacritic: undefined },
        },
      })
    )
    // Fallback autosuggest response
    mockFetch.mockResolvedValueOnce(
      makeResponse({
        data: {
          items: [
            {
              type: 'game-title',
              title: 'Hades',
              criticScoreSummary: { score: 93 },
              slug: 'hades',
            },
          ],
        },
      })
    )

    const result = await fetchMetacriticRating('102')
    expect(result.score).toBe(93)
    expect(result.url).toBe('https://www.metacritic.com/game/hades/')
  })

  it('falls back to metacritic API when Steam score is 0', async () => {
    mockFetch.mockResolvedValueOnce(
      makeMetacriticSteamResponse('103', 0, 'https://www.metacritic.com/game/x/', 'Game X')
    )
    mockFetch.mockResolvedValueOnce(
      makeResponse({
        data: {
          items: [
            {
              type: 'game-title',
              title: 'Game X',
              criticScoreSummary: { score: 70 },
              slug: 'game-x',
            },
          ],
        },
      })
    )

    const result = await fetchMetacriticRating('103')
    expect(result.score).toBe(70)
  })

  it('returns null score and empty result when fallback finds no games', async () => {
    mockFetch.mockResolvedValueOnce(
      makeResponse({
        '104': { success: true, data: { name: 'Obscure Game' } },
      })
    )
    mockFetch.mockResolvedValueOnce(
      makeResponse({ data: { items: [] } })
    )

    const result = await fetchMetacriticRating('104')
    expect(result.score).toBeNull()
    expect(result.label).toBe('-')
  })

  it('returns null score when fallback has no exact name match', async () => {
    mockFetch.mockResolvedValueOnce(
      makeResponse({ '105': { success: true, data: { name: 'My Game' } } })
    )
    mockFetch.mockResolvedValueOnce(
      makeResponse({
        data: {
          items: [{ type: 'game-title', title: 'My Game 2', criticScoreSummary: { score: 80 }, slug: 'my-game-2' }],
        },
      })
    )

    const result = await fetchMetacriticRating('105')
    expect(result.score).toBeNull()
  })

  it('ignores non-game-title items in the fallback response', async () => {
    mockFetch.mockResolvedValueOnce(
      makeResponse({ '106': { success: true, data: { name: 'Some Film' } } })
    )
    mockFetch.mockResolvedValueOnce(
      makeResponse({
        data: {
          items: [
            { type: 'movie', title: 'Some Film', criticScoreSummary: { score: 90 }, slug: 'some-film' },
          ],
        },
      })
    )

    const result = await fetchMetacriticRating('106')
    expect(result.score).toBeNull()
  })

  it('returns cached result on second call', async () => {
    mockFetch.mockResolvedValueOnce(
      makeMetacriticSteamResponse('200', 75, 'https://www.metacritic.com/game/cached/')
    )

    const first = await fetchMetacriticRating('200')
    const second = await fetchMetacriticRating('200')
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(second).toEqual(first)
  })

  it('returns error result when fetchNoCors throws', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Fetch failed'))

    const result = await fetchMetacriticRating('300')
    expect(result.score).toBeNull()
    expect(result.error).toContain('Fetch failed')
  })
})

// ── strDist (internal, tested via metacritic fallback behaviour) ────────────────

describe('strDist via fetchMetacriticFallback', () => {
  it('picks the best match by strDist when multiple exact matches exist', async () => {
    mockFetch.mockResolvedValueOnce(
      makeResponse({ '400': { success: true, data: { name: 'Hades' } } })
    )
    // Two exact name matches — pick the one with the lowest strDist (same name → 0)
    mockFetch.mockResolvedValueOnce(
      makeResponse({
        data: {
          items: [
            { type: 'game-title', title: 'Hades', criticScoreSummary: { score: 93 }, slug: 'hades' },
            { type: 'game-title', title: 'Hades', criticScoreSummary: { score: 50 }, slug: 'hades-old' },
          ],
        },
      })
    )

    const result = await fetchMetacriticRating('400')
    // Both have same dist, so the first matching result wins (reduce keeps prev when equal)
    expect(result.score).toBe(93)
  })
})
