/**
 * Render Toggle Patch
 *
 * Integra configuração render_enabled ao Config System, expõe helpers globais,
 * adiciona guard no método render e inclui um botão no HUD ao lado do Auto Cast.
 */

const RENDER_METHOD_ORIGINAL = `    render() {
        this.renderer && this.scene && this.camera && this.renderer.render(this.scene, this.camera);
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
        this.renderer && this.scene && this.camera && this.renderer.render(this.scene, this.camera);
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

const RENDER_STATE_ORIGINAL = `            Bt = reactExports.useRef([]);`;
const RENDER_STATE_PATCHED = `            Bt = reactExports.useRef([]),
            [renderToggleEnabled, setRenderToggleEnabled] = reactExports.useState(() => getRenderToggleState());`;

const RENDER_EFFECT_ORIGINAL = `            reactExports.useEffect(() => {
                tt.current = it;
            }, [it]));`;
const RENDER_EFFECT_PATCHED = `            reactExports.useEffect(() => {
                tt.current = it;
            }, [it]),
            reactExports.useEffect(() => {
                if (typeof window == "undefined") return;
                const fr = (Sr) => {
                    var yr;
                    const Dr =
                        (yr = Sr == null ? void 0 : Sr.detail) != null && typeof yr.enabled == "boolean"
                            ? yr.enabled
                            : getRenderToggleState();
                    setRenderToggleEnabled(Dr);
                };
                window.addEventListener(RENDER_TOGGLE_EVENT, fr);
                return () => {
                    window.removeEventListener(RENDER_TOGGLE_EVENT, fr);
                };
            }, []));`;

const RENDER_CALLBACK_ORIGINAL = `            [Br, ln] = reactExports.useState(!1),
            Ar = te || (Br && Zt !== null);`;
const RENDER_CALLBACK_PATCHED = `            [Br, ln] = reactExports.useState(!1),
            Ar = te || (Br && Zt !== null),
            handleRenderToggleClick = reactExports.useCallback(() => {
                if (!Ar || typeof window == "undefined") return;
                let fr = !renderToggleEnabled;
                if (typeof window.toggleFishingRender == "function") fr = window.toggleFishingRender(fr);
                else if (typeof window.setFishingRender == "function") fr = window.setFishingRender(fr);
                else {
                    typeof window.__cfg == "function" && window.__cfg.set("render_enabled", fr);
                    window.__fishingRenderEnabled = fr;
                    typeof window.dispatchEvent == "function" &&
                        typeof CustomEvent == "function" &&
                        window.dispatchEvent(new CustomEvent(RENDER_TOGGLE_EVENT, { detail: { enabled: fr } }));
                }
                setRenderToggleEnabled(fr);
            }, [Ar, renderToggleEnabled]);`;

const RENDER_BUTTON_ANCHOR = `                                                      jsxRuntimeExports.jsxs("button", {
                                                          onClick: tn,`;
const RENDER_BUTTON_SNIPPET = `                                                      jsxRuntimeExports.jsx("button", {
                                                          onClick: handleRenderToggleClick,
                                                          className: \`game-button \${Ar ? (renderToggleEnabled ? "game-button-active" : "game-button-purple") : "game-button-disabled"}\`,
                                                          style: {
                                                              position: "relative",
                                                              padding: "14px 24px",
                                                              fontSize: "18px",
                                                              fontWeight: "900",
                                                              fontFamily:
                                                                  "'Lilita One', 'Arial Rounded MT Bold', cursive, sans-serif",
                                                              color: "white",
                                                              borderRadius: "20px",
                                                              cursor: Ar ? "pointer" : "not-allowed",
                                                              overflow: "visible",
                                                              minWidth: "200px",
                                                              textShadow: "0 4px 6px rgba(0,0,0,0.5)",
                                                              letterSpacing: "0.5px",
                                                              WebkitTextStroke: TEXT_STROKE.THICK,
                                                              paintOrder: "stroke fill",
                                                              opacity: Ar ? 1 : 0.6,
                                                          },
                                                          disabled: !Ar,
                                                          children: jsxRuntimeExports.jsxs("span", {
                                                              style: {
                                                                  position: "relative",
                                                                  zIndex: 2,
                                                                  display: "flex",
                                                                  flexDirection: "column",
                                                                  alignItems: "center",
                                                                  justifyContent: "center",
                                                                  gap: "4px",
                                                                  width: "100%",
                                                              },
                                                              children: [
                                                                  jsxRuntimeExports.jsxs("span", {
                                                                      style: {
                                                                          display: "flex",
                                                                          alignItems: "center",
                                                                          gap: "8px",
                                                                          fontSize: "18px",
                                                                      },
                                                                      children: [
                                                                          "🖥️",
                                                                          renderToggleEnabled ? "RENDER ON" : "RENDER OFF",
                                                                      ],
                                                                  }),
                                                                  jsxRuntimeExports.jsx("span", {
                                                                      style: { fontSize: "12px", fontWeight: 600, opacity: 0.85 },
                                                                      children: renderToggleEnabled
                                                                          ? "PAUSE 3D RENDER"
                                                                          : "RESUME 3D RENDER",
                                                                  }),
                                                              ],
                                                          }),
                                                      }),
                                                      jsxRuntimeExports.jsxs("button", {
                                                          onClick: tn,`;

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

const RENDER_PROP_ORIGINAL = `        or(this, "unityDebugEnabled", !1);
        or(this, "sunLight", null);`;
const RENDER_PROP_PATCHED = `        or(this, "unityDebugEnabled", !1);
        or(this, "renderDisabledCleared", !1);
        or(this, "sunLight", null);`;

const renderToggleRegex =
    /\r?\n\r?\n\/\/ ===== RENDER TOGGLE CONFIG INTEGRATION =====[\s\S]*?\/\/ ===== FIM RENDER TOGGLE CONFIG INTEGRATION =====\r?\n?/;

module.exports = {
    name: "Render Toggle",
    description: "Adiciona config/variáveis globais para habilitar/desabilitar o renderer",
    version: "1.1.0",

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

        if (!modifiedCode.includes("renderToggleEnabled")) {
            if (modifiedCode.includes(RENDER_STATE_ORIGINAL)) {
                modifiedCode = modifiedCode.replace(RENDER_STATE_ORIGINAL, RENDER_STATE_PATCHED);
                console.log("[render-toggle] Estado renderToggleEnabled criado.");
            } else {
                console.warn("[render-toggle] Não encontrei bloco de state para inserir renderToggleEnabled.");
            }
        }

        if (!modifiedCode.includes("window.addEventListener(RENDER_TOGGLE_EVENT")) {
            if (modifiedCode.includes(RENDER_EFFECT_ORIGINAL)) {
                modifiedCode = modifiedCode.replace(RENDER_EFFECT_ORIGINAL, RENDER_EFFECT_PATCHED);
                console.log("[render-toggle] useEffect de sincronização registrado.");
            } else {
                console.warn("[render-toggle] Não encontrei trecho para adicionar useEffect de sincronização.");
            }
        }

        if (!modifiedCode.includes("handleRenderToggleClick")) {
            if (modifiedCode.includes(RENDER_CALLBACK_ORIGINAL)) {
                modifiedCode = modifiedCode.replace(RENDER_CALLBACK_ORIGINAL, RENDER_CALLBACK_PATCHED);
                console.log("[render-toggle] Callback handleRenderToggleClick criado.");
            } else {
                console.warn("[render-toggle] Não encontrei trecho para declarar handleRenderToggleClick.");
            }
        }

        if (!modifiedCode.includes("PAUSE 3D RENDER")) {
            if (modifiedCode.includes(RENDER_BUTTON_ANCHOR)) {
                modifiedCode = modifiedCode.replace(RENDER_BUTTON_ANCHOR, RENDER_BUTTON_SNIPPET);
                console.log("[render-toggle] Botão do HUD inserido ao lado do Auto Cast.");
            } else {
                console.warn("[render-toggle] Não encontrei âncora para inserir botão no HUD.");
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
        modifiedCode = modifiedCode.replace(RENDER_STATE_PATCHED, RENDER_STATE_ORIGINAL);
        modifiedCode = modifiedCode.replace(RENDER_EFFECT_PATCHED, RENDER_EFFECT_ORIGINAL);
        modifiedCode = modifiedCode.replace(RENDER_CALLBACK_PATCHED, RENDER_CALLBACK_ORIGINAL);
        modifiedCode = modifiedCode.replace(RENDER_BUTTON_SNIPPET, RENDER_BUTTON_ANCHOR);
        modifiedCode = modifiedCode.replace(renderToggleRegex, "\n");
        return modifiedCode;
    },
};
