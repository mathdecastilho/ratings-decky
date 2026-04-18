import React from 'react'
import { definePlugin, staticClasses } from '@decky/ui'
import { routerHook } from '@decky/api'
import { FaStar } from 'react-icons/fa'

import patchLibraryApp from './lib/patchLibraryApp'
import { initStorePatch } from './patches/StorePatch'

export default definePlugin(() => {
  const libraryPatch = patchLibraryApp()
  const stopStorePatch = initStorePatch()

  return {
    title: <div className={staticClasses.Title}>Ratings Decky</div>,
    icon: <FaStar />,
    content: (
      <div style={{ padding: '12px 16px', color: '#ccc', fontSize: 13 }}>
        Displays SteamDB, OpenCritic and Metacritic scores on game pages.
      </div>
    ),
    onDismount() {
      routerHook.removePatch('/library/app/:appid', libraryPatch)
      stopStorePatch()
    },
  }
})
