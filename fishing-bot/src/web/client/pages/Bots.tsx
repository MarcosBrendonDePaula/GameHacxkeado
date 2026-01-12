import { useEffect, useState } from 'react'
import BotCard from '../components/BotCard'

export interface Bot {
  id: string
  name: string
  status: 'online' | 'offline'
  wallet: string
  catches: number
  misses: number
  delay: number
  totalFish: number
  uptime: string
}

export default function Bots() {
  const [bots, setBots] = useState<Bot[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchBots()
    const interval = setInterval(fetchBots, 3000) // Atualiza a cada 3s
    return () => clearInterval(interval)
  }, [])

  async function fetchBots() {
    try {
      const res = await fetch('/api/bots')
      const data = await res.json()
      setBots(data.bots)
    } catch (error) {
      console.error('Erro ao buscar bots:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleStartBot(id: string) {
    try {
      const res = await fetch(`/api/bots/${id}/start`, { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        // Atualiza o bot localmente
        setBots(bots.map(b => b.id === id ? data.bot : b))
      }
    } catch (error) {
      console.error('Erro ao iniciar bot:', error)
    }
  }

  async function handleStopBot(id: string) {
    try {
      const res = await fetch(`/api/bots/${id}/stop`, { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        // Atualiza o bot localmente
        setBots(bots.map(b => b.id === id ? data.bot : b))
      }
    } catch (error) {
      console.error('Erro ao parar bot:', error)
    }
  }

  if (loading) {
    return <div className="loading">Carregando bots...</div>
  }

  return (
    <div>
      <h2>🤖 Gerenciamento de Bots</h2>
      <div className="bots-grid">
        {bots.map(bot => (
          <BotCard
            key={bot.id}
            bot={bot}
            onStart={() => handleStartBot(bot.id)}
            onStop={() => handleStopBot(bot.id)}
          />
        ))}
      </div>
    </div>
  )
}
