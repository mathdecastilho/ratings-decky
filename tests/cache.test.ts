import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { getCached, setCache, clearCache } from '../src/cache'

// localforage is backed by an in-memory store in jsdom — no extra mocking needed.

beforeEach(async () => {
  await clearCache()
})

afterEach(() => {
  vi.useRealTimers()
})

// ── getCached ───────────────────────────────────────────────────────────────────

describe('getCached', () => {
  it('returns null when no entry exists', async () => {
    const result = await getCached('999', 'steamdb')
    expect(result).toBeNull()
  })

  it('returns the rating after it has been cached', async () => {
    const rating = { score: 82, label: '82%', url: 'https://steamdb.info/app/123/', error: null }
    await setCache('123', 'steamdb', rating)
    const result = await getCached('123', 'steamdb')
    expect(result).toEqual(rating)
  })

  it('does not include cachedAt in the returned value', async () => {
    const rating = { score: 75, label: '75%', url: 'https://steamdb.info/app/1/', error: null }
    await setCache('1', 'steamdb', rating)
    const result = await getCached('1', 'steamdb')
    expect(result).not.toHaveProperty('cachedAt')
  })

  it('returns null for a different source even if appId is cached', async () => {
    const rating = { score: 82, label: '82%', url: 'https://steamdb.info/app/1/', error: null }
    await setCache('1', 'steamdb', rating)
    const result = await getCached('1', 'opencritic')
    expect(result).toBeNull()
  })

  it('returns null when the cache entry is older than 1 hour', async () => {
    const rating = { score: 90, label: '90%', url: 'https://steamdb.info/app/2/', error: null }
    await setCache('2', 'steamdb', rating)

    // Advance time by 1 hour + 1 ms
    vi.useFakeTimers()
    vi.setSystemTime(Date.now() + 60 * 60 * 1000 + 1)

    const result = await getCached('2', 'steamdb')
    expect(result).toBeNull()
  })

  it('returns the rating when the cache entry is exactly under 1 hour old', async () => {
    const rating = { score: 60, label: '60%', url: 'https://steamdb.info/app/3/', error: null }
    await setCache('3', 'steamdb', rating)

    vi.useFakeTimers()
    vi.setSystemTime(Date.now() + 60 * 60 * 1000 - 1)

    const result = await getCached('3', 'steamdb')
    expect(result).toEqual(rating)
  })

  it('caches each source independently for the same appId', async () => {
    const s = { score: 80, label: '80%', url: 'https://steamdb.info/', error: null }
    const o = { score: 91, label: '91', url: 'https://opencritic.com/', error: null }
    await setCache('5', 'steamdb', s)
    await setCache('5', 'opencritic', o)
    expect(await getCached('5', 'steamdb')).toEqual(s)
    expect(await getCached('5', 'opencritic')).toEqual(o)
    expect(await getCached('5', 'metacritic')).toBeNull()
  })
})

// ── setCache ────────────────────────────────────────────────────────────────────

describe('setCache', () => {
  it('overwrites an existing entry for the same appId + source', async () => {
    const r1 = { score: 70, label: '70%', url: 'https://steamdb.info/1', error: null }
    const r2 = { score: 85, label: '85%', url: 'https://steamdb.info/2', error: null }
    await setCache('6', 'steamdb', r1)
    await setCache('6', 'steamdb', r2)
    expect(await getCached('6', 'steamdb')).toEqual(r2)
  })

  it('preserves other sources when overwriting one', async () => {
    const s = { score: 70, label: '70%', url: 'https://steamdb.info/', error: null }
    const m = { score: 55, label: '55', url: 'https://metacritic.com/', error: null }
    await setCache('7', 'steamdb', s)
    await setCache('7', 'metacritic', m)
    const updated = { score: 99, label: '99%', url: 'https://steamdb.info/new', error: null }
    await setCache('7', 'steamdb', updated)
    expect(await getCached('7', 'steamdb')).toEqual(updated)
    expect(await getCached('7', 'metacritic')).toEqual(m)
  })
})

// ── clearCache ──────────────────────────────────────────────────────────────────

describe('clearCache', () => {
  it('removes a specific appId from the cache', async () => {
    const r = { score: 77, label: '77%', url: 'https://steamdb.info/', error: null }
    await setCache('8', 'steamdb', r)
    await clearCache('8')
    expect(await getCached('8', 'steamdb')).toBeNull()
  })

  it('does not remove other appIds when a specific appId is cleared', async () => {
    const r = { score: 77, label: '77%', url: 'https://steamdb.info/', error: null }
    await setCache('8', 'steamdb', r)
    await setCache('9', 'steamdb', r)
    await clearCache('8')
    expect(await getCached('9', 'steamdb')).toEqual(r)
  })

  it('clears all entries when called without an argument', async () => {
    const r = { score: 77, label: '77%', url: 'https://steamdb.info/', error: null }
    await setCache('10', 'steamdb', r)
    await setCache('11', 'opencritic', r)
    await clearCache()
    expect(await getCached('10', 'steamdb')).toBeNull()
    expect(await getCached('11', 'opencritic')).toBeNull()
  })

  it('does not throw when clearing a non-existent appId', async () => {
    await expect(clearCache('non-existent')).resolves.not.toThrow()
  })
})
