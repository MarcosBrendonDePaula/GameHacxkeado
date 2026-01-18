import { FC, ReactNode } from 'react'
import { FogoSessionProvider } from '@fogo/sessions-sdk-react'
import { Network } from '@fogo/sessions-sdk'
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets'

interface Props {
  children: ReactNode
}

// Wallets suportadas
const wallets = [
  new PhantomWalletAdapter(),
  new SolflareWalletAdapter(),
]

export const WalletProvider: FC<Props> = ({ children }) => {
  // Usa proxies locais para contornar CORS
  // RPC: /api/rpc
  // Paymaster: SDK faz new URL("/api/xxx", paymaster), então passa só a origin
  const rpcUrl = `${window.location.origin}/api/rpc`
  const paymasterUrl = window.location.origin // SDK adiciona /api/sponsor_pubkey etc

  return (
    <FogoSessionProvider
      network={Network.Mainnet}
      domain="https://fogofishing.com" // Domínio oficial do Fogo Fishing
      rpc={rpcUrl}
      paymaster={paymasterUrl}
      wallets={wallets}
      enableUnlimited={true}
    >
      {children}
    </FogoSessionProvider>
  )
}
