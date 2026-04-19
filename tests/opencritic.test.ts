import { describe, it, expect, beforeEach, vi } from 'vitest'
import { clearCache } from '../src/cache'

vi.mock('@decky/api', () => ({
  fetchNoCors: vi.fn(),
}))

import { fetchNoCors } from '@decky/api'
import { fetchOpencriticRating } from '../src/ratings/opencritic'

const mockFetch = fetchNoCors as ReturnType<typeof vi.fn>

function makeResponse(data: unknown) {
  return { json: () => Promise.resolve(data) }
}

beforeEach(async () => {
  vi.clearAllMocks()
  await clearCache()
})

// ── fetchOpencriticRating ───────────────────────────────────────────────────────

describe('fetchOpencriticRating', () => {
  it('returns the score for a fully successful lookup', async () => {
    // Step 1: Steam appdetails
    mockFetch.mockResolvedValueOnce(
      makeResponse({ '111': { data: { name: 'Half-Life 2' } } })
    )
    // Step 2: OpenCritic search
    mockFetch.mockResolvedValueOnce(
      makeResponse([
        { id: 42, name: 'Half-Life 2', dist: 0, relation: 'game' },
      ])
    )
    // Step 3: OpenCritic game details
    mockFetch.mockResolvedValueOnce(
      makeResponse({ topCriticScore: 96.4, url: '/game/42/half-life-2' })
    )

    const result = await fetchOpencriticRating('111')
    expect(result.error).toBeNull()
    expect(result.score).toBe(96)
    expect(result.label).toBe('96')
    expect(result.url).toContain('opencritic.com')
  })

  it('uses an absolute URL from the game details when provided', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ '1': { data: { name: 'Portal' } } }))
    mockFetch.mockResolvedValueOnce(makeResponse([{ id: 7, name: 'Portal', dist: 0, relation: 'game' }]))
    mockFetch.mockResolvedValueOnce(
      makeResponse({ topCriticScore: 90, url: 'https://opencritic.com/game/7/portal' })
    )

    const result = await fetchOpencriticRating('1')
    expect(result.url).toBe('https://opencritic.com/game/7/portal')
  })

  it('builds an opencritic URL when url field is a relative path', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ '2': { data: { name: 'Portal 2' } } }))
    mockFetch.mockResolvedValueOnce(makeResponse([{ id: 8, name: 'Portal 2', dist: 0, relation: 'game' }]))
    mockFetch.mockResolvedValueOnce(
      makeResponse({ topCriticScore: 95, url: '/game/8/portal-2' })
    )

    const result = await fetchOpencriticRating('2')
    expect(result.url).toBe('https://opencritic.com/game/8//game/8/portal-2')
  })

  it('returns score null and label "-" when topCriticScore is -1', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ '3': { data: { name: 'Some Game' } } }))
    mockFetch.mockResolvedValueOnce(makeResponse([{ id: 9, name: 'Some Game', dist: 0, relation: 'game' }]))
    mockFetch.mockResolvedValueOnce(makeResponse({ topCriticScore: -1, url: '' }))

    const result = await fetchOpencriticRating('3')
    expect(result.score).toBeNull()
    expect(result.label).toBe('-')
  })

  it('returns error when game name cannot be resolved from Steam', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ '4': { data: {} } }))

    const result = await fetchOpencriticRating('4')
    expect(result.score).toBeNull()
    expect(result.error).toBeTruthy()
  })

  it('returns error when no exact name match is found on OpenCritic', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ '5': { data: { name: 'Unknown Game' } } }))
    mockFetch.mockResolvedValueOnce(makeResponse([
      { id: 10, name: 'Different Game', dist: 1, relation: 'game' },
    ]))

    const result = await fetchOpencriticRating('5')
    expect(result.score).toBeNull()
    expect(result.error).toContain('Not found on OpenCritic')
  })

  it('ignores non-game search results (relation !== "game")', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ '6': { data: { name: 'Some Game' } } }))
    mockFetch.mockResolvedValueOnce(makeResponse([
      { id: 11, name: 'Some Game', dist: 0, relation: 'company' },
    ]))

    const result = await fetchOpencriticRating('6')
    expect(result.error).toContain('Not found on OpenCritic')
  })

  it('returns error result when fetchNoCors throws', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Timeout'))

    const result = await fetchOpencriticRating('7')
    expect(result.score).toBeNull()
    expect(result.error).toContain('Timeout')
  })

  it('returns cached result on second call', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ '8': { data: { name: 'Cached Game' } } }))
    mockFetch.mockResolvedValueOnce(makeResponse([{ id: 20, name: 'Cached Game', dist: 0, relation: 'game' }]))
    mockFetch.mockResolvedValueOnce(makeResponse({ topCriticScore: 88, url: 'https://opencritic.com/game/20/cached' }))

    const first = await fetchOpencriticRating('8')
    const second = await fetchOpencriticRating('8')
    // Only 3 calls for the first fetch, none for the second
    expect(mockFetch).toHaveBeenCalledTimes(3)
    expect(second).toEqual(first)
  })

  it('picks the match with the lowest dist when there are multiple exact name matches', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ '9': { data: { name: 'The Game' } } }))
    mockFetch.mockResolvedValueOnce(makeResponse([
      { id: 30, name: 'The Game', dist: 5, relation: 'game' },
      { id: 31, name: 'The Game', dist: 1, relation: 'game' },
    ]))
    mockFetch.mockResolvedValueOnce(makeResponse({ topCriticScore: 77, url: 'https://opencritic.com/game/31/the-game' }))

    const result = await fetchOpencriticRating('9')
    expect(result.url).toContain('31')
  })

  it('sends the Authorization header to OpenCritic', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ '10': { data: { name: 'Auth Test' } } }))
    mockFetch.mockResolvedValueOnce(makeResponse([{ id: 40, name: 'Auth Test', dist: 0, relation: 'game' }]))
    mockFetch.mockResolvedValueOnce(makeResponse({ topCriticScore: 80, url: '' }))

    await fetchOpencriticRating('10')
    // 2nd and 3rd calls go to OpenCritic and must include Authorization
    const callArgs = mockFetch.mock.calls
    const ocCalls = callArgs.filter((args: any[]) => args[0].includes('opencritic.com'))
    ocCalls.forEach((args: any[]) => {
      expect(args[1]?.headers?.Authorization).toMatch(/^Bearer /)
    })
  })
})
