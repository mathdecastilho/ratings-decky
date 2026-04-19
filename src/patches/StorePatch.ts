import { fetchNoCors } from '@decky/api'
import { findModuleExport } from '@decky/ui'
import { subscribe } from '../hooks/useSettings'
import { BADGE_INLINE_STYLE } from '../components/badgeStyle'

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

const EDGE = 24        // px from viewport edges
const BOTTOM_EDGE = 24 // px from bottom edge

function positionCss(): string {
  return `bottom:${BOTTOM_EDGE}px;left:${EDGE}px;`
}

function injectBadge(appId: string) {
  if (!storeWebSocket || storeWebSocket.readyState !== WebSocket.OPEN || !wsReady) return

  const css = positionCss()
  const containerId = 'steam-rating-badge'
  const badgeStyle = BADGE_INLINE_STYLE

  const script = `
    (function() {
      const existing = document.getElementById('${containerId}');
      if (existing) existing.remove();
      const el = document.createElement('div');
      el.id = '${containerId}';
      el.style.cssText = 'position:fixed;${css}z-index:999999;display:flex;flex-direction:column;gap:4px;';
      el.innerHTML = \`
        <div id="sr-steamdb"  style="${badgeStyle}" data-url="https://www.steamdb.info/app/${appId}/"><span style="opacity:0.75">SteamDB</span><span>...</span></div>
        <div id="sr-oc"       style="${badgeStyle}" data-url="https://opencritic.com/"><span style="opacity:0.75">OpenCritic</span><span>...</span></div>
        <div id="sr-mc"       style="${badgeStyle}" data-url="https://www.metacritic.com/"><span style="opacity:0.75">Metacritic</span><span>...</span></div>
      \`;
      el.querySelectorAll('[data-url]').forEach(function(badge) {
        badge.addEventListener('click', function() {
          window.open(badge.getAttribute('data-url'), '_blank');
        });
      });
      document.body.appendChild(el);
    })();
  `
  sendScript(script)
}

function updateBadge(elementId: string, score: number | null, value: string, url: string) {
  if (!storeWebSocket || storeWebSocket.readyState !== WebSocket.OPEN || !wsReady) return
  const script = `
    (function() {
      const el = document.getElementById('${elementId}');
      if (!el) return;
      if (${score === null ? 'true' : 'false'}) { el.style.display = 'none'; return; }
      el.querySelector('span:last-child').textContent = ${JSON.stringify(value)};
      el.setAttribute('data-url', ${JSON.stringify(url)});
    })();
  `
  sendScript(script)
}

function repositionBadge() {
  if (!storeWebSocket || storeWebSocket.readyState !== WebSocket.OPEN || !wsReady) return
  const css = positionCss()
  const script = `
    (function() {
      const el = document.getElementById('steam-rating-badge');
      if (!el) return;
      el.style.cssText = 'position:fixed;${css}z-index:999999;display:flex;flex-direction:column;gap:4px;';
    })();
  `
  sendScript(script)
}

function removeBadge() {
  if (!storeWebSocket || storeWebSocket.readyState !== WebSocket.OPEN) return
  sendScript(`(function(){ const el = document.getElementById('steam-rating-badge'); if(el) el.remove(); })();`)
}

function sendScript(expression: string) {
  storeWebSocket!.send(JSON.stringify({ id: messageId++, method: 'Runtime.evaluate', params: { expression } }))
}

async function injectRatingsForApp(appId: string) {
  injectBadge(appId)

  const { fetchSteamdbRating } = await import('../ratings/steamdb')
  const { fetchOpencriticRating } = await import('../ratings/opencritic')
  const { fetchMetacriticRating } = await import('../ratings/metacritic')

  fetchSteamdbRating(appId).then((r) => updateBadge('sr-steamdb', r.score, r.label, r.url))
  fetchOpencriticRating(appId).then((r) => updateBadge('sr-oc', r.score, r.label, r.url))
  fetchMetacriticRating(appId).then((r) => updateBadge('sr-mc', r.score, r.label, r.url))
}

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

  // Reposition badge live when storePosition setting changes
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
