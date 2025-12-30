/**
 * Auto Repair System Patch
 *
 * Injeta sistema completo de auto repair no código do jogo.
 * Detecta automaticamente modal de reparo e executa clique no botão "Repair".
 */

module.exports = {
    name: "Auto Repair System",
    description: "Injeta sistema automático de reparo de itens",
    version: "1.0.0",
    author: "GameHacxkeado",

    // Configurações do auto repair
    config: {
        enabled: true,
        checkInterval: 1000, // ms - intervalo para verificar modal
        clickDelay: 500, // ms - delay antes de clicar no botão
        debug: false // ativa logs de debug
    },

    // Código do auto repair para injetar
    getAutoRepairCode() {
        const enabled = this.config.enabled;
        const checkInterval = this.config.checkInterval;
        const clickDelay = this.config.clickDelay;
        const debug = this.config.debug;

        return `
// ========== AUTO REPAIR SYSTEM - INJECTED BY PATCH ==========

(function() {
    'use strict';

    let autoRepairEnabled = ${enabled};
    let autoRepairObserver = null;
    let autoRepairInterval = null;
    const CHECK_INTERVAL = ${checkInterval};
    const CLICK_DELAY = ${clickDelay};
    const DEBUG_MODE = ${debug};

    // Função de log condicional
    function debugLog(message) {
        if (DEBUG_MODE) {
            console.log('[AutoRepair]', message);
        }
    }

    // Detecta modal de reparo por múltiplos critérios
    function detectRepairModal() {
        // Critério 1: Modal com texto "repair" (case insensitive)
        const modalsWithRepair = Array.from(document.querySelectorAll('div, span, p'))
            .filter(el => el.textContent && el.textContent.toLowerCase().includes('repair'));

        if (modalsWithRepair.length > 0) {
            debugLog('Modal detectado por texto "repair"');
            return modalsWithRepair[0];
        }

        // Critério 2: Modal com classe relacionada a reparo
        const repairClassSelectors = [
            '[class*="repair"]',
            '[class*="fix"]',
            '[class*="durability"]',
            '[id*="repair"]',
            '[id*="fix"]'
        ];

        for (const selector of repairClassSelectors) {
            const element = document.querySelector(selector);
            if (element && element.style.display !== 'none') {
                debugLog(\`Modal detectado por seletor: \${selector}\`);
                return element;
            }
        }

        // Critério 3: Modal que apareceu recentemente (MutationObserver)
        const recentModals = document.querySelectorAll('[style*="display: block"], [style*="opacity: 1"]');
        for (const modal of recentModals) {
            if (modal.textContent && modal.textContent.toLowerCase().includes('repair')) {
                debugLog('Modal detectado por aparição recente');
                return modal;
            }
        }

        return null;
    }

    // Encontra botão de reparo no modal
    function findRepairButton(modal) {
        if (!modal) return null;

        // Busca por texto do botão
        const buttonTexts = ['repair', 'fix', 'ok', 'confirm', 'yes'];

        for (const text of buttonTexts) {
            // Busca botões por texto
            const buttons = Array.from(modal.querySelectorAll('button, input[type="button"], div[role="button"]'))
                .filter(btn => btn.textContent && btn.textContent.toLowerCase().includes(text));

            if (buttons.length > 0) {
                debugLog(\`Botão encontrado por texto: "\${text}"\`);
                return buttons[0];
            }
        }

        // Busca por atributos
        const buttonSelectors = [
            'button[class*="repair"]',
            'button[class*="confirm"]',
            'button[onclick*="repair"]',
            'input[value*="repair"]',
            '.repair-button',
            '#repair-btn'
        ];

        for (const selector of buttonSelectors) {
            const button = modal.querySelector(selector);
            if (button) {
                debugLog(\`Botão encontrado por seletor: \${selector}\`);
                return button;
            }
        }

        // Se não encontrou, pega o primeiro botão visível
        const firstButton = modal.querySelector('button:not([style*="display: none"])');
        if (firstButton) {
            debugLog('Usando primeiro botão disponível');
            return firstButton;
        }

        return null;
    }

    // Executa o clique no botão de reparo
    function clickRepairButton(button) {
        if (!button) return false;

        try {
            // Simula clique real
            const clickEvent = new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                view: window
            });

            // Adiciona pequeno delay para simular comportamento humano
            setTimeout(() => {
                button.click();
                button.dispatchEvent(clickEvent);
                debugLog('Clique executado no botão de reparo');
            }, CLICK_DELAY);

            return true;
        } catch (error) {
            debugLog('Erro ao clicar no botão:', error);
            return false;
        }
    }

    // Função principal de auto repair
    function performAutoRepair() {
        if (!autoRepairEnabled) return;

        const modal = detectRepairModal();
        if (modal) {
            debugLog('Modal de reparo detectado');
            const button = findRepairButton(modal);
            if (button) {
                clickRepairButton(button);
                debugLog('Auto repair executado com sucesso');
            } else {
                debugLog('Botão de reparo não encontrado no modal');
            }
        }
    }

    // Configura MutationObserver para detectar mudanças no DOM
    function setupMutationObserver() {
        if (autoRepairObserver) {
            autoRepairObserver.disconnect();
        }

        autoRepairObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                // Verifica se novos nós foram adicionados
                if (mutation.addedNodes.length > 0) {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            // Verifica se é um modal de reparo
                            if (node.textContent && node.textContent.toLowerCase().includes('repair')) {
                                debugLog('Novo modal de reparo detectado pelo MutationObserver');
                                setTimeout(performAutoRepair, 100);
                            }
                        }
                    });
                }
            });
        });

        // Observa mudanças no body
        autoRepairObserver.observe(document.body, {
            childList: true,
            subtree: true
        });

        debugLog('MutationObserver configurado');
    }

    // Inicia sistema de verificação por intervalo
    function startIntervalCheck() {
        if (autoRepairInterval) {
            clearInterval(autoRepairInterval);
        }

        autoRepairInterval = setInterval(performAutoRepair, CHECK_INTERVAL);
        debugLog(\`Verificação por intervalo iniciada (\${CHECK_INTERVAL}ms)\`);
    }

    // Inicializa o sistema de auto repair
    function initAutoRepair() {
        debugLog('Inicializando sistema de Auto Repair');
        setupMutationObserver();
        startIntervalCheck();
        debugLog('Sistema de Auto Repair ativo');
    }

    // Interface pública do auto repair
    window.AutoRepair = {
        enable: () => {
            autoRepairEnabled = true;
            initAutoRepair();
            debugLog('Auto Repair ATIVADO');
        },

        disable: () => {
            autoRepairEnabled = false;
            if (autoRepairObserver) autoRepairObserver.disconnect();
            if (autoRepairInterval) clearInterval(autoRepairInterval);
            debugLog('Auto Repair DESATIVADO');
        },

        isEnabled: () => autoRepairEnabled,

        testModal: () => {
            const modal = detectRepairModal();
            console.log('Modal detectado:', modal);
            if (modal) {
                const button = findRepairButton(modal);
                console.log('Botão encontrado:', button);
            }
        },

        forceRepair: () => {
            debugLog('Executando reparo forçado');
            performAutoRepair();
        }
    };

    // Inicia automaticamente se habilitado
    if (autoRepairEnabled) {
        // Aguarda um pouco para garantir que a página carregou
        setTimeout(initAutoRepair, 2000);
    }

    debugLog('Sistema de Auto Repair carregado');

})();

// ========== FIM DO AUTO REPAIR SYSTEM ==========
`;
    },

    // Função principal de aplicação (versão SEGURA - final do arquivo)
    async apply(content) {
        console.log('[auto-repair] Aplicando sistema de Auto Repair...');

        // Verifica se já foi aplicado
        if (content.includes('AUTO REPAIR SYSTEM - INJECTED BY PATCH')) {
            console.log('[auto-repair] Sistema já foi aplicado anteriormente');
            return content;
        }

        // Gera o código do auto repair
        const autoRepairCode = this.getAutoRepairCode();

        // INJEÇÃO SEGURA: Sempre adiciona no final do arquivo
        // Remove espaços em branco do final
        const trimmedContent = content.replace(/\s+$/, '');

        // Adiciona o código no final com separação adequada
        const finalContent = trimmedContent + '\n\n' + autoRepairCode + '\n';

        console.log('[auto-repair] Sistema de Auto Repair injetado com sucesso!');
        console.log('[auto-repair] Local: Final do arquivo (100% seguro)');
        console.log('[auto-repair] Use AutoRepair.enable() para ativar');
        console.log('[auto-repair] Use AutoRepair.disable() para desativar');
        console.log('[auto-repair] CORREÇÃO: Sistema de injeção segura implementado');

        return finalContent;
    },

    // Função de remoção
    async remove(content) {
        console.log('[auto-repair] Removendo sistema de Auto Repair...');

        const startMarker = '// ========== AUTO REPAIR SYSTEM - INJECTED BY PATCH ==========';
        const endMarker = '// ========== FIM DO AUTO REPAIR SYSTEM ==========';

        const startIndex = content.indexOf(startMarker);
        const endIndex = content.indexOf(endMarker);

        if (startIndex === -1 || endIndex === -1) {
            console.log('[auto-repair] Sistema não encontrado para remoção');
            return content;
        }

        // Remove o bloco completo
        const before = content.substring(0, startIndex);
        const after = content.substring(endIndex + endMarker.length);

        console.log('[auto-repair] Sistema removido com sucesso');
        return before + after;
    },

    // Configurações
    setEnabled(enabled) {
        this.config.enabled = enabled;
    },

    setCheckInterval(interval) {
        if (interval < 100 || interval > 10000) {
            throw new Error('Intervalo deve ser entre 100ms e 10000ms');
        }
        this.config.checkInterval = interval;
    },

    setClickDelay(delay) {
        if (delay < 0 || delay > 5000) {
            throw new Error('Delay deve ser entre 0ms e 5000ms');
        }
        this.config.clickDelay = delay;
    },

    setDebug(debug) {
        this.config.debug = debug;
    },

    // Status atual
    getStatus() {
        return {
            enabled: this.config.enabled,
            checkInterval: this.config.checkInterval,
            clickDelay: this.config.clickDelay,
            debug: this.config.debug,
            type: 'auto-repair'
        };
    }
};