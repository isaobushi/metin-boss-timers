import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './overlay/overlay.css'
import App from './App.tsx'
import SettingsApp from './settings/SettingsApp.tsx'
import { isSettingsWindow, initialSettingsTab } from './overlay/settingsWindow'
import { TooltipLayer } from './overlay/Tooltip.tsx'

// One bundle, two windows: the #settings hash selects the settings surface; everything
// else is the overlay. The body attribute lets CSS give settings an opaque background
// while the overlay stays transparent/frameless. The hash's deep-linked tab (#72) is read
// HERE — the one place that owns the URL — and handed to SettingsApp as a plain prop.
const root = createRoot(document.getElementById('root')!)

const settings = isSettingsWindow()
document.body.dataset.window = settings ? 'settings' : 'overlay'

root.render(
  <StrictMode>
    {settings ? <SettingsApp initialTab={initialSettingsTab() ?? undefined} /> : <App />}
    <TooltipLayer />
  </StrictMode>,
)
