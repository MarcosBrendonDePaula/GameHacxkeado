
// ===== SISTEMA DE AUTO-PAUSA DA AUTO PESCA =====
// Versão: 1.0
// Função: Para auto pesca quando vara quebra e reativa automaticamente

(function() {
    'use strict';

    // Configurações do sistema
    const AUTO_PAUSE_CONFIG = {
        minDelayMs: 60000,        // 1 minuto mínimo
        maxDelayMs: 300000,       // 5 minutos máximo
        enabled: true,            // Sistema ativo
        debug: true,              // Logs detalhados
        randomFactor: 0.3         // Variação adicional (30%)
    };

    // Estado do sistema
    let autoPauseState = {
        isPaused: false,
        pauseStartTime: null,
        resumeTimer: null,
        lastDurabilityCheck: 0,
        pauseCount: 0,
        totalPauseTime: 0
    };

    // Logs para análise
    const pauseLog = {
        sessions: [],
        stats: {
            totalPauses: 0,
            averagePauseTime: 0,
            lastSession: null
        }
    };

    // Função para log com timestamp
    function logAutoPause(message, level = 'info') {
        const timestamp = new Date().toISOString();
        const logMessage = `[AUTO-PAUSE ${timestamp}] ${message}`;

        if (AUTO_PAUSE_CONFIG.debug) {
            console.log(logMessage);
        }

        // Salvar log no localStorage para análise
        const logs = JSON.parse(localStorage.getItem('autoPauseLogs') || '[]');
        logs.push({ timestamp, message, level });

        // Manter apenas últimos 100 logs
        if (logs.length > 100) logs.splice(0, logs.length - 100);
        localStorage.setItem('autoPauseLogs', JSON.stringify(logs));
    }

    // Gerar delay aleatório com distribuição natural
    function generateRandomDelay() {
        const base = AUTO_PAUSE_CONFIG.minDelayMs +
                    Math.random() * (AUTO_PAUSE_CONFIG.maxDelayMs - AUTO_PAUSE_CONFIG.minDelayMs);

        // Adicionar variação extra para parecer mais humano
        const variation = base * AUTO_PAUSE_CONFIG.randomFactor * (Math.random() - 0.5);
        const finalDelay = Math.max(AUTO_PAUSE_CONFIG.minDelayMs, base + variation);

        return Math.floor(finalDelay);
    }

    // Função para pausar auto pesca
    function pauseAutoFishing(reason = 'Vara quebrada') {
        if (autoPauseState.isPaused) {
            logAutoPause('Sistema já está pausado', 'warning');
            return;
        }

        logAutoPause(`Pausando auto pesca: ${reason}`, 'info');

        autoPauseState.isPaused = true;
        autoPauseState.pauseStartTime = Date.now();
        autoPauseState.pauseCount++;

        // Para auto pesca (simular clique no botão se estiver ativo)
        try {
            // Buscar botão de auto cast e clicar se estiver ativo
            const autoCastButton = document.querySelector('button[class*="game-button"][class*="active"]');
            if (autoCastButton && autoCastButton.textContent.includes('AUTO')) {
                logAutoPause('Parando auto cast via botão', 'info');
                autoCastButton.click();
            }
        } catch (error) {
            logAutoPause(`Erro ao parar auto cast: ${error}`, 'error');
        }

        // Programar retomada automática
        scheduleAutoResume();
    }

    // Função para programar retomada
    function scheduleAutoResume() {
        const delay = generateRandomDelay();
        const resumeTime = new Date(Date.now() + delay);

        logAutoPause(`Retomada programada em ${Math.round(delay/1000)}s às ${resumeTime.toLocaleTimeString()}`, 'info');

        autoPauseState.resumeTimer = setTimeout(() => {
            resumeAutoFishing();
        }, delay);
    }

    // Função para retomar auto pesca
    function resumeAutoFishing() {
        if (!autoPauseState.isPaused) {
            logAutoPause('Sistema não está pausado', 'warning');
            return;
        }

        const pauseDuration = Date.now() - autoPauseState.pauseStartTime;
        autoPauseState.totalPauseTime += pauseDuration;

        logAutoPause(`Retomando auto pesca após ${Math.round(pauseDuration/1000)}s`, 'info');

        // Registrar sessão de pausa
        pauseLog.sessions.push({
            startTime: autoPauseState.pauseStartTime,
            endTime: Date.now(),
            duration: pauseDuration,
            reason: 'Vara quebrada'
        });

        autoPauseState.isPaused = false;
        autoPauseState.pauseStartTime = null;

        if (autoPauseState.resumeTimer) {
            clearTimeout(autoPauseState.resumeTimer);
            autoPauseState.resumeTimer = null;
        }

        // Reativar auto pesca (simular clique no botão)
        try {
            // Aguardar um pouco para garantir que a interface está pronta
            setTimeout(() => {
                const autoCastButton = document.querySelector('button[class*="game-button"]:not([class*="active"])');
                if (autoCastButton && autoCastButton.textContent.includes('AUTO')) {
                    logAutoPause('Reativando auto cast via botão', 'info');
                    autoCastButton.click();
                } else {
                    logAutoPause('Botão de auto cast não encontrado ou já ativo', 'warning');
                }
            }, 2000); // Aguarda 2 segundos

        } catch (error) {
            logAutoPause(`Erro ao reativar auto cast: ${error}`, 'error');
        }

        // Atualizar estatísticas
        updateStats();
    }

    // Atualizar estatísticas
    function updateStats() {
        pauseLog.stats.totalPauses = pauseLog.sessions.length;

        if (pauseLog.sessions.length > 0) {
            const totalTime = pauseLog.sessions.reduce((sum, session) => sum + session.duration, 0);
            pauseLog.stats.averagePauseTime = totalTime / pauseLog.sessions.length;
            pauseLog.stats.lastSession = pauseLog.sessions[pauseLog.sessions.length - 1];
        }

        // Salvar estatísticas
        localStorage.setItem('autoPauseStats', JSON.stringify(pauseLog));
    }

    // Função para verificar status da vara
    function checkRodStatus() {
        if (!AUTO_PAUSE_CONFIG.enabled || autoPauseState.isPaused) {
            return;
        }

        // Buscar elemento que contém informação de durabilidade
        try {
            // Método 1: Buscar pelo texto "ROD BROKEN"
            const brokenIndicator = document.querySelector('[style*="color"][style*="#ff5252"]:contains("ROD BROKEN")');
            if (brokenIndicator) {
                logAutoPause('Vara quebrada detectada via indicador visual', 'info');
                pauseAutoFishing('Indicador visual de vara quebrada');
                return;
            }

            // Método 2: Buscar por elementos de durabilidade
            const durabilityElements = document.querySelectorAll('*');
            for (let element of durabilityElements) {
                const text = element.textContent;
                if (text && text.includes('ROD BROKEN') || text.includes('REPAIR REQUIRED')) {
                    logAutoPause('Vara quebrada detectada via texto', 'info');
                    pauseAutoFishing('Texto de reparo detectado');
                    return;
                }
            }

        } catch (error) {
            // Ignorar erros de verificação
        }
    }

    // Monitor contínuo do status da vara
    function startRodMonitoring() {
        logAutoPause('Iniciando monitoramento da vara', 'info');

        // Verificar a cada 5 segundos
        setInterval(checkRodStatus, 5000);

        // Observer para mudanças no DOM (mais responsivo)
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList' || mutation.type === 'characterData') {
                    checkRodStatus();
                }
            });
        });

        // Observar mudanças no body
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true
        });

        logAutoPause('MutationObserver ativo para detecção rápida', 'info');
    }

    // API pública para controle manual
    window.AutoPauseSystem = {
        // Status
        getStatus: () => autoPauseState,
        getStats: () => pauseLog,
        getConfig: () => AUTO_PAUSE_CONFIG,

        // Controles
        enable: () => { AUTO_PAUSE_CONFIG.enabled = true; logAutoPause('Sistema ativado'); },
        disable: () => { AUTO_PAUSE_CONFIG.enabled = false; logAutoPause('Sistema desativado'); },

        // Ações manuais
        pauseNow: (reason) => pauseAutoFishing(reason || 'Pausa manual'),
        resumeNow: () => {
            if (autoPauseState.resumeTimer) {
                clearTimeout(autoPauseState.resumeTimer);
            }
            resumeAutoFishing();
        },

        // Configuração
        setDelayRange: (min, max) => {
            AUTO_PAUSE_CONFIG.minDelayMs = min;
            AUTO_PAUSE_CONFIG.maxDelayMs = max;
            logAutoPause(`Delay configurado: ${min}-${max}ms`);
        },

        // Logs
        showLogs: () => {
            const logs = JSON.parse(localStorage.getItem('autoPauseLogs') || '[]');
            console.table(logs.slice(-20)); // Últimos 20 logs
        },

        // Reset
        resetStats: () => {
            pauseLog.sessions = [];
            pauseLog.stats = { totalPauses: 0, averagePauseTime: 0, lastSession: null };
            localStorage.removeItem('autoPauseStats');
            localStorage.removeItem('autoPauseLogs');
            logAutoPause('Estatísticas resetadas');
        }
    };

    // Inicializar sistema
    function initialize() {
        logAutoPause('=== SISTEMA AUTO-PAUSE INICIADO ===', 'info');
        logAutoPause(`Delay: ${AUTO_PAUSE_CONFIG.minDelayMs/1000}-${AUTO_PAUSE_CONFIG.maxDelayMs/1000}s`, 'info');

        // Aguardar carregamento completo da página
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', startRodMonitoring);
        } else {
            startRodMonitoring();
        }

        // Interface no console
        console.log('%c🎣 Auto-Pause System Loaded! 🎣', 'color: #4CAF50; font-size: 16px; font-weight: bold;');
        console.log('Use AutoPauseSystem.getStatus() para ver status');
        console.log('Use AutoPauseSystem.showLogs() para ver logs');
    }

    // Inicializar quando script carrega
    initialize();

})();
