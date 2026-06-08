import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './overlay/overlay.css'
import App from './App.tsx'
import SettingsApp from './settings/SettingsApp.tsx'
import { isSettingsWindow } from './overlay/settingsWindow'

// One bundle, two windows: the #settings hash selects the settings surface; everything
// else is the overlay. The body attribute lets CSS give settings an opaque background
// while the overlay stays transparent/frameless.
const root = createRoot(document.getElementById('root')!)

const settings = isSettingsWindow()
document.body.dataset.window = settings ? 'settings' : 'overlay'

root.render(<StrictMode>{settings ? <SettingsApp /> : <App />}</StrictMode>)
