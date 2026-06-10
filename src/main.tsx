import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './overlay/overlay.css'
import App from './App.tsx'
import SettingsApp from './settings/SettingsApp.tsx'
import DockProto from './dock-proto/DockProto.tsx' // THROWAWAY — tool-dock UI exploration (#dock)
import { isSettingsWindow } from './overlay/settingsWindow'

// One bundle, two windows: the #settings hash selects the settings surface; everything
// else is the overlay. The body attribute lets CSS give settings an opaque background
// while the overlay stays transparent/frameless.
const root = createRoot(document.getElementById('root')!)

// THROWAWAY: #dock mounts the tool-dock prototype (src/dock-proto). Delete with its folder.
const dockProto = location.hash === '#dock'
const settings = !dockProto && isSettingsWindow()
document.body.dataset.window = settings ? 'settings' : 'overlay'

root.render(
  <StrictMode>
    {dockProto ? <DockProto /> : settings ? <SettingsApp /> : <App />}
  </StrictMode>,
)
