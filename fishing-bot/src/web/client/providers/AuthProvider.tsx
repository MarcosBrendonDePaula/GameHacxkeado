import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useSession, isEstablished, SessionStateType } from "@fogo/sessions-sdk-react";
import { setWallet, getMe } from "../lib/api";

interface AuthContextType {
  // Estado da wallet/sessão
  isConnected: boolean;
  walletPubkey: string | null;
  sessionState: any;

  // Estado da conta no backend
  account: any | null;
  bot: any | null;
  isLoading: boolean;
  error: string | null;

  // Ações
  refreshAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth deve ser usado dentro de AuthProvider");
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const sessionState = useSession();

  const [account, setAccount] = useState<any | null>(null);
  const [bot, setBot] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Verifica se está conectado (sessão estabelecida)
  const isConnected = isEstablished(sessionState);
  const walletPubkey = isConnected ? sessionState.walletPublicKey?.toBase58() : null;

  // Carrega dados da conta quando conectado
  const refreshAccount = async () => {
    if (!isConnected) {
      setAccount(null);
      setBot(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const meData = await getMe();
      console.log('[AuthProvider] getMe response:', meData);
      setAccount(meData.account);
      setBot(meData.bot);
    } catch (err: any) {
      console.error("Erro ao carregar conta:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Configura a sessão no utilitário de API quando conecta
  // e SÓ DEPOIS carrega os dados da conta (evita race condition)
  useEffect(() => {
    if (isConnected && sessionState.walletPublicKey && sessionState.sessionKey) {
      const setupAndLoad = async () => {
        try {
          // 1. Exporta a public key da session
          const publicKeyRaw = await crypto.subtle.exportKey(
            "raw",
            sessionState.sessionKey.publicKey
          );
          const publicKeyBytes = new Uint8Array(publicKeyRaw);

          const sessionPubkeyObj = {
            toBase58: () => {
              const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
              const digits: number[] = [0];
              for (const byte of publicKeyBytes) {
                let carry = byte;
                for (let j = 0; j < digits.length; j++) {
                  carry += (digits[j] ?? 0) << 8;
                  digits[j] = carry % 58;
                  carry = (carry / 58) | 0;
                }
                while (carry > 0) {
                  digits.push(carry % 58);
                  carry = (carry / 58) | 0;
                }
              }
              let result = "";
              for (let i = digits.length - 1; i >= 0; i--) {
                result += ALPHABET[digits[i]!];
              }
              return result;
            }
          };

          const sessionAdapter = {
            walletPubkey: sessionState.walletPublicKey,
            sessionPubkey: sessionPubkeyObj,
            signMessage: async (message: Uint8Array) => {
              const privateKey = sessionState.sessionKey.privateKey;
              const signature = await crypto.subtle.sign(
                { name: "Ed25519" },
                privateKey,
                message
              );
              return new Uint8Array(signature);
            },
          };

          // 2. Configura a sessão
          setWallet(sessionAdapter);

          // 3. Agora sim carrega os dados (sessão já está configurada)
          await refreshAccount();
        } catch (err) {
          console.error("Erro ao configurar sessão:", err);
        }
      };

      setupAndLoad();
    } else {
      setWallet(null);
      setAccount(null);
      setBot(null);
    }
  }, [isConnected, sessionState]);

  const value: AuthContextType = {
    isConnected,
    walletPubkey,
    sessionState,
    account,
    bot,
    isLoading,
    error,
    refreshAccount,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
