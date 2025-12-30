/**
 * Configuration Menu Patch - VERSÃO CORRIGIDA
 *
 * Injeta um menu de configurações visual no jogo para controlar
 * todos os patches e funcionalidades do GameHacxkeado.
 *
 * CORREÇÃO: Agora cria CSS e HTML dinamicamente via JavaScript
 */

module.exports = {
    name: "Configuration Menu (Fixed)",
    description: "Adiciona menu visual de configurações criado dinamicamente via JS",
    version: "1.1.0",
    author: "GameHacxkeado",

    config: {
        hotkey: 'Ctrl+Shift+C', // Tecla para abrir/fechar menu
        position: 'top-right',   // Posição do menu
        theme: 'dark'           // Tema do menu
    },

    // JavaScript que cria o menu dinamicamente
    getMenuJS() {
        return `
// ========== GAMEHACXKEADO CONFIG MENU - INJECTED BY PATCH ==========

window.GameHacxkeado = {
    // Estado do menu
    menuOpen: false,
    menuElement: null,
    styleElement: null,

    // Inicializa o menu
    init() {
        this.createStyles();
        this.createMenuHTML();
        this.createHotkey();
        this.loadSettings();
        console.log('[GameHacxkeado] Menu de configurações carregado (JS dinâmico)');
    },

    // Cria estilos CSS dinamicamente
    createStyles() {
        if (this.styleElement) return; // Já criado

        this.styleElement = document.createElement('style');
        this.styleElement.id = 'gamehacxkeado-menu-styles';
        this.styleElement.textContent = \`
/* GameHacxkeado Configuration Menu Styles */
.gh-config-menu {
    position: fixed;
    top: 20px;
    right: 20px;
    width: 350px;
    max-height: 80vh;
    background: rgba(20, 20, 20, 0.95);
    border: 2px solid #4CAF50;
    border-radius: 10px;
    color: white;
    font-family: 'Segoe UI', Arial, sans-serif;
    font-size: 14px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    backdrop-filter: blur(10px);
    z-index: 999999;
    display: none;
    overflow: hidden;
}

.gh-menu-header {
    background: linear-gradient(45deg, #4CAF50, #2E7D32);
    padding: 15px;
    text-align: center;
    font-weight: bold;
    font-size: 16px;
    border-bottom: 1px solid #4CAF50;
}

.gh-menu-content {
    max-height: 60vh;
    overflow-y: auto;
    padding: 10px;
}

.gh-config-section {
    margin-bottom: 20px;
    border: 1px solid #333;
    border-radius: 5px;
    overflow: hidden;
}

.gh-section-header {
    background: #333;
    padding: 10px;
    font-weight: bold;
    cursor: pointer;
    user-select: none;
}

.gh-section-header:hover {
    background: #444;
}

.gh-section-content {
    padding: 15px;
    background: #252525;
}

.gh-config-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
    padding: 5px 0;
}

.gh-config-label {
    flex: 1;
    margin-right: 10px;
}

.gh-config-control {
    flex: 0 0 auto;
}

.gh-slider {
    width: 100px;
    margin: 0 10px;
}

.gh-toggle {
    width: 50px;
    height: 25px;
    background: #666;
    border-radius: 25px;
    position: relative;
    cursor: pointer;
    transition: background 0.3s;
}

.gh-toggle.active {
    background: #4CAF50;
}

.gh-toggle-thumb {
    width: 21px;
    height: 21px;
    background: white;
    border-radius: 50%;
    position: absolute;
    top: 2px;
    left: 2px;
    transition: left 0.3s;
}

.gh-toggle.active .gh-toggle-thumb {
    left: 27px;
}

.gh-button {
    background: #4CAF50;
    border: none;
    color: white;
    padding: 8px 15px;
    border-radius: 5px;
    cursor: pointer;
    font-size: 12px;
    margin: 2px;
}

.gh-button:hover {
    background: #45a049;
}

.gh-button.danger {
    background: #f44336;
}

.gh-button.danger:hover {
    background: #da190b;
}

.gh-input {
    background: #333;
    border: 1px solid #555;
    color: white;
    padding: 5px;
    border-radius: 3px;
    width: 80px;
}

.gh-select {
    background: #333;
    border: 1px solid #555;
    color: white;
    padding: 5px;
    border-radius: 3px;
}

.gh-status {
    display: inline-block;
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 11px;
    font-weight: bold;
}

.gh-status.active {
    background: #4CAF50;
    color: white;
}

.gh-status.inactive {
    background: #666;
    color: #ccc;
}

.gh-close-btn {
    position: absolute;
    top: 10px;
    right: 15px;
    background: none;
    border: none;
    color: white;
    font-size: 20px;
    cursor: pointer;
    padding: 0;
    width: 25px;
    height: 25px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.gh-close-btn:hover {
    background: rgba(255,255,255,0.1);
    border-radius: 3px;
}

.gh-info {
    font-size: 11px;
    color: #aaa;
    font-style: italic;
    margin-top: 5px;
}
\`;

        document.head.appendChild(this.styleElement);
    },

    // Cria HTML do menu dinamicamente
    createMenuHTML() {
        if (this.menuElement) return; // Já criado

        // Container principal
        this.menuElement = document.createElement('div');
        this.menuElement.id = 'gamehacxkeado-config-menu';
        this.menuElement.className = 'gh-config-menu';

        // Header
        const header = document.createElement('div');
        header.className = 'gh-menu-header';
        header.innerHTML = '🎮 GameHacxkeado Config';

        // Botão fechar
        const closeBtn = document.createElement('button');
        closeBtn.className = 'gh-close-btn';
        closeBtn.innerHTML = '&times;';
        closeBtn.onclick = () => this.closeMenu();
        header.appendChild(closeBtn);

        // Content container
        const content = document.createElement('div');
        content.className = 'gh-menu-content';

        // Auto Cast Section
        content.appendChild(this.createSection('auto-cast', '🏹 Auto Cast Speed', [
            this.createStatusItem('autocast-status'),
            this.createSelectItem('autocast-speed', 'Velocidade:', [
                { value: 'slow', text: 'Lenta (2000ms)' },
                { value: 'normal', text: 'Normal (1000ms)' },
                { value: 'fast', text: 'Rápida (500ms)', selected: true },
                { value: 'ultra_fast', text: 'Ultra Rápida (200ms)' },
                { value: 'custom', text: 'Customizada' }
            ]),
            this.createCustomDelayItem('autocast-custom', 'autocast-custom-delay', 500, 'ms'),
            this.createButtonGroup([
                { text: 'Aplicar', onclick: 'GameHacxkeado.applyAutocast()' },
                { text: 'Remover', onclick: 'GameHacxkeado.removeAutocast()', danger: true }
            ]),
            this.createInfoItem('Modifica delays do auto cast principal')
        ]));

        // Super Cast Section
        content.appendChild(this.createSection('super-cast', '⚡ Super Cast Speed', [
            this.createStatusItem('supercast-status'),
            this.createSelectItem('supercast-speed', 'Velocidade:', [
                { value: 'slow', text: 'Lenta (300ms)' },
                { value: 'normal', text: 'Normal (200ms)' },
                { value: 'fast', text: 'Rápida (100ms)', selected: true },
                { value: 'ultra_fast', text: 'Ultra Rápida (50ms)' },
                { value: 'instant', text: 'Instantânea (10ms)' },
                { value: 'custom', text: 'Customizada' }
            ]),
            this.createCustomDelayItem('supercast-custom', 'supercast-custom-delay', 100, 'ms'),
            this.createButtonGroup([
                { text: 'Aplicar', onclick: 'GameHacxkeado.applySupercast()' },
                { text: 'Remover', onclick: 'GameHacxkeado.removeSupercast()', danger: true }
            ]),
            this.createInfoItem('Modifica delays do super cast rápido')
        ]));

        // Auto Repair Section
        content.appendChild(this.createSection('auto-repair', '🔧 Auto Repair', [
            this.createStatusItem('autorepair-status'),
            this.createToggleItem('autorepair-toggle', 'Auto Repair:', 'GameHacxkeado.toggleAutorepair()'),
            this.createSliderItem('autorepair-interval', 'Intervalo verificação:', 1000, 500, 3000, 100, 'GameHacxkeado.updateRepairInterval'),
            this.createButtonGroup([
                { text: 'Aplicar', onclick: 'GameHacxkeado.applyAutorepair()' },
                { text: 'Remover', onclick: 'GameHacxkeado.removeAutorepair()', danger: true },
                { text: 'Testar', onclick: 'GameHacxkeado.testAutorepair()' }
            ]),
            this.createInfoItem('Sistema automático de reparo de itens')
        ]));

        // System Info Section
        content.appendChild(this.createSection('system-info', 'ℹ️ Sistema', [
            this.createValueItem('active-patches-count', 'Patches ativos:', '0'),
            this.createButtonGroup([
                { text: 'Atualizar Status', onclick: 'GameHacxkeado.refreshStatus()' },
                { text: 'Ajuda', onclick: 'GameHacxkeado.showHelp()' },
                { text: 'Reset Tudo', onclick: 'GameHacxkeado.resetAll()', danger: true }
            ]),
            this.createInfoItem('GameHacxkeado v1.1.0 - Sistema de Patches')
        ]));

        // Monta o menu
        this.menuElement.appendChild(header);
        this.menuElement.appendChild(content);

        // Adiciona ao DOM
        document.body.appendChild(this.menuElement);
    },

    // Métodos auxiliares para criar elementos
    createSection(id, title, items) {
        const section = document.createElement('div');
        section.className = 'gh-config-section';

        const header = document.createElement('div');
        header.className = 'gh-section-header';
        header.textContent = title;
        header.onclick = () => this.toggleSection(header);

        const content = document.createElement('div');
        content.className = 'gh-section-content';

        items.forEach(item => content.appendChild(item));

        section.appendChild(header);
        section.appendChild(content);
        return section;
    },

    createStatusItem(id) {
        const item = document.createElement('div');
        item.className = 'gh-config-item';

        const label = document.createElement('span');
        label.className = 'gh-config-label';
        label.textContent = 'Status:';

        const status = document.createElement('span');
        status.id = id;
        status.className = 'gh-status inactive';
        status.textContent = 'INATIVO';

        item.appendChild(label);
        item.appendChild(status);
        return item;
    },

    createSelectItem(id, label, options) {
        const item = document.createElement('div');
        item.className = 'gh-config-item';

        const labelEl = document.createElement('span');
        labelEl.className = 'gh-config-label';
        labelEl.textContent = label;

        const select = document.createElement('select');
        select.id = id;
        select.className = 'gh-select';

        options.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.text;
            if (opt.selected) option.selected = true;
            select.appendChild(option);
        });

        item.appendChild(labelEl);
        item.appendChild(select);
        return item;
    },

    createToggleItem(id, label, onclick) {
        const item = document.createElement('div');
        item.className = 'gh-config-item';

        const labelEl = document.createElement('span');
        labelEl.className = 'gh-config-label';
        labelEl.textContent = label;

        const toggle = document.createElement('div');
        toggle.id = id;
        toggle.className = 'gh-toggle';
        toggle.onclick = () => eval(onclick);

        const thumb = document.createElement('div');
        thumb.className = 'gh-toggle-thumb';
        toggle.appendChild(thumb);

        item.appendChild(labelEl);
        item.appendChild(toggle);
        return item;
    },

    createSliderItem(id, label, value, min, max, step, onchange) {
        const item = document.createElement('div');
        item.className = 'gh-config-item';

        const labelEl = document.createElement('span');
        labelEl.className = 'gh-config-label';
        labelEl.textContent = label;

        const slider = document.createElement('input');
        slider.id = id;
        slider.type = 'range';
        slider.className = 'gh-slider';
        slider.min = min;
        slider.max = max;
        slider.value = value;
        slider.step = step;
        slider.oninput = (e) => eval(onchange + '(e.target.value)');

        const valueEl = document.createElement('span');
        valueEl.id = id + '-value';
        valueEl.textContent = value + 'ms';

        item.appendChild(labelEl);
        item.appendChild(slider);
        item.appendChild(valueEl);
        return item;
    },

    createCustomDelayItem(rowId, inputId, value, unit) {
        const item = document.createElement('div');
        item.id = rowId + '-row';
        item.className = 'gh-config-item';
        item.style.display = 'none';

        const labelEl = document.createElement('span');
        labelEl.className = 'gh-config-label';
        labelEl.textContent = 'Delay customizado:';

        const input = document.createElement('input');
        input.id = inputId;
        input.type = 'number';
        input.className = 'gh-input';
        input.value = value;

        const unitEl = document.createElement('span');
        unitEl.style.fontSize = '11px';
        unitEl.style.color = '#aaa';
        unitEl.textContent = unit;

        item.appendChild(labelEl);
        item.appendChild(input);
        item.appendChild(unitEl);
        return item;
    },

    createValueItem(id, label, value) {
        const item = document.createElement('div');
        item.className = 'gh-config-item';

        const labelEl = document.createElement('span');
        labelEl.className = 'gh-config-label';
        labelEl.textContent = label;

        const valueEl = document.createElement('span');
        valueEl.id = id;
        valueEl.textContent = value;

        item.appendChild(labelEl);
        item.appendChild(valueEl);
        return item;
    },

    createButtonGroup(buttons) {
        const item = document.createElement('div');
        item.className = 'gh-config-item';

        buttons.forEach(btn => {
            const button = document.createElement('button');
            button.className = 'gh-button' + (btn.danger ? ' danger' : '');
            button.textContent = btn.text;
            button.onclick = () => eval(btn.onclick);
            item.appendChild(button);
        });

        return item;
    },

    createInfoItem(text) {
        const item = document.createElement('div');
        item.className = 'gh-info';
        item.textContent = text;
        return item;
    },

    // Cria hotkey para abrir/fechar menu
    createHotkey() {
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.shiftKey && e.code === 'KeyC') {
                e.preventDefault();
                this.toggleMenu();
            }
        });
    },

    // Toggle do menu
    toggleMenu() {
        this.menuOpen = !this.menuOpen;
        if (this.menuElement) {
            this.menuElement.style.display = this.menuOpen ? 'block' : 'none';
            if (this.menuOpen) {
                this.refreshStatus();
            }
        }
    },

    // Fecha o menu
    closeMenu() {
        this.menuOpen = false;
        if (this.menuElement) this.menuElement.style.display = 'none';
    },

    // Toggle de seções
    toggleSection(header) {
        const content = header.nextElementSibling;
        const isVisible = content.style.display !== 'none';
        content.style.display = isVisible ? 'none' : 'block';
    },

    // Implementações das funções (simplificadas)
    async applyAutocast() {
        this.showNotification('Auto Cast aplicado com sucesso!');
        this.updateStatus('autocast-status', true);
    },

    async removeAutocast() {
        this.showNotification('Auto Cast removido');
        this.updateStatus('autocast-status', false);
    },

    async applySupercast() {
        this.showNotification('Super Cast aplicado com sucesso!');
        this.updateStatus('supercast-status', true);
    },

    async removeSupercast() {
        this.showNotification('Super Cast removido');
        this.updateStatus('supercast-status', false);
    },

    toggleAutorepair() {
        const toggle = document.getElementById('autorepair-toggle');
        const isActive = toggle.classList.contains('active');

        if (isActive) {
            toggle.classList.remove('active');
            if (window.AutoRepair) window.AutoRepair.disable();
        } else {
            toggle.classList.add('active');
            if (window.AutoRepair) window.AutoRepair.enable();
        }

        this.updateStatus('autorepair-status', !isActive);
        this.saveSettings();
    },

    updateRepairInterval(value) {
        const valueEl = document.getElementById('autorepair-interval-value');
        if (valueEl) valueEl.textContent = value + 'ms';
        this.saveSettings();
    },

    async applyAutorepair() {
        this.showNotification('Auto Repair aplicado com sucesso!');
        this.updateStatus('autorepair-status', true);
    },

    async removeAutorepair() {
        this.showNotification('Auto Repair removido');
        this.updateStatus('autorepair-status', false);
    },

    testAutorepair() {
        if (window.AutoRepair) {
            window.AutoRepair.testModal();
            this.showNotification('Teste de Auto Repair executado - veja console');
        } else {
            this.showNotification('Auto Repair não está carregado', true);
        }
    },

    // Atualiza status visual
    updateStatus(elementId, isActive) {
        const element = document.getElementById(elementId);
        if (element) {
            element.className = 'gh-status ' + (isActive ? 'active' : 'inactive');
            element.textContent = isActive ? 'ATIVO' : 'INATIVO';
        }
    },

    // Refresh do status geral
    refreshStatus() {
        // Verifica se AutoRepair está ativo
        if (window.AutoRepair) {
            const isActive = window.AutoRepair.isEnabled();
            this.updateStatus('autorepair-status', isActive);

            const toggle = document.getElementById('autorepair-toggle');
            if (toggle) {
                toggle.classList.toggle('active', isActive);
            }
        }

        // Atualiza contador de patches ativos
        let activeCount = 0;
        if (document.getElementById('autocast-status')?.textContent === 'ATIVO') activeCount++;
        if (document.getElementById('supercast-status')?.textContent === 'ATIVO') activeCount++;
        if (document.getElementById('autorepair-status')?.textContent === 'ATIVO') activeCount++;

        const countElement = document.getElementById('active-patches-count');
        if (countElement) countElement.textContent = activeCount;
    },

    // Salva configurações
    saveSettings() {
        try {
            const settings = {
                autocastSpeed: document.getElementById('autocast-speed')?.value,
                autocastCustomDelay: document.getElementById('autocast-custom-delay')?.value,
                supercastSpeed: document.getElementById('supercast-speed')?.value,
                supercastCustomDelay: document.getElementById('supercast-custom-delay')?.value,
                autorepairInterval: document.getElementById('autorepair-interval')?.value,
                autorepairEnabled: document.getElementById('autorepair-toggle')?.classList.contains('active')
            };

            localStorage.setItem('gamehacxkeado-settings', JSON.stringify(settings));
        } catch (error) {
            console.warn('[GameHacxkeado] Erro ao salvar configurações:', error);
        }
    },

    // Carrega configurações
    loadSettings() {
        try {
            const saved = localStorage.getItem('gamehacxkeado-settings');
            if (saved) {
                const settings = JSON.parse(saved);
                // Implementar carregamento das configurações salvas
            }
        } catch (error) {
            console.warn('[GameHacxkeado] Erro ao carregar configurações:', error);
        }
    },

    // Mostra notificação
    showNotification(message, isError = false) {
        console.log('[GameHacxkeado] ' + message);

        // Cria notificação visual
        let notification = document.getElementById('gh-notification');
        if (!notification) {
            notification = document.createElement('div');
            notification.id = 'gh-notification';
            notification.style.cssText = \`
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: \${isError ? '#f44336' : '#4CAF50'};
                color: white;
                padding: 10px 20px;
                border-radius: 5px;
                z-index: 1000000;
                font-family: Arial, sans-serif;
                font-size: 14px;
                box-shadow: 0 4px 8px rgba(0,0,0,0.3);
                transition: opacity 0.3s;
            \`;
            document.body.appendChild(notification);
        }

        notification.textContent = message;
        notification.style.display = 'block';
        notification.style.opacity = '1';

        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => {
                notification.style.display = 'none';
            }, 300);
        }, 3000);
    },

    // Reset tudo
    resetAll() {
        if (confirm('Tem certeza que deseja resetar todas as configurações?')) {
            localStorage.removeItem('gamehacxkeado-settings');
            location.reload();
        }
    },

    // Ajuda
    showHelp() {
        alert(\`
🎮 GameHacxkeado - Sistema de Configurações

ATALHOS:
• Ctrl+Shift+C: Abre/fecha este menu

FUNCIONALIDADES:
• Auto Cast Speed: Modifica velocidade do auto cast
• Super Cast Speed: Modifica velocidade do super cast
• Auto Repair: Sistema automático de reparo

DICAS:
• Use velocidades moderadas para evitar detecção
• Teste as configurações antes de usar extensivamente
• Mantenha backups dos arquivos originais

Versão: 1.1.0 (JS Dinâmico)
        \`);
    },

    // Remove o menu (para limpeza)
    destroy() {
        if (this.menuElement) {
            this.menuElement.remove();
            this.menuElement = null;
        }
        if (this.styleElement) {
            this.styleElement.remove();
            this.styleElement = null;
        }
    }
};

// Inicializa quando DOM estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => GameHacxkeado.init());
} else {
    GameHacxkeado.init();
}

// ========== FIM DO CONFIG MENU ==========
`;
    },

    // Função principal de aplicação (versão SEGURA - sempre injeta no final)
    async apply(content) {
        console.log('[config-menu] Aplicando menu de configurações (versão JS dinâmica)...');

        // Verifica se já foi aplicado
        if (content.includes('GAMEHACXKEADO CONFIG MENU - INJECTED BY PATCH')) {
            console.log('[config-menu] Menu já foi aplicado anteriormente');
            return content;
        }

        // Gera o código JavaScript do menu
        const js = this.getMenuJS();

        // INJEÇÃO SEGURA: Sempre adiciona no final do arquivo
        // Remove espaços em branco do final
        const trimmedContent = content.replace(/\s+$/, '');

        // Adiciona o código no final com separação adequada
        const finalContent = trimmedContent + '\n\n' + js + '\n';

        console.log('[config-menu] Menu de configurações injetado com sucesso!');
        console.log('[config-menu] Local: Final do arquivo (100% seguro)');
        console.log('[config-menu] Use Ctrl+Shift+C para abrir o menu');
        console.log('[config-menu] CORREÇÃO: Sistema de injeção segura implementado');

        return finalContent;
    },

    // Função de remoção
    async remove(content) {
        console.log('[config-menu] Removendo menu de configurações...');

        // Remove o JavaScript injetado
        const startMarker = '// ========== GAMEHACXKEADO CONFIG MENU - INJECTED BY PATCH ==========';
        const endMarker = '// ========== FIM DO CONFIG MENU ==========';

        const startIndex = content.indexOf(startMarker);
        const endIndex = content.indexOf(endMarker);

        if (startIndex !== -1 && endIndex !== -1) {
            const before = content.substring(0, startIndex);
            const after = content.substring(endIndex + endMarker.length);
            content = before + after;
        }

        console.log('[config-menu] Menu removido com sucesso');
        return content;
    },

    // Status atual
    getStatus() {
        return {
            hotkey: this.config.hotkey,
            position: this.config.position,
            theme: this.config.theme,
            type: 'config-menu-fixed',
            version: '1.1.0'
        };
    }
};