import React from 'react'
import ReactDOM from 'react-dom/client'
import Graphible from './App.jsx'
import './index.css'

// Hide loading screen once React loads
const loadingElement = document.getElementById('loading');
if (loadingElement) {
  loadingElement.style.display = 'none';
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Graphible />
  </React.StrictMode>,
)