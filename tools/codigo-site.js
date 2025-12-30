// Static Unminify App - No server required
(function() {
    'use strict';

    let editor;
    let worker;
    let isFormatting = false;
    let fileName = null;

    // Initialize on DOM ready
    document.addEventListener('DOMContentLoaded', init);

    function init() {
        initEditor();
        initWorker();
        initEventListeners();
        initDragDrop();
    }

    function initEditor() {
        const textarea = document.getElementById('code');
        editor = CodeMirror.fromTextArea(textarea, {
            lineNumbers: true,
            lineWrapping: false,
            placeholder: 'Paste your code or drag a file here',
            mode: 'javascript',
            theme: 'default',
            tabSize: 4,
            indentUnit: 4,
            smartIndent: true
        });
    }

    function initWorker() {
        // Create worker code as a string
        const workerCode = `
            // Prettier worker inline
            importScripts("https://unpkg.com/prettier@3.3.3/standalone.js");
            importScripts("https://unpkg.com/prettier@3.3.3/plugins/babel.js");
            importScripts("https://unpkg.com/prettier@3.3.3/plugins/typescript.js");
            importScripts("https://unpkg.com/prettier@3.3.3/plugins/html.js");
            importScripts("https://unpkg.com/prettier@3.3.3/plugins/postcss.js");
            importScripts("https://unpkg.com/prettier@3.3.3/plugins/estree.js");

            self.onmessage = async function(event) {
                try {
                    const { text, options } = event.data;
                    
                    const plugins = [
                        prettierPlugins.babel,
                        prettierPlugins.typescript,
                        prettierPlugins.html,
                        prettierPlugins.postcss,
                        prettierPlugins.estree
                    ];

                    // Parser mapping
                    const parserMap = {
                        'javascript': 'babel',
                        'typescript': 'typescript',
                        'jsx': 'babel',
                        'tsx': 'typescript',
                        'html': 'html',
                        'xml': 'html',
                        'css': 'css',
                        'scss': 'scss',
                        'sass': 'scss',
                        'less': 'less',
                        'json': 'json'
                    };

                    const parser = parserMap[options.language] || 'babel';

                    const formatOptions = {
                        parser: parser,
                        plugins: plugins,
                        printWidth: 120,
                        tabWidth: options.tabWidth || 4,
                        useTabs: false,
                        semi: true,
                        singleQuote: false,
                        trailingComma: 'es5',
                        bracketSpacing: true,
                        arrowParens: 'always'
                    };

                    const result = await prettier.format(text, formatOptions);
                    
                    self.postMessage({
                        success: true,
                        text: result
                    });
                    
                } catch (error) {
                    self.postMessage({
                        success: false,
                        error: {
                            message: error.message || 'Unknown formatting error'
                        }
                    });
                }
            };
        `;

        // Create a blob from the worker code
        const blob = new Blob([workerCode], { type: 'application/javascript' });
        const workerUrl = URL.createObjectURL(blob);
        
        // Create the worker from the blob URL
        worker = new Worker(workerUrl);
        worker.onmessage = handleWorkerMessage;
        
        // Clean up the blob URL when done
        worker.onerror = function(error) {
            console.error('Worker error:', error);
            URL.revokeObjectURL(workerUrl);
        };
    }

    function initEventListeners() {
        // Format button
        document.getElementById('formatBtn').addEventListener('click', formatCode);
        
        // Upload button
        document.getElementById('uploadBtn').addEventListener('click', () => {
            document.getElementById('inFile').click();
        });
        
        // File input
        document.getElementById('inFile').addEventListener('change', handleFileSelect);
        
        // Clear button
        document.getElementById('clearBtn').addEventListener('click', () => {
            editor.setValue('');
            fileName = null;
        });
        
        // Copy button with optimized performance
        const clipboard = new ClipboardJS('#copyBtn', {
            text: function() {
                // Get text without triggering reflow
                return editor.getValue();
            },
            container: document.getElementById('copyBtn')
        });
        
        // Optional: Show feedback when copied
        clipboard.on('success', function(e) {
            const btn = document.getElementById('copyBtn');
            const originalText = btn.textContent;
            btn.textContent = 'Copied!';
            setTimeout(() => {
                btn.textContent = originalText;
            }, 2000);
            e.clearSelection();
        });
        
        // Download button
        document.getElementById('downloadBtn').addEventListener('click', downloadFile);
        
        // Modal controls
        document.getElementById('modalClose').addEventListener('click', closeModal);
        
        // Modal backdrop click
        const backdrop = document.querySelector('.modal-backdrop');
        if (backdrop) {
            backdrop.addEventListener('click', closeModal);
        }
        
        document.getElementById('modalBtn').addEventListener('click', handleModalAction);
        document.getElementById('modalInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleModalAction();
        });
    }

    function initDragDrop() {
        const wrapper = editor.getWrapperElement();
        
        wrapper.addEventListener('dragover', (e) => {
            e.preventDefault();
            wrapper.classList.add('drag-over');
        });
        
        wrapper.addEventListener('dragleave', (e) => {
            e.preventDefault();
            wrapper.classList.remove('drag-over');
        });
        
        wrapper.addEventListener('drop', (e) => {
            e.preventDefault();
            wrapper.classList.remove('drag-over');
            
            if (e.dataTransfer.files.length > 0) {
                readFile(e.dataTransfer.files[0]);
            }
        });
    }

    function formatCode() {
        if (isFormatting || !editor.getValue()) return;
        
        isFormatting = true;
        showSpinner(true);
        
        const code = editor.getValue();
        const tabSize = parseInt(document.getElementById('tabSize').value) || 4;
        const language = detectLanguage(code);
        
        worker.postMessage({
            text: code,
            options: {
                parser: getParserForLanguage(language),
                language: language,
                tabWidth: tabSize,
                printWidth: 120,
                semi: true,
                singleQuote: false,
                trailingComma: 'es5',
                bracketSpacing: true
            }
        });
    }

    function handleWorkerMessage(e) {
        const { success, text, error } = e.data;
        
        if (success && text) {
            editor.setValue(text);
        } else if (error) {
            console.error('Formatting error:', error);
            // Не показываем alert, только в консоль
        }
        
        isFormatting = false;
        showSpinner(false);
    }

    function detectLanguage(code) {
        // Simple detection based on file extension if available
        if (fileName) {
            const ext = fileName.split('.').pop().toLowerCase();
            const extMap = {
                'js': 'javascript',
                'jsx': 'jsx',
                'ts': 'typescript',
                'tsx': 'tsx',
                'html': 'html',
                'htm': 'html',
                'xml': 'xml',
                'css': 'css',
                'scss': 'scss',
                'sass': 'sass',
                'less': 'less',
                'json': 'json'
            };
            
            if (extMap[ext]) return extMap[ext];
        }
        
        // Basic content detection
        if (code.trim().startsWith('<')) return 'html';
        if (code.trim().startsWith('{') || code.trim().startsWith('[')) return 'json';
        if (code.includes('function') || code.includes('const ') || code.includes('let ')) return 'javascript';
        if (code.includes('{') && code.includes('}') && code.includes(':') && code.includes(';')) return 'css';
        
        return 'javascript'; // Default
    }

    function getParserForLanguage(language) {
        const parserMap = {
            'javascript': 'babel',
            'typescript': 'typescript',
            'jsx': 'babel',
            'tsx': 'typescript',
            'html': 'html',
            'xml': 'xml',
            'css': 'css',
            'scss': 'scss',
            'sass': 'scss',
            'less': 'less',
            'json': 'json',
            'php': 'php',
            'vue': 'vue',
            'markdown': 'markdown',
            'yaml': 'yaml'
        };
        
        return parserMap[language] || 'babel';
    }

    function handleFileSelect(e) {
        const file = e.target.files[0];
        if (file) {
            readFile(file);
        }
        // Reset input value to allow re-uploading the same file
        e.target.value = '';
    }

    function readFile(file) {
        fileName = file.name;
        const reader = new FileReader();
        
        reader.onload = (e) => {
            const content = e.target.result;
            const language = detectLanguage(content);
            
            // Use requestAnimationFrame to defer the heavy DOM operation
            requestAnimationFrame(() => {
                editor.setValue(content);
                setEditorMode(language);
            });
        };
        
        reader.readAsText(file);
    }

    function setEditorMode(language) {
        const modeMap = {
            'javascript': 'javascript',
            'typescript': 'javascript',
            'jsx': 'jsx',
            'tsx': 'jsx',
            'html': 'htmlmixed',
            'xml': 'xml',
            'css': 'css',
            'scss': 'text/x-scss',
            'sass': 'text/x-sass',
            'less': 'text/x-less',
            'json': 'application/json'
        };
        
        editor.setOption('mode', modeMap[language] || 'javascript');
    }

    function downloadFile() {
        const code = editor.getValue();
        if (!code) return;
        
        showModal('download');
    }

    function performDownload(filename) {
        const code = editor.getValue();
        const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
        saveAs(blob, filename);
    }

    function showModal(type) {
        const modal = document.getElementById('modalWindow');
        const backdrop = document.querySelector('.modal-backdrop');
        const title = modal.querySelector('.modal-title');
        const btn = document.getElementById('modalBtn');
        const input = document.getElementById('modalInput');
        
        modal.dataset.type = type;
        input.value = '';
        document.getElementById('modalError').hidden = true;
        
        if (type === 'download') {
            title.textContent = 'Enter file name';
            btn.textContent = 'Download';
            input.value = fileName || 'unminified.js';
        }
        
        modal.style.display = 'block';
        backdrop.style.display = 'block';
        input.focus();
        input.select();
    }

    function closeModal() {
        const modal = document.getElementById('modalWindow');
        const backdrop = document.querySelector('.modal-backdrop');
        
        if (modal) {
            modal.style.display = 'none';
        }
        if (backdrop) {
            backdrop.style.display = 'none';
        }
    }

    function handleModalAction() {
        const modal = document.getElementById('modalWindow');
        const input = document.getElementById('modalInput').value;
        
        if (!input) return;
        
        if (modal.dataset.type === 'download') {
            performDownload(input);
            closeModal();
        }
    }

    function showSpinner(show) {
        const btnText = document.querySelector('#formatBtn span');
        const spinner = document.querySelector('#formatBtn .spinner');
        
        if (show) {
            btnText.style.display = 'none';
            spinner.style.display = 'block';
        } else {
            btnText.style.display = 'block';
            spinner.style.display = 'none';
        }
    }

})();