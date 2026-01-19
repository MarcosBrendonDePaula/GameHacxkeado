import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useSession, isEstablished, SessionStateType } from "@fogo/sessions-sdk-react";
import { setWallet, getMe, getEncryptionSignature } from "../lib/api";

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
  getEncryptionSignature: () => Promise<string>;
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

  // Configura a sessão no utilitário de API quando conecta
  useEffect(() => {
    if (isConnected && sessionState.walletPublicKey && sessionState.sessionKey) {
      // Extrai a public key da session key
      const getSessionPubkey = async () => {
        try {
          // Exporta a public key da session
          const publicKeyRaw = await crypto.subtle.exportKey(
            "raw",
            sessionState.sessionKey.publicKey
          );
          const publicKeyBytes = new Uint8Array(publicKeyRaw);

          // Cria um objeto que simula PublicKey para toBase58()
          const sessionPubkeyObj = {
            toBase58: () => {
              // Converte para Base58
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

          // Configura o adaptador de sessão
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
          setWallet(sessionAdapter);
        } catch (err) {
          console.error("Erro ao configurar sessão:", err);
        }
      };

      getSessionPubkey();
    } else {
      setWallet(null);
      setAccount(null);
      setBot(null);
    }
  }, [isConnected, sessionState]);

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

  // Carrega conta automaticamente quando conecta
  useEffect(() => {
    if (isConnected) {
      refreshAccount();
    }
  }, [isConnected]);

  const value: AuthContextType = {
    isConnected,
    walletPubkey,
    sessionState,
    account,
    bot,
    isLoading,
    error,
    refreshAccount,
    getEncryptionSignature,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
