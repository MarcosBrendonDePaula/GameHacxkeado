// Override crypto.subtle.generateKey para forçar chaves Ed25519 como extractable
// Isso permite que a sessão do Fogo SDK seja exportável sem precisar criar uma segunda sessão
const _origGenerateKey = crypto.subtle.generateKey.bind(crypto.subtle)
crypto.subtle.generateKey = async (algorithm: any, extractable: boolean, keyUsages: KeyUsage[]) => {
  if (algorithm === 'Ed25519' || algorithm?.name === 'Ed25519') {
    return _origGenerateKey(algorithm, true, keyUsages)
  }
  return _origGenerateKey(algorithm, extractable, keyUsages)
}

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
