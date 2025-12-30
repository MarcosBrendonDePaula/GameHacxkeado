#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Auto Pause System
Sistema para pausar auto pesca quando vara quebrar e reativar automaticamente
com delay aleatório para simular comportamento humano

Funcionalidades:
- Detecta quando vara quebra (durabilidade = 0)
- Para auto pesca automaticamente
- Aguarda tempo aleatório (1-5 minutos)
- Reativa auto pesca automaticamente
- Log de atividades para análise
"""

import re
import os
import json
import argparse
from typing import Dict, List, Any


class AutoPauseSystemGenerator:
    """Gera código para sistema de auto-pausa"""

    def __init__(self, source_file: str = "source.js"):
        self.source_file = source_file
        self.source_code = ""
        self.injection_points = {}

    def load_source_code(self) -> bool:
        """Carrega código fonte"""
        try:
            if not os.path.exists(self.source_file):
                print(f"ERRO: Arquivo {self.source_file} não encontrado!")
                return False

            with open(self.source_file, 'r', encoding='utf-8', errors='ignore') as f:
                self.source_code = f.read()

            print(f"Código carregado: {len(self.source_code):,} caracteres")
            return True

        except Exception as e:
            print(f"ERRO: {e}")
            return False

    def find_injection_points(self) -> Dict[str, Dict[str, Any]]:
        """Encontra pontos para injetar o sistema de auto-pausa"""
        patterns = {
            # Onde verifica se pode fazer cast (durability check)
            "durability_check": r"calculateExpectedDurability\(.*dr\.maxDurability.*\)\s*<=\s*0",

            # Onde para o auto cast
            "stop_autocast": r"dt\(!1\).*ct\s*&&.*mt\(!1\)",

            # Onde inicia o auto cast
            "start_autocast": r"mt\(!0\)",

            # Onde está o setInterval do auto cast
            "autocast_interval": r"setInterval\(\(\)\s*=>\s*\{.*toggleTileFished.*\},\s*\d+\)",

            # Onde está a verificação de durabilidade
            "durability_zero_check": r"dr\.currentDurability.*<=\s*0",
        }

        injection_points = {}

        for point_name, pattern in patterns.items():
            matches = list(re.finditer(pattern, self.source_code, re.MULTILINE | re.DOTALL))

            if matches:
                for i, match in enumerate(matches):
                    line_number = self.source_code[:match.start()].count('\n') + 1
                    context = self._get_context_lines(line_number, 3)

                    key = f"{point_name}_{i+1}" if len(matches) > 1 else point_name

                    injection_points[key] = {
                        "line": line_number,
                        "pattern": pattern,
                        "match": self._clean_text(match.group(0)),
                        "context": context,
                        "injection_strategy": self._get_injection_strategy(point_name)
                    }

                    print(f"[OK] {point_name}: Linha {line_number}")

        self.injection_points = injection_points
        return injection_points

    def _get_context_lines(self, line_number: int, context_size: int = 3) -> List[str]:
        """Obtém contexto das linhas"""
        lines = self.source_code.split('\n')
        start = max(0, line_number - context_size - 1)
        end = min(len(lines), line_number + context_size)

        context = []
        for i in range(start, end):
            prefix = ">>>" if i == line_number - 1 else "   "
            line_content = lines[i][:100] if len(lines[i]) > 100 else lines[i]
            context.append(f"{prefix} {i + 1:4d}: {line_content}")

        return context

    def _clean_text(self, text: str) -> str:
        """Limpa texto removendo caracteres problemáticos"""
        if not text:
            return ""
        cleaned = ''.join(c for c in text if ord(c) < 127 or c.isspace())
        return cleaned[:100].replace('\n', ' ').strip()

    def _get_injection_strategy(self, point_name: str) -> str:
        """Define estratégia de injeção para cada ponto"""
        strategies = {
            "durability_check": "SUBSTITUIR - modificar condição para incluir sistema de pausa",
            "stop_autocast": "APÓS - adicionar lógica de pausa com timer",
            "start_autocast": "ANTES - verificar se não está em pausa forçada",
            "autocast_interval": "WRAPPER - envolver setInterval com controle de pausa",
            "durability_zero_check": "APÓS - triggerar sistema de auto-pausa"
        }
        return strategies.get(point_name, "GENÉRICO")

    def generate_auto_pause_code(self) -> str:
        """Gera código completo do sistema de auto-pausa"""
        code = '''
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
'''

        return code

    def generate_injection_guide(self) -> str:
        """Gera guia de como injetar o código"""
        guide = f"""
=== GUIA DE INJEÇÃO DO SISTEMA AUTO-PAUSE ===

PONTOS DE INJEÇÃO ENCONTRADOS:
{'-'*50}
"""

        for point_name, point_data in self.injection_points.items():
            guide += f"""
{point_name.upper()}:
- Linha: {point_data['line']}
- Estratégia: {point_data['injection_strategy']}
- Contexto: {point_data['match'][:60]}...

"""

        guide += f"""
MÉTODOS DE INJEÇÃO:
{'-'*50}

MÉTODO 1 - INJEÇÃO DIRETA (Mais simples):
1. Abrir source.js no editor
2. Procurar pela linha ~{self.injection_points.get('durability_zero_check_1', {}).get('line', '230800')}
3. Colar o código do sistema ANTES da verificação de durabilidade
4. Salvar arquivo

MÉTODO 2 - CONSOLE DO BROWSER (Temporário):
1. Abrir DevTools (F12)
2. Ir para aba Console
3. Colar o código completo
4. Pressionar Enter
5. Sistema fica ativo apenas nesta sessão

MÉTODO 3 - USERSCRIPT (Recomendado):
1. Instalar Tampermonkey ou Greasemonkey
2. Criar novo script
3. Adicionar o código
4. Configurar para rodar no domínio do jogo

MÉTODO 4 - BOOKMARK (Portável):
1. Criar novo bookmark
2. URL: javascript:(código minificado)
3. Clicar no bookmark para ativar

FUNCIONALIDADES DO SISTEMA:
{'-'*50}

✅ AUTOMÁTICO:
- Detecta quando vara quebra (durabilidade = 0)
- Para auto pesca automaticamente
- Aguarda delay aleatório (1-5 minutos)
- Reativa auto pesca sozinho
- Logs detalhados de todas as ações

⚙️ CONFIGURÁVEL:
- AutoPauseSystem.setDelayRange(60000, 300000) // 1-5 min
- AutoPauseSystem.enable() / disable()
- AutoPauseSystem.pauseNow() / resumeNow()

📊 MONITORAMENTO:
- AutoPauseSystem.getStatus() // Status atual
- AutoPauseSystem.getStats() // Estatísticas
- AutoPauseSystem.showLogs() // Últimos 20 logs

🔧 DETECÇÃO:
- MutationObserver para detecção rápida
- Verifica a cada 5 segundos
- Múltiplos métodos de detecção (texto, cores, elementos)

EXEMPLO DE USO:
{'-'*50}

// Configurar delay de 2-4 minutos
AutoPauseSystem.setDelayRange(120000, 240000);

// Ver status
AutoPauseSystem.getStatus();

// Pausar manualmente
AutoPauseSystem.pauseNow('Teste manual');

// Ver estatísticas
AutoPauseSystem.getStats();

COMPORTAMENTO ESPERADO:
{'-'*50}

1. Jogador está pescando com auto cast ativo
2. Vara quebra (durabilidade = 0)
3. Sistema detecta automaticamente
4. Para o auto cast
5. Log: "Pausando auto pesca: Vara quebrada"
6. Aguarda delay aleatório (ex: 2m 34s)
7. Log: "Retomando auto pesca após 154s"
8. Reativa auto cast automaticamente
9. Salva estatísticas da sessão

VANTAGENS:
{'-'*50}

✅ Simula comportamento humano (delays aleatórios)
✅ Evita detecção de bot (pausas naturais)
✅ Totalmente automático (sem intervenção)
✅ Logs detalhados para análise
✅ Configurável via console
✅ Funciona com qualquer versão do jogo
"""

        return guide

    def save_results(self, output_file: str = "auto_pause_system.js") -> bool:
        """Salva sistema completo"""
        try:
            # Código do sistema
            auto_pause_code = self.generate_auto_pause_code()

            # Guia de instalação
            installation_guide = self.generate_injection_guide()

            # Salvar código
            code_path = os.path.join(os.path.dirname(__file__), output_file)
            with open(code_path, 'w', encoding='utf-8') as f:
                f.write(auto_pause_code)

            # Salvar guia
            guide_path = code_path.replace('.js', '_guide.txt')
            with open(guide_path, 'w', encoding='utf-8') as f:
                f.write(installation_guide)

            # Salvar dados de injeção
            data_path = code_path.replace('.js', '_data.json')
            with open(data_path, 'w', encoding='utf-8') as f:
                json.dump({
                    "injection_points": self.injection_points,
                    "recommendations": {
                        "primary_injection_line": list(self.injection_points.values())[0]["line"] if self.injection_points else None,
                        "method": "Injeção direta no source.js",
                        "timing": "Antes da verificação de durabilidade"
                    }
                }, f, indent=2, ensure_ascii=False)

            print(f"[OK] Sistema salvo em: {code_path}")
            print(f"[OK] Guia salvo em: {guide_path}")
            print(f"[OK] Dados salvos em: {data_path}")
            return True

        except Exception as e:
            print(f"ERRO ao salvar: {e}")
            return False


def main():
    """Função principal"""
    parser = argparse.ArgumentParser(description="Auto Pause System Generator")
    parser.add_argument("--file", "-f", default="source.js", help="Arquivo source.js")
    parser.add_argument("--output", "-o", default="auto_pause_system.js", help="Arquivo de saída")

    args = parser.parse_args()

    print("Auto Pause System Generator v1.0")
    print("=" * 50)
    print("Sistema para pausar auto pesca quando vara quebra")
    print("e reativar automaticamente com delay aleatório")
    print()

    # Determinar caminho do arquivo
    if not os.path.isabs(args.file):
        current_dir = os.path.dirname(os.path.abspath(__file__))
        project_root = os.path.join(current_dir, "..", "..")
        source_path = os.path.join(project_root, args.file)

        if os.path.exists(source_path):
            args.file = source_path

    # Criar gerador
    generator = AutoPauseSystemGenerator(args.file)

    # Carregar código
    if not generator.load_source_code():
        return 1

    # Encontrar pontos de injeção
    injection_points = generator.find_injection_points()

    print(f"\n[OK] {len(injection_points)} pontos de injecao encontrados")

    # Salvar sistema completo
    if generator.save_results(args.output):
        print(f"\n[SUCESSO] Sistema Auto-Pause gerado com sucesso!")
        print(f"[INFO] Consulte o arquivo _guide.txt para instrucoes de instalacao")
    else:
        print("[ERRO] Erro ao gerar sistema")
        return 1

    return 0


if __name__ == "__main__":
    exit(main())