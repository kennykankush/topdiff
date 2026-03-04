import React from 'react'
import ReactDOM from 'react-dom/client'
import './globals.css'
import MainApp from './main-app/App'
import OverlayApp from './overlay-app/App'

const isOverlay = window.location.hash === '#overlay'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isOverlay ? <OverlayApp /> : <MainApp />}
  </React.StrictMode>
)
