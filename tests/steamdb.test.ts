import { describe, it, expect, beforeEach, vi } from 'vitest'
import { clearCache } from '../src/cache'

// Mock @decky/api before importing the module under test
vi.mock('@decky/api', () => ({
  fetchNoCors: vi.fn(),
}))

import { fetchNoCors } from '@decky/api'
import { fetchSteamdbRating } from '../src/ratings/steamdb'

const mockFetch = fetchNoCors as ReturnType<typeof vi.fn>

function makeResponse(data: unknown) {
  return { json: () => Promise.resolve(data) }
}

beforeEach(async () => {
  vi.clearAllMocks()
  await clearCache()
})

// ── fetchSteamdbRating ──────────────────────────────────────────────────────────

describe('fetchSteamdbRating', () => {
  it('returns a calculated score for a game with reviews', async () => {
    mockFetch.mockResolvedValueOnce(
      makeResponse({
        query_summary: { total_reviews: 1000, total_positive: 870 },
      })
    )
    const result = await fetchSteamdbRating('123')
    expect(result.error).toBeNull()
    expect(result.score).toBeTypeOf('number')
    expect(result.score).toBeGreaterThan(0)
    expect(result.score).toBeLessThanOrEqual(100)
    expect(result.label).toBe(`${result.score}%`)
    expect(result.url).toBe('https://www.steamdb.info/app/123/')
  })

  it('applies the Wilson-score formula correctly', async () => {
    // For 1000 total, 870 positive:
    // avg = 0.87
    // rating = 0.87 - (0.87 - 0.5) * 2^(-log10(1001)) ≈ 0.87 - 0.37 * 2^(-3.0004...) ≈ 0.87 - 0.046 ≈ 0.824
    mockFetch.mockResolvedValueOnce(
      makeResponse({
        query_summary: { total_reviews: 1000, total_positive: 870 },
      })
    )
    const result = await fetchSteamdbRating('777')
    const avg = 870 / 1000
    const expected = Math.trunc((avg - (avg - 0.5) * Math.pow(2, -Math.log10(1001))) * 100)
    expect(result.score).toBe(expected)
  })

  it('returns score null and label "-" when total_reviews is 0', async () => {
    mockFetch.mockResolvedValueOnce(
      makeResponse({
        query_summary: { total_reviews: 0, total_positive: 0 },
      })
    )
    const result = await fetchSteamdbRating('124')
    expect(result.score).toBeNull()
    expect(result.label).toBe('-')
  })

  it('returns score null when query_summary is missing', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({}))
    const result = await fetchSteamdbRating('125')
    expect(result.score).toBeNull()
    expect(result.label).toBe('-')
  })

  it('returns an error result when fetchNoCors throws', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))
    const result = await fetchSteamdbRating('126')
    expect(result.score).toBeNull()
    expect(result.error).toContain('Network error')
    expect(result.url).toBe('https://www.steamdb.info/app/126/')
  })

  it('returns a cached result on the second call', async () => {
    mockFetch.mockResolvedValueOnce(
      makeResponse({
        query_summary: { total_reviews: 500, total_positive: 400 },
      })
    )
    const first = await fetchSteamdbRating('200')
    const second = await fetchSteamdbRating('200')
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(second).toEqual(first)
  })

  it('constructs the correct Steam Reviews API URL', async () => {
    mockFetch.mockResolvedValueOnce(
      makeResponse({ query_summary: { total_reviews: 100, total_positive: 80 } })
    )
    await fetchSteamdbRating('555')
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/appreviews/555'),
      expect.any(Object)
    )
  })
})
