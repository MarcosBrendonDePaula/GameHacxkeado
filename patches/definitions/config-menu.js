/**
 * Config Menu Patch
 *
 * Adiciona menu visual no jogo para configurar opções dinamicamente.
 * Hotkey: Ctrl+Shift+C para abrir/fechar
 */

module.exports = {
    name: "Config Menu",
    description: "Menu visual de configurações no jogo (Ctrl+Shift+C)",
    version: "1.0.0",
    author: "GameHacxkeado",

    apply: (sourceCode) => {
        console.log('Aplicando Config Menu...');

        // Código do menu de configurações
        const menuCode = `
// ===== CONFIG MENU SYSTEM =====
(function() {
    'use strict';

    // Aguarda sistema de configuração estar disponível
    function waitForConfig(callback) {
        if (typeof window.__cfg === 'function') {
            callback();
        } else {
            setTimeout(() => waitForConfig(callback), 100);
        }
    }

    // Criar menu apenas após sistema estar pronto
    waitForConfig(() => {
        console.log('[ConfigMenu] Inicializando menu de configurações...');

        let menuVisible = false;
        let menuElement = null;

        // Estilo CSS para o menu
        const menuCSS = \`
        #gameConfigMenu {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: linear-gradient(135deg, #2c3e50 0%, #3498db 100%);
            border: 2px solid #34495e;
            border-radius: 12px;
            padding: 20px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
            z-index: 10000;
            font-family: 'Arial', sans-serif;
            color: white;
            min-width: 400px;
            max-width: 500px;
        }

        #gameConfigMenu h2 {
            margin: 0 0 20px 0;
            text-align: center;
            color: #ecf0f1;
            font-size: 24px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }

        .config-section {
            margin-bottom: 20px;
            background: rgba(255,255,255,0.1);
            padding: 15px;
            border-radius: 8px;
        }

        .config-section h3 {
            margin: 0 0 15px 0;
            color: #3498db;
            font-size: 18px;
            border-bottom: 1px solid #34495e;
            padding-bottom: 5px;
        }

        .config-item {
            margin-bottom: 15px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .config-item label {
            flex: 1;
            font-weight: bold;
            color: #ecf0f1;
        }

        .config-item input, .config-item select {
            width: 100px;
            padding: 8px;
            border: none;
            border-radius: 4px;
            background: #34495e;
            color: white;
            border: 1px solid #2c3e50;
        }

        .config-item input:focus, .config-item select:focus {
            outline: none;
            border-color: #3498db;
            box-shadow: 0 0 5px rgba(52, 152, 219, 0.5);
        }

        .config-buttons {
            display: flex;
            justify-content: space-between;
            margin-top: 20px;
            gap: 10px;
        }

        .config-button {
            flex: 1;
            padding: 12px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-weight: bold;
            transition: all 0.3s;
        }

        .config-button.primary {
            background: #27ae60;
            color: white;
        }

        .config-button.primary:hover {
            background: #2ecc71;
            transform: translateY(-1px);
        }

        .config-button.secondary {
            background: #e74c3c;
            color: white;
        }

        .config-button.secondary:hover {
            background: #c0392b;
            transform: translateY(-1px);
        }

        .config-button.info {
            background: #f39c12;
            color: white;
        }

        .config-button.info:hover {
            background: #e67e22;
            transform: translateY(-1px);
        }

        .config-presets {
            display: flex;
            gap: 5px;
            margin-top: 10px;
        }

        .preset-button {
            padding: 4px 8px;
            background: #7f8c8d;
            border: none;
            border-radius: 3px;
            color: white;
            cursor: pointer;
            font-size: 12px;
        }

        .preset-button:hover {
            background: #95a5a6;
        }

        .config-info {
            background: rgba(52, 152, 219, 0.2);
            padding: 10px;
            border-radius: 5px;
            margin-bottom: 15px;
            font-size: 14px;
            text-align: center;
        }
        \`;

        // Adicionar CSS ao documento
        function addMenuCSS() {
            if (!document.getElementById('gameConfigMenuCSS')) {
                const style = document.createElement('style');
                style.id = 'gameConfigMenuCSS';
                style.textContent = menuCSS;
                document.head.appendChild(style);
            }
        }

        // Criar elemento do menu
        function createMenu() {
            addMenuCSS();

            const menu = document.createElement('div');
            menu.id = 'gameConfigMenu';
            menu.innerHTML = \`
                <h2>⚙️ Configurações do Jogo</h2>

                <div class="config-info">
                    Pressione <strong>Ctrl+Shift+C</strong> para abrir/fechar este menu
                </div>

                <div class="config-section">
                    <h3>🏹 Auto Cast</h3>
                    <div class="config-item">
                        <label>Velocidade (ms):</label>
                        <input type="number" id="autocastDelay" min="50" max="5000" step="50" value="500">
                    </div>
                    <div class="config-presets">
                        <button class="preset-button" data-preset="50">Instant</button>
                        <button class="preset-button" data-preset="200">Ultra</button>
                        <button class="preset-button" data-preset="500">Normal</button>
                        <button class="preset-button" data-preset="1000">Lento</button>
                        <button class="preset-button" data-preset="2000">Muito Lento</button>
                    </div>
                </div>

                <div class="config-section">
                    <h3>📊 Estatísticas</h3>
                    <div class="config-item">
                        <label>Configurações ativas:</label>
                        <span id="configCount">-</span>
                    </div>
                    <div class="config-item">
                        <label>Delay atual:</label>
                        <span id="currentDelay">-</span>
                    </div>
                </div>

                <div class="config-buttons">
                    <button class="config-button secondary" id="closeMenu">Fechar</button>
                    <button class="config-button info" id="resetConfigs">Reset</button>
                    <button class="config-button primary" id="saveConfigs">Salvar</button>
                </div>
            \`;

            document.body.appendChild(menu);
            return menu;
        }

        // Carregar valores atuais
        function loadCurrentValues() {
            if (!menuElement) return;

            // Auto Cast Delay
            const currentDelay = window.__cfg('autocast_delay', 500);
            const delayInput = menuElement.querySelector('#autocastDelay');
            if (delayInput) delayInput.value = currentDelay;

            // Estatísticas
            const configCountSpan = menuElement.querySelector('#configCount');
            const currentDelaySpan = menuElement.querySelector('#currentDelay');

            if (configCountSpan) {
                const configs = window.__cfg();
                configCountSpan.textContent = Object.keys(configs).length;
            }

            if (currentDelaySpan) {
                currentDelaySpan.textContent = currentDelay + 'ms';
            }
        }

        // Salvar configurações
        function saveConfigs() {
            if (!menuElement) return;

            // Auto Cast Delay
            const delayInput = menuElement.querySelector('#autocastDelay');
            if (delayInput) {
                const newDelay = parseInt(delayInput.value);
                window.__cfg.set('autocast_delay', newDelay);
                console.log(\`[ConfigMenu] Auto Cast Delay alterado para: \${newDelay}ms\`);
            }

            // Atualizar estatísticas
            loadCurrentValues();

            alert('✅ Configurações salvas com sucesso!');
        }

        // Reset configurações
        function resetConfigs() {
            if (confirm('🔄 Tem certeza que deseja resetar todas as configurações?')) {
                window.__cfg.set('autocast_delay', 500);
                loadCurrentValues();
                console.log('[ConfigMenu] Configurações resetadas para padrões');
                alert('🔄 Configurações resetadas!');
            }
        }

        // Mostrar menu
        function showMenu() {
            if (!menuElement) {
                menuElement = createMenu();

                // Event listeners
                menuElement.querySelector('#closeMenu').addEventListener('click', hideMenu);
                menuElement.querySelector('#saveConfigs').addEventListener('click', saveConfigs);
                menuElement.querySelector('#resetConfigs').addEventListener('click', resetConfigs);

                // Preset buttons
                menuElement.querySelectorAll('.preset-button').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const delay = e.target.dataset.preset;
                        menuElement.querySelector('#autocastDelay').value = delay;
                    });
                });

                // Fechar com ESC
                document.addEventListener('keydown', (e) => {
                    if (e.key === 'Escape' && menuVisible) {
                        hideMenu();
                    }
                });
            }

            loadCurrentValues();
            menuElement.style.display = 'block';
            menuVisible = true;
            console.log('[ConfigMenu] Menu aberto');
        }

        // Esconder menu
        function hideMenu() {
            if (menuElement) {
                menuElement.style.display = 'none';
                menuVisible = false;
                console.log('[ConfigMenu] Menu fechado');
            }
        }

        // Toggle menu
        function toggleMenu() {
            if (menuVisible) {
                hideMenu();
            } else {
                showMenu();
            }
        }

        // Hotkey listener (Ctrl+Shift+C)
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.shiftKey && e.code === 'KeyF') {
                e.preventDefault();
                toggleMenu();
            }
        });

        console.log('[ConfigMenu] Sistema inicializado');
        console.log('[ConfigMenu] Pressione Ctrl+Shift+C para abrir o menu');
    });

})();
// ===== FIM CONFIG MENU SYSTEM =====
`;

        // Inserir no final do código
        const modifiedCode = sourceCode + '\n' + menuCode;

        console.log('✅ Config Menu aplicado com sucesso!');
        return modifiedCode;
    },

    remove: (sourceCode) => {
        console.log('Removendo Config Menu...');

        // Remove o bloco do menu
        const startMarker = '// ===== CONFIG MENU SYSTEM =====';
        const endMarker = '// ===== FIM CONFIG MENU SYSTEM =====';

        const startIndex = sourceCode.indexOf(startMarker);
        const endIndex = sourceCode.indexOf(endMarker);

        if (startIndex !== -1 && endIndex !== -1) {
            const beforeMenu = sourceCode.substring(0, startIndex);
            const afterMenu = sourceCode.substring(endIndex + endMarker.length);
            const cleanedCode = beforeMenu + afterMenu.replace(/^\n+/, '');

            console.log('✅ Config Menu removido com sucesso!');
            return cleanedCode;
        }

        console.warn('⚠️ Config Menu não encontrado no código');
        return sourceCode;
    }
};