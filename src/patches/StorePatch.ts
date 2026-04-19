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

// Guards against concurrent connect attempts
let connectInProgress = false
let connectTimer: ReturnType<typeof setTimeout> | null = null

// Guards against overlapping async injection
let injectionGeneration = 0

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
  if (!storeWebSocket || storeWebSocket.readyState !== WebSocket.OPEN) return
  storeWebSocket.send(JSON.stringify({ id: messageId++, method: 'Runtime.evaluate', params: { expression } }))
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
  sendScript(`(function(){ var removeBadgeContainer = ${removeBadgeContainer.toString()}; removeBadgeContainer(); })()`)
}

// ── Ratings injection ───────────────────────────────────────────────────────────

async function injectRatingsForApp(appId: string) {
  const gen = ++injectionGeneration

  injectBadge(appId)

  const { fetchSteamdbRating }    = await import('../ratings/steamdb')
  const { fetchOpencriticRating } = await import('../ratings/opencritic')
  const { fetchMetacriticRating } = await import('../ratings/metacritic')

  if (gen !== injectionGeneration) return

  fetchSteamdbRating(appId).then((r)    => { if (gen === injectionGeneration) updateBadge('steamdb',    r.label, r.url) })
  fetchOpencriticRating(appId).then((r) => { if (gen === injectionGeneration) updateBadge('opencritic', r.label, r.url) })
  fetchMetacriticRating(appId).then((r) => { if (gen === injectionGeneration) updateBadge('metacritic', r.label, r.url) })
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

function cancelPendingConnect() {
  if (connectTimer !== null) {
    clearTimeout(connectTimer)
    connectTimer = null
  }
}

function closeExistingSocket() {
  if (storeWebSocket) {
    storeWebSocket.onopen = null
    storeWebSocket.onmessage = null
    storeWebSocket.onerror = null
    storeWebSocket.onclose = null
    storeWebSocket.close()
    storeWebSocket = null
  }
  wsReady = false
}

async function connectToStoreDebugger(retries = 5): Promise<void> {
  if (!isStoreMounted || retries <= 0 || connectInProgress) return

  connectInProgress = true
  cancelPendingConnect()

  try {
    const response = await fetchNoCors('http://localhost:8080/json')
    const tabs: Tab[] = await response.json()
    const storeTab = tabs.find((t) => t.url.includes('store.steampowered.com'))

    if (!storeTab) {
      connectInProgress = false
      if (isStoreMounted && retries > 1) {
        connectTimer = setTimeout(() => connectToStoreDebugger(retries - 1), 1000)
      }
      return
    }

    closeExistingSocket()
    onUrlChange(storeTab.url)

    const ws = new WebSocket(storeTab.webSocketDebuggerUrl)
    storeWebSocket = ws

    ws.onopen = () => {
      ws.send(JSON.stringify({ id: messageId++, method: 'Page.enable' }))
      setTimeout(() => {
        if (storeWebSocket !== ws || !isStoreMounted) return
        wsReady = true
        if (currentAppId) injectRatingsForApp(currentAppId)
      }, 300)
    }

    ws.onmessage = (ev) => {
      if (!isStoreMounted || storeWebSocket !== ws) return
      try {
        const data = JSON.parse(ev.data)
        if (data.method === 'Page.frameNavigated' && data.params?.frame?.url) {
          const url: string = data.params.frame.url
          // Only react to Steam store URLs. External navigations (from badge
          // clicks using location.href) are ignored — when the user presses
          // Back the browser returns to the store and fires a new event.
          if (!url.startsWith('https://store.steampowered.com')) return
          setTimeout(() => onUrlChange(url), 500)
        }
      } catch (_) {}
    }

    ws.onerror = () => {
      if (storeWebSocket !== ws) return
      closeExistingSocket()
      connectInProgress = false
      // Retry only during initial connection (store tab may still be loading)
      if (isStoreMounted && retries > 1) {
        connectTimer = setTimeout(() => connectToStoreDebugger(retries - 1), 2000)
      }
    }

    ws.onclose = () => {
      if (storeWebSocket !== ws) return
      storeWebSocket = null
      wsReady = false
      connectInProgress = false
      // Do NOT auto-reconnect on close. The WebSocket stays alive through
      // in-page navigations (location.href). A close means the tab was
      // destroyed or something external disrupted the target — retrying
      // aggressively is what caused the freeze loop.
    }

    connectInProgress = false
  } catch (_) {
    connectInProgress = false
    if (isStoreMounted && retries > 1) {
      connectTimer = setTimeout(() => connectToStoreDebugger(retries - 1), 1000)
    }
  }
}

function disconnectStoreDebugger() {
  isStoreMounted = false
  cancelPendingConnect()
  removeBadge()
  closeExistingSocket()
  connectInProgress = false
  currentAppId = null
  injectionGeneration++
}

function handleLocationChange(pathname: string) {
  if (pathname === '/steamweb') {
    if (!isStoreMounted) {
      isStoreMounted = true
      connectToStoreDebugger()
    }
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
