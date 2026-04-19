import { fetchNoCors } from '@decky/api'
import { findModuleExport } from '@decky/ui'
import { subscribe } from '../hooks/useSettings'
import {
  createBadgeContainer,
  updateBadgeValue,
  repositionBadgeContainer,
  removeBadgeContainer,
} from '../lib/badgeDom'

// Steam's internal history object (same technique as protondb-decky)
const HistoryModule = findModuleExport((exp: any) => exp?.m_history !== undefined)
const History = HistoryModule?.m_history

let isStoreMounted = false
let storeWebSocket: WebSocket | null = null
let historyUnlisten: (() => void) | null = null
let settingsUnsubscribe: (() => void) | null = null
let messageId = 1
let wsReady = false

interface Tab {
  id: string
  url: string
  webSocketDebuggerUrl: string
}

function extractAppIdFromUrl(url: string): string | null {
  if (!url.includes('store.steampowered.com/app/')) return null
  return url.match(/\/app\/([\d]+)\/?/)?.[1] ?? null
}

const EDGE        = 24  // px from viewport edges
const BOTTOM_EDGE = 24  // px from bottom edge

function positionCss(): string {
  return `bottom:${BOTTOM_EDGE}px;left:${EDGE}px;`
}

// ── Script injection ────────────────────────────────────────────────────────────
// The Store page runs in an isolated browser context, so we serialise the
// badgeDom functions via .toString() and evaluate them over the DevTools WebSocket.

function sendScript(expression: string) {
  storeWebSocket!.send(JSON.stringify({ id: messageId++, method: 'Runtime.evaluate', params: { expression } }))
}

function sendBadgeDomScript(call: string) {
  if (!storeWebSocket || storeWebSocket.readyState !== WebSocket.OPEN || !wsReady) return
  const script = `(function(){
    var createBadgeContainer    = ${createBadgeContainer.toString()};
    var updateBadgeValue        = ${updateBadgeValue.toString()};
    var repositionBadgeContainer = ${repositionBadgeContainer.toString()};
    var removeBadgeContainer    = ${removeBadgeContainer.toString()};
    ${call}
  })()`
  sendScript(script)
}

// ── Badge lifecycle ─────────────────────────────────────────────────────────────

function injectBadge(appId: string) {
  const css = positionCss()
  const steamdbUrl = JSON.stringify(`https://www.steamdb.info/app/${appId}/`)
  sendBadgeDomScript(`
    createBadgeContainer(${JSON.stringify(css)});
    updateBadgeValue('steamdb', '...', ${steamdbUrl});
  `)
}

function updateBadge(name: string, value: string, url: string) {
  sendBadgeDomScript(`updateBadgeValue(${JSON.stringify(name)}, ${JSON.stringify(value)}, ${JSON.stringify(url)});`)
}

function repositionBadge() {
  if (!storeWebSocket || storeWebSocket.readyState !== WebSocket.OPEN || !wsReady) return
  const css = positionCss()
  sendBadgeDomScript(`repositionBadgeContainer(${JSON.stringify(css)});`)
}

function removeBadge() {
  if (!storeWebSocket || storeWebSocket.readyState !== WebSocket.OPEN) return
  // removeBadgeContainer has no dependencies so inline it directly for the remove case
  sendScript(`(function(){ var removeBadgeContainer = ${removeBadgeContainer.toString()}; removeBadgeContainer(); })()`)
}

// ── Ratings injection ───────────────────────────────────────────────────────────

async function injectRatingsForApp(appId: string) {
  injectBadge(appId)

  const { fetchSteamdbRating }    = await import('../ratings/steamdb')
  const { fetchOpencriticRating } = await import('../ratings/opencritic')
  const { fetchMetacriticRating } = await import('../ratings/metacritic')

  fetchSteamdbRating(appId).then((r)    => updateBadge('steamdb',    r.label, r.url))
  fetchOpencriticRating(appId).then((r) => updateBadge('opencritic', r.label, r.url))
  fetchMetacriticRating(appId).then((r) => updateBadge('metacritic', r.label, r.url))
}

// ── URL / mount handling ────────────────────────────────────────────────────────

let currentAppId: string | null = null

function onUrlChange(url: string) {
  const appId = extractAppIdFromUrl(url)
  if (appId === currentAppId) return
  currentAppId = appId
  if (appId) {
    injectRatingsForApp(appId)
  } else {
    removeBadge()
  }
}

async function connectToStoreDebugger(retries = 5): Promise<void> {
  if (!isStoreMounted || retries <= 0) return

  try {
    const response = await fetchNoCors('http://localhost:8080/json')
    const tabs: Tab[] = await response.json()
    const storeTab = tabs.find((t) => t.url.includes('store.steampowered.com'))

    if (!storeTab) {
      setTimeout(() => connectToStoreDebugger(retries - 1), 1000)
      return
    }

    onUrlChange(storeTab.url)

    storeWebSocket = new WebSocket(storeTab.webSocketDebuggerUrl)

    storeWebSocket.onopen = (ev) => {
      const ws = ev.target as WebSocket
      ws.send(JSON.stringify({ id: messageId++, method: 'Page.enable' }))
      ws.send(JSON.stringify({ id: messageId++, method: 'Runtime.enable' }))
      setTimeout(() => {
        wsReady = true
        if (currentAppId) injectRatingsForApp(currentAppId)
      }, 300)
    }

    storeWebSocket.onmessage = (ev) => {
      if (!isStoreMounted) return
      try {
        const data = JSON.parse(ev.data)
        if (data.method === 'Page.frameNavigated' && data.params?.frame?.url) {
          setTimeout(() => onUrlChange(data.params.frame.url), 500)
        }
      } catch (_) {}
    }

    storeWebSocket.onerror = () => {
      if (isStoreMounted) setTimeout(() => connectToStoreDebugger(retries - 1), 1000)
    }

    storeWebSocket.onclose = () => {
      storeWebSocket = null
      wsReady = false
      if (isStoreMounted) setTimeout(() => connectToStoreDebugger(retries - 1), 1000)
    }
  } catch (_) {
    if (isStoreMounted) setTimeout(() => connectToStoreDebugger(retries - 1), 1000)
  }
}

function disconnectStoreDebugger() {
  removeBadge()
  isStoreMounted = false
  wsReady = false
  currentAppId = null
  storeWebSocket?.close()
  storeWebSocket = null
}

function handleLocationChange(pathname: string) {
  if (pathname === '/steamweb') {
    isStoreMounted = true
    connectToStoreDebugger()
  } else if (isStoreMounted) {
    disconnectStoreDebugger()
  }
}

export function initStorePatch(): () => void {
  if (!History) return () => {}

  handleLocationChange(History.location?.pathname ?? '')

  historyUnlisten = History.listen(({ pathname }: { pathname: string }) => {
    handleLocationChange(pathname)
  })

  // Reposition badge live when settings change
  settingsUnsubscribe = subscribe((_settings) => {
    repositionBadge()
  })

  return () => {
    historyUnlisten?.()
    historyUnlisten = null
    settingsUnsubscribe?.()
    settingsUnsubscribe = null
    disconnectStoreDebugger()
  }
}
