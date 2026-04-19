import { callable } from '@decky/api'

export type BadgePosition = 'tl' | 'tr'

export interface Settings {
  position: BadgePosition
}

export const DEFAULT_SETTINGS: Settings = {
  position: 'tl',
}

type Listener = (settings: Settings) => void
const listeners = new Set<Listener>()
let current: Settings = { ...DEFAULT_SETTINGS }

export function getSettings(): Settings {
  return current
}

function notify() {
  listeners.forEach((l) => l(current))
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const getSetting = callable<[key: string, fallback: Settings], Settings>('get_setting')
const setSetting = callable<[key: string, value: Settings], boolean>('set_setting')

export async function loadSettings(): Promise<void> {
  const saved = await getSetting('settings', DEFAULT_SETTINGS)
  current = { ...DEFAULT_SETTINGS, ...saved }
  notify()
}

export function updateSettings<K extends keyof Settings>(key: K, value: Settings[K]): void {
  current = { ...current, [key]: value }
  setSetting('settings', current)
  notify()
}
