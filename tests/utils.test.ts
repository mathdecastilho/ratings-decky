import { describe, it, expect } from 'vitest'
import { sanitizeName } from '../src/utils'

describe('sanitizeName', () => {
  it('lowercases the input', () => {
    expect(sanitizeName('Hello World')).toBe('hello world')
  })

  it('removes symbols and punctuation', () => {
    expect(sanitizeName('Elden Ring: Shadow of the Erdtree')).toBe('elden ring shadow of the erdtree')
  })

  it('collapses multiple spaces into one', () => {
    expect(sanitizeName('God  of   War')).toBe('god of war')
  })

  it('trims leading and trailing whitespace', () => {
    expect(sanitizeName('  Hades  ')).toBe('hades')
  })

  it('handles names with numbers', () => {
    expect(sanitizeName('Halo 3: ODST')).toBe('halo 3 odst')
  })

  it('handles empty string', () => {
    expect(sanitizeName('')).toBe('')
  })

  it('handles string with only symbols', () => {
    expect(sanitizeName('!@#$%')).toBe('')
  })

  it('preserves alphanumeric characters', () => {
    expect(sanitizeName('GTA5')).toBe('gta5')
  })
})
