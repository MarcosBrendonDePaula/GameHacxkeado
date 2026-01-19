import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../providers/AuthProvider'

export default function Bots() {
  const navigate = useNavigate()
  const { isConnected, bot } = useAuth()

  useEffect(() => {
    // No novo modelo, cada wallet tem no máximo 1 bot
    // Redireciona para o Dashboard que já mostra as informações do bot
    navigate('/')
  }, [navigate])

  // Fallback enquanto redireciona
  return (
    <div style={{ textAlign: 'center', padding: '3rem' }}>
      <p style={{ color: '#888' }}>Redirecionando...</p>
    </div>
  )
}
