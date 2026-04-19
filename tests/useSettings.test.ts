import { describe, it, expect, beforeEach, vi } from 'vitest'

const { mockGetSetting, mockSetSetting } = vi.hoisted(() => ({
  mockGetSetting: vi.fn(),
  mockSetSetting: vi.fn(),
}))

vi.mock('@decky/api', () => ({
  callable: vi.fn((name: string) => {
    if (name === 'get_setting') return mockGetSetting
    if (name === 'set_setting') return mockSetSetting
    return vi.fn()
  }),
}))

// Import after mocking to pick up the mock
import {
  DEFAULT_SETTINGS,
  getSettings,
  subscribe,
  loadSettings,
  updateSettings,
} from '../src/hooks/useSettings'

beforeEach(() => {
  vi.clearAllMocks()
  mockSetSetting.mockResolvedValue(true)
})

// ── getSettings ─────────────────────────────────────────────────────────────────

describe('getSettings', () => {
  it('returns the default settings initially', async () => {
    mockGetSetting.mockResolvedValueOnce(DEFAULT_SETTINGS)
    await loadSettings()
    const settings = getSettings()
    expect(settings).toMatchObject(DEFAULT_SETTINGS)
  })
})

// ── loadSettings ────────────────────────────────────────────────────────────────

describe('loadSettings', () => {
  it('merges saved settings over defaults', async () => {
    mockGetSetting.mockResolvedValueOnce({ position: 'tr' })
    await loadSettings()
    expect(getSettings().position).toBe('tr')
  })

  it('falls back to defaults for missing keys in saved settings', async () => {
    mockGetSetting.mockResolvedValueOnce({})
    await loadSettings()
    expect(getSettings().position).toBe(DEFAULT_SETTINGS.position)
  })

  it('notifies subscribers after loading', async () => {
    mockGetSetting.mockResolvedValueOnce({ position: 'tr' })
    const listener = vi.fn()
    const unsub = subscribe(listener)
    await loadSettings()
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ position: 'tr' }))
    unsub()
  })
})

// ── updateSettings ──────────────────────────────────────────────────────────────

describe('updateSettings', () => {
  it('updates the in-memory setting', async () => {
    mockGetSetting.mockResolvedValueOnce({ position: 'tl' })
    await loadSettings()
    updateSettings('position', 'tr')
    expect(getSettings().position).toBe('tr')
  })

  it('calls setSetting with the updated settings object', async () => {
    mockGetSetting.mockResolvedValueOnce({ position: 'tl' })
    await loadSettings()
    updateSettings('position', 'tr')
    expect(mockSetSetting).toHaveBeenCalledWith('settings', expect.objectContaining({ position: 'tr' }))
  })

  it('notifies subscribers with the new settings', async () => {
    mockGetSetting.mockResolvedValueOnce({ position: 'tl' })
    await loadSettings()
    const listener = vi.fn()
    const unsub = subscribe(listener)
    updateSettings('position', 'tr')
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ position: 'tr' }))
    unsub()
  })
})

// ── subscribe ───────────────────────────────────────────────────────────────────

describe('subscribe', () => {
  it('returns an unsubscribe function that stops notifications', async () => {
    mockGetSetting.mockResolvedValueOnce({})
    await loadSettings()
    const listener = vi.fn()
    const unsub = subscribe(listener)
    unsub()
    updateSettings('position', 'tr')
    expect(listener).not.toHaveBeenCalled()
  })

  it('multiple listeners all receive notifications', async () => {
    mockGetSetting.mockResolvedValueOnce({})
    await loadSettings()
    const l1 = vi.fn()
    const l2 = vi.fn()
    const u1 = subscribe(l1)
    const u2 = subscribe(l2)
    updateSettings('position', 'tl')
    expect(l1).toHaveBeenCalled()
    expect(l2).toHaveBeenCalled()
    u1()
    u2()
  })
})
