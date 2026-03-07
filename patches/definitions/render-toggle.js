/**
 * Render Toggle Patch
 *
 * Integra configuração render_enabled ao Config System, expõe helpers globais,
 * adiciona guard no método render.
 *
 * Atualizado para source index-CCCcPKhO.js
 * Mudanças: or() -> ur(), render() agora checa contextLost
 */

const RENDER_METHOD_ORIGINAL = `    render() {
        this.contextLost ||
            (this.renderer && this.scene && this.camera && this.renderer.render(this.scene, this.camera));
    }`;

const RENDER_METHOD_PATCHED = `    render() {
        if (typeof window != "undefined") {
            let renderEnabled = !0;
            if (typeof window.__cfg == "function") renderEnabled = window.__cfg("render_enabled", !0);
            else if (typeof window.__fishingRenderEnabled == "boolean") renderEnabled = window.__fishingRenderEnabled;
            if (!renderEnabled) {
                if (!this.renderDisabledCleared && this.renderer) {
                    this.renderDisabledCleared = !0;
                    const prevColor = typeof this.renderer.getClearColor == "function" ? this.renderer.getClearColor(new Color()) : null;
                    const prevAlpha = typeof this.renderer.getClearAlpha == "function" ? this.renderer.getClearAlpha() : 1;
                    this.renderer.setRenderTarget && this.renderer.setRenderTarget(null);
                    this.renderer.setClearColor(0, 1);
                    this.renderer.clear(!0, !0, !0);
                    prevColor && this.renderer.setClearColor(prevColor, prevAlpha);
                    this.renderer.domElement && (this.renderer.domElement.style.backgroundColor = "#000000");
                }
                return;
            }
            this.renderDisabledCleared &&
                ((this.renderDisabledCleared = !1),
                this.renderer && this.renderer.domElement && (this.renderer.domElement.style.backgroundColor = ""));
        }
        this.contextLost ||
            (this.renderer && this.scene && this.camera && this.renderer.render(this.scene, this.camera));
    }`;

const RENDER_HELPERS_ORIGINAL = `const percentToProgress = (b) => b / 100;`;
const RENDER_HELPERS_PATCHED = `const percentToProgress = (b) => b / 100;
const RENDER_TOGGLE_EVENT = "fishing-render-toggle-change";
const getRenderToggleState = () => {
    if (typeof window == "undefined") return !0;
    if (typeof window.__cfg == "function") return window.__cfg("render_enabled", !0);
    if (typeof window.__fishingRenderEnabled == "boolean") return window.__fishingRenderEnabled;
    return !0;
};`;

const RENDER_PROP_ORIGINAL = `        ur(this, "unityDebugEnabled", !1);
        ur(this, "sunLight", null);`;
const RENDER_PROP_PATCHED = `        ur(this, "unityDebugEnabled", !1);
        ur(this, "renderDisabledCleared", !1);
        ur(this, "sunLight", null);`;

const RENDER_TOGGLE_BLOCK = `

// ===== RENDER TOGGLE CONFIG INTEGRATION =====
(function () {
    "use strict";
    const CONFIG_KEY = "render_enabled";
    const GLOBAL_FLAG = "__fishingRenderEnabled";
    const EVENT_NAME = typeof RENDER_TOGGLE_EVENT < "u" ? RENDER_TOGGLE_EVENT : "fishing-render-toggle-change";
    function waitForConfig(iteration = 0) {
        if (typeof window.__cfg == "function") return Promise.resolve();
        if (iteration > 100) return Promise.resolve();
        return new Promise((resolve) => setTimeout(resolve, 100)).then(() => waitForConfig(iteration + 1));
    }
    function emitRenderToggle(state) {
        if (typeof window.dispatchEvent != "function" || typeof CustomEvent != "function") return;
        window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { enabled: state } }));
    }
    function applyRenderState(state) {
        const normalized = !!state;
        if (typeof window.__cfg == "function") window.__cfg.set(CONFIG_KEY, normalized);
        window[GLOBAL_FLAG] = normalized;
        emitRenderToggle(normalized);
        console.log(\`[RenderToggle] Render \${normalized ? "habilitado" : "desabilitado"}\`);
        return normalized;
    }
    waitForConfig().then(() => {
        const current = typeof window.__cfg == "function" ? window.__cfg(CONFIG_KEY, !0) : !0;
        window[GLOBAL_FLAG] = current;
        emitRenderToggle(current);
        window.getFishingRenderState = () => {
            if (typeof window.__cfg == "function") return window.__cfg(CONFIG_KEY, !0);
            return window[GLOBAL_FLAG] !== !1;
        };
        window.setFishingRender = (value) => applyRenderState(value);
        window.toggleFishingRender = (value) => {
            const next = typeof value == "boolean" ? value : !window.__cfg(CONFIG_KEY, !0);
            return applyRenderState(next);
        };
        console.log("[RenderToggle] Use window.toggleFishingRender() para alternar o render rapidamente.");
    });
})();
// ===== FIM RENDER TOGGLE CONFIG INTEGRATION =====
`;

const renderToggleRegex =
    /\r?\n\r?\n\/\/ ===== RENDER TOGGLE CONFIG INTEGRATION =====[\s\S]*?\/\/ ===== FIM RENDER TOGGLE CONFIG INTEGRATION =====\r?\n?/;

module.exports = {
    name: "Render Toggle",
    description: "Adiciona config/variáveis globais para habilitar/desabilitar o renderer",
    version: "2.0.0",

    apply: (sourceCode) => {
        console.log("[render-toggle] Aplicando patch...");
        let modifiedCode = sourceCode;

        if (modifiedCode.includes(RENDER_METHOD_PATCHED)) {
            console.log("[render-toggle] Método render já está atualizado.");
        } else if (modifiedCode.includes(RENDER_METHOD_ORIGINAL)) {
            modifiedCode = modifiedCode.replace(RENDER_METHOD_ORIGINAL, RENDER_METHOD_PATCHED);
            console.log("[render-toggle] Método render atualizado com guardas de configuração.");
        } else {
            console.warn("[render-toggle] Não encontrei o método render esperado.");
        }

        if (!modifiedCode.includes("renderDisabledCleared")) {
            if (modifiedCode.includes(RENDER_PROP_ORIGINAL)) {
                modifiedCode = modifiedCode.replace(RENDER_PROP_ORIGINAL, RENDER_PROP_PATCHED);
                console.log("[render-toggle] Propriedade renderDisabledCleared adicionada.");
            } else {
                console.warn("[render-toggle] Não encontrei local para declarar renderDisabledCleared.");
            }
        }

        if (!modifiedCode.includes("const RENDER_TOGGLE_EVENT")) {
            if (modifiedCode.includes(RENDER_HELPERS_ORIGINAL)) {
                modifiedCode = modifiedCode.replace(RENDER_HELPERS_ORIGINAL, RENDER_HELPERS_PATCHED);
                console.log("[render-toggle] Helpers globais adicionados.");
            } else {
                console.warn("[render-toggle] Não encontrei ponto para inserir helpers globais.");
            }
        }

        if (!renderToggleRegex.test(modifiedCode)) {
            modifiedCode += RENDER_TOGGLE_BLOCK;
            console.log("[render-toggle] Bloco de integração com config system inserido.");
        } else {
            console.log("[render-toggle] Bloco de integração já presente.");
        }

        return modifiedCode;
    },

    remove: (sourceCode) => {
        console.log("[render-toggle] Removendo patch...");
        let modifiedCode = sourceCode.replace(RENDER_METHOD_PATCHED, RENDER_METHOD_ORIGINAL);
        modifiedCode = modifiedCode.replace(RENDER_HELPERS_PATCHED, RENDER_HELPERS_ORIGINAL);
        modifiedCode = modifiedCode.replace(RENDER_PROP_PATCHED, RENDER_PROP_ORIGINAL);
        modifiedCode = modifiedCode.replace(renderToggleRegex, "\n");
        return modifiedCode;
    },
};
