/**
 * Execution Blocker Patch
 *
 * Trava a execução da página com um alert no início do código.
 * Útil para debugging, mostrar avisos importantes ou pausar execução.
 */

module.exports = {
    name: "Execution Blocker",
    description: "Trava execução com alert no início para debugging/avisos",
    version: "1.0.0",
    author: "GameHacxkeado",

    // Configurações do blocker
    config: {
        message: "🎮 GameHacxkeado Carregado! Clique OK para continuar...",
        position: "start", // start = início do arquivo, early = após primeiras linhas
        showInfo: true, // mostra informações sobre patches aplicados
        debug: false // modo debug com informações extras
    },

    // Gera o código do execution blocker
    getBlockerCode() {
        const message = this.config.message;
        const showInfo = this.config.showInfo;
        const debug = this.config.debug;

        return `
// ========== EXECUTION BLOCKER - INJECTED BY PATCH ==========
// ATENÇÃO: Este código pausa TODA a execução até o alert ser fechado!

(function() {
    'use strict';

    // Mensagem principal
    let alertMessage = "${message}";

    // Adiciona informações se configurado
    ${showInfo ? `
    alertMessage += "\\n\\n📦 Patches GameHacxkeado ativos:";

    // Verifica quais patches estão carregados
    const patches = [];
    if (typeof window.GameHacxkeado !== 'undefined') patches.push("• Config Menu");
    if (typeof window.AutoRepair !== 'undefined') patches.push("• Auto Repair");
    if (document.body && document.body.innerHTML.includes('auto-cast-speed')) patches.push("• Auto Cast Speed");
    if (document.body && document.body.innerHTML.includes('super-cast-speed')) patches.push("• Super Cast Speed");

    if (patches.length > 0) {
        alertMessage += "\\n" + patches.join("\\n");
    } else {
        alertMessage += "\\n• Nenhum patch detectado ainda";
    }

    alertMessage += "\\n\\n⚠️ AVISO: Execução pausada até você clicar OK!";
    ` : ''}

    ${debug ? `
    // Informações de debug
    alertMessage += "\\n\\n🐛 DEBUG INFO:";
    alertMessage += "\\nURL: " + window.location.href;
    alertMessage += "\\nUser Agent: " + navigator.userAgent.substring(0, 50) + "...";
    alertMessage += "\\nTimestamp: " + new Date().toLocaleString();
    alertMessage += "\\nDocument Ready: " + (document.readyState);
    ` : ''}

    // Console log para registro
    console.log("🚨 [EXECUTION BLOCKER] Pausando execução...");
    console.log("📝 Mensagem:", "${message}");
    console.log("⏰ Timestamp:", new Date().toISOString());

    // BLOQUEIA EXECUÇÃO AQUI - Todo o JavaScript para até o alert ser fechado!
    alert(alertMessage);

    // Após o alert ser fechado
    console.log("✅ [EXECUTION BLOCKER] Execução liberada pelo usuário");
    console.log("▶️ Continuando execução normal...");

    // Opcional: Marca no window que o blocker foi executado
    window.GameHacxkeadoBlockerExecuted = {
        timestamp: new Date().toISOString(),
        message: "${message}",
        userConfirmed: true
    };

})();

// ========== FIM DO EXECUTION BLOCKER ==========
`;
    },

    // Função principal de aplicação (injeção no INÍCIO do arquivo)
    async apply(content) {
        console.log('[execution-blocker] Aplicando bloqueador de execução...');

        // Verifica se já foi aplicado
        if (content.includes('EXECUTION BLOCKER - INJECTED BY PATCH')) {
            console.log('[execution-blocker] Bloqueador já foi aplicado anteriormente');
            return content;
        }

        // Gera o código do blocker
        const blockerCode = this.getBlockerCode();

        // INJEÇÃO NO INÍCIO: Adiciona no começo do arquivo para pausar TUDO
        let finalContent;

        if (this.config.position === 'start') {
            // Injeta logo no início (após possíveis comentários iniciais)
            const lines = content.split('\n');
            let insertPosition = 0;

            // Pula comentários iniciais e 'use strict' se existirem
            for (let i = 0; i < Math.min(10, lines.length); i++) {
                const line = lines[i].trim();
                if (line.startsWith('//') ||
                    line.startsWith('/*') ||
                    line.includes('"use strict"') ||
                    line.includes("'use strict'") ||
                    line === '') {
                    insertPosition = i + 1;
                } else {
                    break;
                }
            }

            lines.splice(insertPosition, 0, '', blockerCode, '');
            finalContent = lines.join('\n');

            console.log(`[execution-blocker] Código injetado na linha ${insertPosition + 2} (início do arquivo)`);

        } else {
            // Posição 'early' - injeta no final (mais seguro mas menos efetivo)
            const trimmedContent = content.replace(/\\s+$/, '');
            finalContent = trimmedContent + '\n\n' + blockerCode + '\n';

            console.log('[execution-blocker] Código injetado no final do arquivo');
        }

        console.log('[execution-blocker] ⚠️ AVISO: A execução será pausada com alert!');
        console.log('[execution-blocker] Mensagem:', this.config.message);
        console.log('[execution-blocker] Posição:', this.config.position);
        console.log('[execution-blocker] Bloqueador aplicado com sucesso!');

        return finalContent;
    },

    // Função de remoção
    async remove(content) {
        console.log('[execution-blocker] Removendo bloqueador de execução...');

        // Remove o código injetado
        const startMarker = '// ========== EXECUTION BLOCKER - INJECTED BY PATCH ==========';
        const endMarker = '// ========== FIM DO EXECUTION BLOCKER ==========';

        const startIndex = content.indexOf(startMarker);
        const endIndex = content.indexOf(endMarker);

        if (startIndex !== -1 && endIndex !== -1) {
            const before = content.substring(0, startIndex);
            const after = content.substring(endIndex + endMarker.length);

            // Remove linhas vazias extras
            const cleanedContent = (before + after).replace(/\n{3,}/g, '\n\n');

            console.log('[execution-blocker] Bloqueador removido com sucesso');
            return cleanedContent;
        } else {
            console.log('[execution-blocker] Bloqueador não encontrado para remoção');
            return content;
        }
    },

    // Status atual
    getStatus() {
        return {
            message: this.config.message,
            position: this.config.position,
            showInfo: this.config.showInfo,
            debug: this.config.debug,
            type: 'execution-blocker',
            version: '1.0.0',
            warning: 'PAUSA TODA A EXECUÇÃO ATÉ ALERT SER FECHADO'
        };
    },

    // Configurações predefinidas
    presets: {
        // Aviso simples
        simple: {
            message: "🎮 GameHacxkeado ativo! Clique OK para continuar...",
            position: "start",
            showInfo: false,
            debug: false
        },

        // Aviso completo com informações
        detailed: {
            message: "🎮 GameHacxkeado - Sistema de Patches Carregado!",
            position: "start",
            showInfo: true,
            debug: false
        },

        // Modo debug completo
        debug: {
            message: "🐛 DEBUG MODE - GameHacxkeado",
            position: "start",
            showInfo: true,
            debug: true
        },

        // Aviso de segurança
        warning: {
            message: "⚠️ ATENÇÃO: Patches de hack detectados!\\nClique OK se você tem certeza de que quer continuar...",
            position: "start",
            showInfo: true,
            debug: false
        },

        // Posição mais segura (final do arquivo)
        safe: {
            message: "🎮 GameHacxkeado patches aplicados",
            position: "early",
            showInfo: false,
            debug: false
        }
    },

    // Aplica um preset
    applyPreset(presetName) {
        if (this.presets[presetName]) {
            Object.assign(this.config, this.presets[presetName]);
            console.log(`[execution-blocker] Preset '${presetName}' aplicado:`, this.config);
            return true;
        } else {
            console.error(`[execution-blocker] Preset '${presetName}' não encontrado`);
            return false;
        }
    }
};