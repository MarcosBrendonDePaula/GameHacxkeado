# Como Extrair a Session Keypair do Navegador

## Método 1: Console do Navegador

1. Abra o jogo no navegador e faça login
2. Abra o DevTools (F12)
3. Vá na aba **Console**
4. Cole este código:

```javascript
// Mostra informações da sessão
const session = window.__sessionState || window.__session;
console.log("Session Info:", {
  walletPublicKey: session?.walletPublicKey?.toBase58(),
  sessionPublicKey: session?.sessionPublicKey?.toBase58(),
});

// Tenta extrair a keypair (pode não funcionar se estiver encriptada)
console.log("Session Key:", session?.sessionKey);
```

5. Copie o `sessionPublicKey` que aparece

## Método 2: LocalStorage/SessionStorage

No console, execute:

```javascript
// Procura por chaves relacionadas a session
for (let i = 0; i < localStorage.length; i++) {
  const key = localStorage.key(i);
  if (key.includes('session') || key.includes('keypair') || key.includes('fogo')) {
    console.log(key, localStorage.getItem(key));
  }
}

for (let i = 0; i < sessionStorage.length; i++) {
  const key = sessionStorage.key(i);
  if (key.includes('session') || key.includes('keypair') || key.includes('fogo')) {
    console.log(key, sessionStorage.getItem(key));
  }
}
```

## Método 3: Usar o Paymaster (MAIS FÁCIL)

O jogo usa um sistema de "paymaster" que fornece SOL para as sessions.

**Solução**: Em vez de usar sessions, adicione um pouco de SOL na sua wallet principal:

1. Peça para alguém transferir 0.01 SOL da rede Fogo para seu endereço:
   `2Y2fq8xvozS8QmfMv52md2WpqmLozo32RHWPED1jyX8h`

2. Ou use um faucet da rede Fogo (se existir)

## Método 4: Modificar o Bot para NÃO precisar de SOL

Podemos implementar o sistema de paymaster igual ao jogo usa. Isso é mais complexo mas seria a solução "profissional".

---

**Qual método você prefere?**
