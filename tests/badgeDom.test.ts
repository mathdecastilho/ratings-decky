import { describe, it, expect, beforeEach } from 'vitest'
import {
  CLASS_CONTAINER,
  CLASS_LABEL,
  CLASS_VALUE,
  classBadgeRow,
  BADGE_SOURCES,
  createBadgeContainer,
  updateBadgeValue,
  repositionBadgeContainer,
  removeBadgeContainer,
  getBadgeContainer,
} from '../src/lib/badgeDom'

// jsdom provides document/window globals via vitest's environment setting.

beforeEach(() => {
  document.body.innerHTML = ''
})

// ── createBadgeContainer ────────────────────────────────────────────────────────

describe('createBadgeContainer', () => {
  it('appends a container to document.body', () => {
    createBadgeContainer('bottom:24px;left:24px;')
    expect(document.body.children).toHaveLength(1)
  })

  it('gives the container the js-rating-badge class', () => {
    createBadgeContainer('bottom:24px;left:24px;')
    const el = document.body.firstElementChild!
    expect(el.classList.contains(CLASS_CONTAINER)).toBe(true)
  })

  it('creates one row per BADGE_SOURCE', () => {
    createBadgeContainer('bottom:24px;left:24px;')
    const container = getBadgeContainer()!
    expect(container.children).toHaveLength(BADGE_SOURCES.length)
  })

  it('each row has the correct js-rating-{name} class', () => {
    createBadgeContainer('bottom:24px;left:24px;')
    const container = getBadgeContainer()!
    BADGE_SOURCES.forEach((source) => {
      expect(container.querySelector('.' + classBadgeRow(source.name))).not.toBeNull()
    })
  })

  it('each row contains a label span with js-rating-label class', () => {
    createBadgeContainer('bottom:24px;left:24px;')
    const container = getBadgeContainer()!
    BADGE_SOURCES.forEach((source) => {
      const row = container.querySelector('.' + classBadgeRow(source.name))!
      expect(row.querySelector('.' + CLASS_LABEL)).not.toBeNull()
    })
  })

  it('each row contains a value span with js-rating-value class showing "..."', () => {
    createBadgeContainer('bottom:24px;left:24px;')
    const container = getBadgeContainer()!
    BADGE_SOURCES.forEach((source) => {
      const row   = container.querySelector('.' + classBadgeRow(source.name))!
      const value = row.querySelector('.' + CLASS_VALUE) as HTMLElement
      expect(value).not.toBeNull()
      expect(value.textContent).toBe('...')
    })
  })

  it('each row label text matches the source label', () => {
    createBadgeContainer('bottom:24px;left:24px;')
    const container = getBadgeContainer()!
    BADGE_SOURCES.forEach((source) => {
      const row   = container.querySelector('.' + classBadgeRow(source.name))!
      const label = row.querySelector('.' + CLASS_LABEL) as HTMLElement
      expect(label.textContent).toBe(source.label)
    })
  })

  it('applies the positionCss to the container style', () => {
    createBadgeContainer('bottom:99px;right:12px;')
    const container = getBadgeContainer()! as HTMLElement
    expect(container.style.cssText).toContain('bottom: 99px')
    expect(container.style.cssText).toContain('right: 12px')
  })

  it('removes an existing container before creating a new one', () => {
    createBadgeContainer('bottom:24px;left:24px;')
    createBadgeContainer('bottom:24px;left:24px;')
    expect(document.querySelectorAll('.' + CLASS_CONTAINER)).toHaveLength(1)
  })
})

// ── updateBadgeValue ────────────────────────────────────────────────────────────

describe('updateBadgeValue', () => {
  beforeEach(() => {
    createBadgeContainer('bottom:24px;left:24px;')
  })

  it('updates the value span text for a known source', () => {
    updateBadgeValue('steamdb', '82%', 'https://www.steamdb.info/app/123/')
    const row   = document.querySelector('.' + classBadgeRow('steamdb'))!
    const value = row.querySelector('.' + CLASS_VALUE) as HTMLElement
    expect(value.textContent).toBe('82%')
  })

  it('updates the data-url attribute on the row', () => {
    const url = 'https://www.steamdb.info/app/456/'
    updateBadgeValue('steamdb', '75%', url)
    const row = document.querySelector('.' + classBadgeRow('steamdb'))!
    expect(row.getAttribute('data-url')).toBe(url)
  })

  it('updates opencritic independently', () => {
    updateBadgeValue('opencritic', '91', 'https://opencritic.com/game/1/foo')
    const row   = document.querySelector('.' + classBadgeRow('opencritic'))!
    const value = row.querySelector('.' + CLASS_VALUE) as HTMLElement
    expect(value.textContent).toBe('91')
  })

  it('does nothing when the name does not match any row', () => {
    // Should not throw
    expect(() => updateBadgeValue('unknown', '50', 'https://example.com')).not.toThrow()
  })

  it('accepts a custom root element', () => {
    const root = getBadgeContainer()!
    updateBadgeValue('metacritic', '67', 'https://www.metacritic.com/game/foo', root)
    const value = root.querySelector('.' + classBadgeRow('metacritic') + ' .' + CLASS_VALUE) as HTMLElement
    expect(value.textContent).toBe('67')
  })
})

// ── repositionBadgeContainer ────────────────────────────────────────────────────

describe('repositionBadgeContainer', () => {
  it('updates the container style with new position', () => {
    createBadgeContainer('bottom:24px;left:24px;')
    repositionBadgeContainer('top:10px;right:10px;')
    const container = getBadgeContainer()! as HTMLElement
    expect(container.style.cssText).toContain('top: 10px')
    expect(container.style.cssText).toContain('right: 10px')
  })

  it('does nothing when no container exists', () => {
    expect(() => repositionBadgeContainer('top:10px;right:10px;')).not.toThrow()
  })
})

// ── removeBadgeContainer ────────────────────────────────────────────────────────

describe('removeBadgeContainer', () => {
  it('removes the container from the DOM', () => {
    createBadgeContainer('bottom:24px;left:24px;')
    expect(getBadgeContainer()).not.toBeNull()
    removeBadgeContainer()
    expect(getBadgeContainer()).toBeNull()
  })

  it('does nothing when no container exists', () => {
    expect(() => removeBadgeContainer()).not.toThrow()
  })
})

// ── getBadgeContainer ───────────────────────────────────────────────────────────

describe('getBadgeContainer', () => {
  it('returns null when no container exists', () => {
    expect(getBadgeContainer()).toBeNull()
  })

  it('returns the container element after creation', () => {
    createBadgeContainer('bottom:24px;left:24px;')
    const container = getBadgeContainer()
    expect(container).not.toBeNull()
    expect(container!.classList.contains(CLASS_CONTAINER)).toBe(true)
  })

  it('accepts a custom root element', () => {
    createBadgeContainer('bottom:24px;left:24px;')
    // Search within body — should find it
    expect(getBadgeContainer(document.body)).not.toBeNull()
    // Search within an unrelated element — should not find it
    const other = document.createElement('div')
    expect(getBadgeContainer(other)).toBeNull()
  })
})
