import { fetchNoCors } from '@decky/api'
import { findModuleExport } from '@decky/ui'

// Steam's internal history object (same technique as protondb-decky)
const HistoryModule = findModuleExport((exp: any) => exp?.m_history !== undefined)
const History = HistoryModule?.m_history

let isStoreMounted = false
let storeWebSocket: WebSocket | null = null
let historyUnlisten: (() => void) | null = null
let messageId = 1
let wsReady = false

interface Tab {
  id: string
  url: string
  webSocketDebuggerUrl: string
}

function extractAppIdFromUrl(url: string): string {
  if (!url.includes('store.steampowered.com/app/')) return ''
  return url.match(/\/app\/([\d]+)\/?/)?.[1] ?? ''
}

// Inject a placeholder badge container into the store page via WebSocket debugger
function injectBadge(appId: string) {
  if (!storeWebSocket || storeWebSocket.readyState !== WebSocket.OPEN || !wsReady) return

  const containerId = 'steam-rating-badge'
  const badgeStyle = 'background:rgba(0,0,0,0.75);color:#fff;padding:4px 10px;border-radius:4px;font-size:14px;font-weight:bold;cursor:pointer;'

  const script = `
    (function() {
      const existing = document.getElementById('${containerId}');
      if (existing) existing.remove();
      const el = document.createElement('div');
      el.id = '${containerId}';
      el.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:999999;display:flex;gap:6px;';
      el.innerHTML = \`
        <div id="sr-steamdb"  style="${badgeStyle}" data-url="https://www.steamdb.info/app/${appId}/">SteamDB ...</div>
        <div id="sr-oc"       style="${badgeStyle}" data-url="https://opencritic.com/">OpenCritic ...</div>
        <div id="sr-mc"       style="${badgeStyle}" data-url="https://www.metacritic.com/">Metacritic ...</div>
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

function updateBadge(elementId: string, label: string, url: string) {
  if (!storeWebSocket || storeWebSocket.readyState !== WebSocket.OPEN || !wsReady) return
  const script = `
    (function() {
      const el = document.getElementById('${elementId}');
      if (!el) return;
      el.textContent = ${JSON.stringify(label)};
      el.setAttribute('data-url', ${JSON.stringify(url)});
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

  // Dynamically import to avoid circular deps at module load time
  const { fetchSteamdbRating } = await import('../ratings/steamdb')
  const { fetchOpencriticRating } = await import('../ratings/opencritic')
  const { fetchMetacriticRating } = await import('../ratings/metacritic')

  fetchSteamdbRating(appId).then((r) => updateBadge('sr-steamdb', `SteamDB ${r.label}`, r.url))
  fetchOpencriticRating(appId).then((r) => updateBadge('sr-oc', `OpenCritic ${r.label}`, r.url))
  fetchMetacriticRating(appId).then((r) => updateBadge('sr-mc', `Metacritic ${r.label}`, r.url))
}

let currentAppId = ''

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
  currentAppId = ''
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

  return () => {
    historyUnlisten?.()
    historyUnlisten = null
    disconnectStoreDebugger()
  }
}
