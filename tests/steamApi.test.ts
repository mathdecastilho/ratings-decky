import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@decky/api', () => ({
  fetchNoCors: vi.fn(),
}))

import { fetchNoCors } from '@decky/api'
import { fetchSteamGameName, clearSteamGameNameCache } from '../src/ratings/steamApi'

const mockFetch = fetchNoCors as ReturnType<typeof vi.fn>

function makeResponse(data: unknown) {
  return { json: () => Promise.resolve(data) }
}

beforeEach(() => {
  vi.clearAllMocks()
  clearSteamGameNameCache()
})

// ── fetchSteamGameName ──────────────────────────────────────────────────────────

describe('fetchSteamGameName', () => {
  it('returns the game name for a known appId', async () => {
    mockFetch.mockResolvedValueOnce(
      makeResponse({ '570': { data: { name: 'Dota 2' } } })
    )
    const name = await fetchSteamGameName('570')
    expect(name).toBe('Dota 2')
  })

  it('returns null when the appId is not found in the response', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({}))
    const name = await fetchSteamGameName('999')
    expect(name).toBeNull()
  })

  it('returns null when fetchNoCors throws', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))
    const name = await fetchSteamGameName('111')
    expect(name).toBeNull()
  })

  it('uses the correct Steam appdetails URL with filters=basic', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ '440': { data: { name: 'Team Fortress 2' } } }))
    await fetchSteamGameName('440')
    expect(mockFetch).toHaveBeenCalledWith(
      'https://store.steampowered.com/api/appdetails?appids=440&filters=basic',
      { method: 'GET' }
    )
  })

  it('returns the cached result on a second call without fetching again', async () => {
    mockFetch.mockResolvedValueOnce(
      makeResponse({ '730': { data: { name: 'Counter-Strike 2' } } })
    )
    const first = await fetchSteamGameName('730')
    const second = await fetchSteamGameName('730')
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(second).toBe(first)
  })

  it('caches a null result and does not retry on subsequent calls', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Timeout'))
    await fetchSteamGameName('222')
    await fetchSteamGameName('222')
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('makes only one network request for concurrent calls with the same appId', async () => {
    mockFetch.mockResolvedValueOnce(
      makeResponse({ '400': { data: { name: 'Portal' } } })
    )
    const [a, b, c] = await Promise.all([
      fetchSteamGameName('400'),
      fetchSteamGameName('400'),
      fetchSteamGameName('400'),
    ])
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(a).toBe('Portal')
    expect(b).toBe('Portal')
    expect(c).toBe('Portal')
  })

  it('fetches independently for different appIds', async () => {
    mockFetch
      .mockResolvedValueOnce(makeResponse({ '1': { data: { name: 'Game A' } } }))
      .mockResolvedValueOnce(makeResponse({ '2': { data: { name: 'Game B' } } }))
    const [a, b] = await Promise.all([fetchSteamGameName('1'), fetchSteamGameName('2')])
    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(a).toBe('Game A')
    expect(b).toBe('Game B')
  })
})

// ── clearSteamGameNameCache ─────────────────────────────────────────────────────

describe('clearSteamGameNameCache', () => {
  it('causes the next call to fetch again after the cache is cleared', async () => {
    mockFetch.mockResolvedValue(makeResponse({ '570': { data: { name: 'Dota 2' } } }))
    await fetchSteamGameName('570')
    clearSteamGameNameCache()
    await fetchSteamGameName('570')
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })
})
