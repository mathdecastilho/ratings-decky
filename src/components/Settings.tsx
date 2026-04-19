import { useEffect, useState } from 'react'
import { DropdownItem, ButtonItem, PanelSection, PanelSectionRow } from '@decky/ui'
import { getSettings, subscribe, updateSettings, BadgePosition } from '../hooks/useSettings'
import { clearCache } from '../cache'

const positionOptions: { data: number; label: string; value: BadgePosition }[] = [
  { data: 0, label: 'Top Left',  value: 'tl' },
  { data: 1, label: 'Top Right', value: 'tr' },
]

export default function Settings() {
  const [settings, setSettings] = useState(getSettings())
  const [clearing, setClearing] = useState(false)
  const [cleared, setCleared] = useState(false)

  useEffect(() => {
    return subscribe((s) => setSettings({ ...s }))
  }, [])

  const selectedIndex = positionOptions.findIndex((o) => o.value === settings.position)

  const handleClearCache = async () => {
    setClearing(true)
    setCleared(false)
    await clearCache()
    setClearing(false)
    setCleared(true)
    setTimeout(() => setCleared(false), 2000)
  }

  return (
    <>
      <PanelSection title="Badge Position">
        <PanelSectionRow>
          <DropdownItem
            layout="below"
            label="Library"
            description="Where to show badges on the game library page"
            rgOptions={positionOptions.map((o) => ({ data: o.data, label: o.label }))}
            selectedOption={selectedIndex >= 0 ? selectedIndex : 0}
            onChange={(opt) => {
              const picked = positionOptions[opt.data]
              if (picked) updateSettings('position', picked.value)
            }}
          />
        </PanelSectionRow>
      </PanelSection>
      <PanelSection title="Legal">
        <div>Ratings data is sourced from Steam, SteamDB, OpenCritic, and Metacritic.</div>
        <div style={{ marginTop: 4 }}>
          This plugin does not own or claim any copyright over the displayed scores.
          All rating data belongs to their respective providers.
        </div>
        <div style={{ marginTop: 4 }}>
          <b>Disclaimer</b>: the results may not be correct, always touch the corresponding rating on the screen, to see the complete information.
        </div>
      </PanelSection>
      <PanelSection title="Cache">
        <PanelSectionRow>
          <ButtonItem
            layout="below"
            label="Clear Ratings Cache"
            description="Remove locally cached ratings so fresh data is fetched"
            onClick={handleClearCache}
            disabled={clearing}
          >
            {cleared ? 'Cleared!' : clearing ? 'Clearing...' : 'Clear Cache'}
          </ButtonItem>
        </PanelSectionRow>
      </PanelSection>
    </>
  )
}
