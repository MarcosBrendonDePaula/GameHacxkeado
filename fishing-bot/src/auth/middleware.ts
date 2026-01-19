import { Elysia } from "elysia";
import { verifySignedRequest, ensureAccountExists, type AuthHeaders } from "./index";

/**
 * Contexto de autenticação
 */
export interface AuthContext {
  authenticated: boolean;
  walletPubkey: string | null;
  error: string | null;
}

/**
 * Middleware de autenticação para Elysia
 * Verifica assinatura da wallet em cada request
 */
export const authMiddleware = new Elysia({ name: "auth" })
  .derive(async ({ request, path }): Promise<{ auth: AuthContext }> => {
    // Extrai headers de autenticação
    const headers: Partial<AuthHeaders> = {
      "x-wallet-pubkey": request.headers.get("x-wallet-pubkey") || undefined,
      "x-session-pubkey": request.headers.get("x-session-pubkey") || undefined,
      "x-signature": request.headers.get("x-signature") || undefined,
      "x-nonce": request.headers.get("x-nonce") || undefined,
    };

    // Lê o body se existir (para incluir no hash da assinatura)
    let body: string | undefined;
    if (request.method === "POST" || request.method === "PUT" || request.method === "PATCH") {
      try {
        body = await request.clone().text();
      } catch {
        body = undefined;
      }
    }

    // Verifica a assinatura
    const result = await verifySignedRequest(
      request.method,
      path,
      headers,
      body
    );

    if (!result.valid) {
      return {
        auth: {
          authenticated: false,
          walletPubkey: null,
          error: result.error || "Autenticacao falhou",
        }
      };
    }

    // Garante que a conta existe no banco
    await ensureAccountExists(result.walletPubkey!);

    return {
      auth: {
        authenticated: true,
        walletPubkey: result.walletPubkey!,
        error: null,
      }
    };
  });

/**
 * Guard que requer autenticação válida
 * Retorna 401 se não autenticado
 */
export const requireAuth = new Elysia({ name: "require-auth" })
  .use(authMiddleware)
  .onBeforeHandle(({ auth, set }) => {
    if (!auth || !auth.authenticated) {
      set.status = 401;
      return {
        error: "Nao autorizado",
        message: auth?.error || "Assinatura invalida ou ausente",
      };
    }
  });
