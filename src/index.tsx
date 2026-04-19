import { definePlugin, staticClasses } from '@decky/ui'
import { routerHook } from '@decky/api'
import { FaStar } from 'react-icons/fa'

import patchLibraryApp from './lib/patchLibraryApp'
import { initStorePatch } from './patches/StorePatch'
import { loadSettings } from './hooks/useSettings'
import Settings from './components/Settings'

export default definePlugin(() => {
  loadSettings()
  const libraryPatch = patchLibraryApp()
  const stopStorePatch = initStorePatch()

  return {
    title: <div className={staticClasses.Title}>Ratings Decky</div>,
    icon: <FaStar />,
    content: <Settings />,
    onDismount() {
      routerHook.removePatch('/library/app/:appid', libraryPatch)
      stopStorePatch()
    },
  }
})
