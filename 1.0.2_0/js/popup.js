class QuickAnswerApp {
    constructor() {
        this.defaultSettings = {
            apiKey: '',
            baseUrl: 'https://api.openai.com/v1',
            model: 'gpt-4o',
            stream: true
        };
        
        this.settings = { ...this.defaultSettings };
        this.lastTitle = '';
        this.lastUrl = '';
        
        this.initializeTheme();
        this.loadSettings();
        this.initializeEventListeners();
        this.checkFirstRun();
    }

    initializeTheme() {
        const toggleBtn = document.getElementById('theme-toggle');
        
        // Check saved theme or system preference
        const savedTheme = localStorage.getItem('theme');
        const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        
        const isDark = savedTheme === 'dark' || (!savedTheme && systemDark);
        this.setTheme(isDark);

        toggleBtn.addEventListener('click', () => {
            const isCurrentDark = document.documentElement.getAttribute('data-theme') === 'dark';
            this.setTheme(!isCurrentDark);
        });
    }

    setTheme(isDark) {
        const sunIcon = document.querySelector('.sun-icon');
        const moonIcon = document.querySelector('.moon-icon');
        
        if (isDark) {
            document.documentElement.setAttribute('data-theme', 'dark');
            localStorage.setItem('theme', 'dark');
            if (sunIcon) sunIcon.style.display = 'block'; 
            if (moonIcon) moonIcon.style.display = 'none';
        } else {
            document.documentElement.removeAttribute('data-theme');
            localStorage.setItem('theme', 'light');
            if (sunIcon) sunIcon.style.display = 'none';
            if (moonIcon) moonIcon.style.display = 'block'; 
        }
    }

    initializeEventListeners() {
        document.getElementById('convert').addEventListener('click', () => this.runWorkflow());
        document.getElementById('copy').addEventListener('click', () => this.copyToClipboard());
        document.getElementById('download').addEventListener('click', () => this.downloadAnswer());
        document.getElementById('settings-toggle').addEventListener('click', () => this.toggleSettingsPanel());
        document.getElementById('debug-content').addEventListener('click', () => this.showDebugInfo());

        // Settings change listeners
        const save = (key, val) => this.saveSetting(key, val);
        document.getElementById('setting-apikey').addEventListener('change', (e) => save('apiKey', e.target.value));
        document.getElementById('setting-baseurl').addEventListener('change', (e) => save('baseUrl', e.target.value));
        document.getElementById('setting-model').addEventListener('change', (e) => save('model', e.target.value));
        document.getElementById('setting-stream').addEventListener('change', (e) => save('stream', e.target.checked));
    }

    loadSettings() {
        const stored = localStorage.getItem('qaSettings');
        if (stored) {
            this.settings = { ...this.defaultSettings, ...JSON.parse(stored) };
        }

        // Update UI
        document.getElementById('setting-apikey').value = this.settings.apiKey || '';
        document.getElementById('setting-baseurl').value = this.settings.baseUrl || '';
        document.getElementById('setting-model').value = this.settings.model || 'gpt-4o';
        document.getElementById('setting-stream').checked = this.settings.stream;
    }

    saveSetting(key, value) {
        this.settings[key] = value;
        localStorage.setItem('qaSettings', JSON.stringify(this.settings));
    }

    checkFirstRun() {
        if (!this.settings.apiKey) {
            this.toggleSettingsPanel(true);
            this.showToast('Please set your OpenAI API Key', 'info');
        }
    }

    toggleSettingsPanel(forceShow = false) {
        const panel = document.getElementById('settings-panel');
        const btn = document.getElementById('settings-toggle');
        const isHidden = panel.style.display === 'none';
        
        if (forceShow) {
            panel.style.display = 'flex';
            btn.classList.add('active');
        } else {
            panel.style.display = isHidden ? 'flex' : 'none';
            if (isHidden) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        }
    }

    async showDebugInfo() {
        const output = document.getElementById('output');
        output.value = 'Extracting content for debug...';
        
        try {
            const pageData = await this.extractPageContent();
            // Just show the raw HTML frames info if needed, or the markdown
            const markdown = this.convertToMarkdown(pageData);
            
            output.value = "--- DEBUG: EXTRACTED CONTENT PREVIEW ---\n" +
                           "Title: " + pageData.title + "\n" +
                           "URL: " + pageData.url + "\n" +
                           "--- START CONTENT ---\n" + 
                           markdown + 
                           "\n--- END CONTENT ---\n";
            
            this.showToast('Debug content shown', 'success');
            this.toggleSettingsPanel(false); // Hide settings to see output
            this.enableActions(true); // Allow copying the debug info
        } catch (error) {
            output.value = `Debug Error: ${error.message}`;
            this.showToast('Debug failed: ' + error.message, 'error');
        }
    }

    async runWorkflow() {
        const output = document.getElementById('output');
        output.value = '';

        if (!this.settings.apiKey) {
            this.toggleSettingsPanel(true);
            this.showToast('API Key missing!', 'error');
            return;
        }

        try {
            this.setLoading(true, 'Extracting...');
            
            // 1. Extract Page Content (Updated with allFrames support)
            const pageData = await this.extractPageContent();
            
            // 2. Convert to Markdown (for cleaner API input)
            const markdown = this.convertToMarkdown(pageData);
            
            // 3. Call AI
            this.setLoading(true, 'Solving...');
            await this.callOpenAI(markdown);

            this.enableActions(true);
            this.showToast('Done!', 'success');

        } catch (error) {
            console.error('Workflow error:', error);
            output.value = `Error: ${error.message}`;
            this.showToast(error.message.slice(0, 30), 'error');
            this.enableActions(false);
        } finally {
            this.setLoading(false);
        }
    }

    async extractPageContent() {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.id) throw new Error('No active tab found');

        // Prevent scripting on restricted pages
        if (tab.url.startsWith('chrome://') || 
            tab.url.startsWith('chrome-extension://') || 
            tab.url.startsWith('edge://') || 
            tab.url.startsWith('about:') ||
            tab.url.includes('chrome.google.com/webstore')) {
            throw new Error('Cannot run on system pages');
        }

        // Execute script in ALL frames to handle cross-origin iframes and complex layouts
        const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id, allFrames: true },
            func: () => {
                try {
                    // Safety check
                    if (!document || !document.body) return null;

                    // Visibility check helper
                    function isVisible(elem) {
                        if (!elem) return false;
                        if (elem.nodeType === Node.TEXT_NODE) return true;
                        if (elem.nodeType !== Node.ELEMENT_NODE) return false;
                        
                        // Check standard properties
                        const style = window.getComputedStyle(elem);
                        if (style.display === 'none') return false;
                        if (style.visibility === 'hidden') return false;
                        if (style.opacity === '0') return false;

                        // Check dimensions
                        const rect = elem.getBoundingClientRect();
                        if (rect.width === 0 || rect.height === 0) {
                            // Elements with 0 dimensions are usually hidden, unless they have visible overflow
                            if (style.overflow === 'hidden') return false;
                        }
                        
                        return true;
                    }

                    // Recursive builder that captures only visible content
                    function cloneVisible(node) {
                        // 1. Text Nodes: Keep if not empty/whitespace-only (or keep formatting)
                        if (node.nodeType === Node.TEXT_NODE) {
                             return node.cloneNode(true);
                        }
                        
                        // 2. Elements
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            // Preliminary tag check
                            const lowerTag = node.tagName.toLowerCase();
                            const ignoreTags = ['script', 'style', 'noscript', 'link', 'nav', 'footer', 'aside', 'iframe'];
                            if (ignoreTags.includes(lowerTag)) return null;

                            // Visibility check (expensive but necessary for this use case)
                            if (!isVisible(node)) return null;
                            
                            // Check exclusion selectors
                            if (node.matches && node.matches('.ads, .comments, .cookie-banner, #onetrust-banner-sdk, .popup, .modal, [role="complementary"]')) {
                                return null;
                            }

                            // Shallow clone
                            const clone = node.cloneNode(false);
                            
                            // Process children
                            let searchChildren = node.childNodes;
                            
                            // Special handling: if this node is a known "content hider" container that swaps content,
                            // isVisible check above handles it.
                            
                            for (let i = 0; i < searchChildren.length; i++) {
                                const childClone = cloneVisible(searchChildren[i]);
                                if (childClone) {
                                    clone.appendChild(childClone);
                                }
                            }
                            
                            return clone;
                        }
                        return null;
                    }

                    const cleanBody = cloneVisible(document.body);
                    if (!cleanBody) return null;

                    // Clean up empty containers from the clone? 
                    // (Optional: remove divs with no text/images)
                    // For now, let's trust the visibility filter.

                    const textContent = cleanBody.innerText || "";
                    if (textContent.trim().length < 50) return null;

                    const isIframe = window.self !== window.top;
                    
                    return {
                        url: window.location.href,
                        title: document.title,
                        html: cleanBody.innerHTML,
                        isIframe: isIframe,
                        success: true
                    };
                } catch (e) {
                    return null; // Fail silently for individual frames
                }
            }
        });

        // Filter valid results
        const validFrames = results
            .map(frame => frame.result)
            .filter(res => res && res.success);

        if (validFrames.length === 0) {
            throw new Error('No readable content found on the page.');
        }

        // Separate top frame and sub-frames
        let combinedHtml = '';
        const topFrame = validFrames.find(f => !f.isIframe);
        const subFrames = validFrames.filter(f => f.isIframe);

        if (topFrame) {
            combinedHtml += `<!-- Main Content -->\n${topFrame.html}\n`;
        }

        if (subFrames.length > 0) {
            combinedHtml += `\n<!-- Embedded Content / Frames -->\n`;
            subFrames.forEach(frame => {
                combinedHtml += `<hr/>\n<h3>Frame: ${frame.title}</h3>\n${frame.html}\n`;
            });
        }

        this.lastTitle = tab.title;
        return {
            title: this.lastTitle,
            url: tab.url,
            html: combinedHtml
        };
    }

    convertToMarkdown(pageData) {
        // Reuse Turndown logic
        const service = new TurndownService({
             headingStyle: 'atx',
             hr: '---',
             bulletListMarker: '-',
             codeBlockStyle: 'fenced'
        });
        
        // Remove nested buttons or interactive elements that might remain
        service.addRule('removeInteractive', {
            filter: ['button', 'input', 'select', 'textarea'],
            replacement: function (content) {
                return '';
            }
        });

        // Simplified config for AI consumption
        const content = `<h1>${pageData.title}</h1>\n${pageData.html}`;
        return service.turndown(content);
    }

    async callOpenAI(context) {
        const output = document.getElementById('output');
        const endpoint = this.settings.baseUrl.replace(/\/+$/, ''); // trim trailing slash
        const url = `${endpoint}/chat/completions`;
        
        const messages = [
            {
                role: "system",
                content: "You are an expert problem solver. The user will provide content from a webpage. Your task is to analyze the content, identify any problems, questions, or coding challenges within it, and provide a clear, step-by-step solution. If it's a coding problem, provide the code. If it's a quiz, provide the answers with explanations. IMPORTANT: At the very end of your response, repeat the final answer or conclusion clearly and concisely."
            },
            {
                role: "user",
                content: `Here is the webpage content:\n\n${context}`
            }
        ];

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.settings.apiKey}`
                },
                body: JSON.stringify({
                    model: this.settings.model,
                    messages: messages,
                    stream: this.settings.stream
                })
            });

            if (!response.ok) {
                const err = await response.text();
                throw new Error(`API Error ${response.status}: ${err}`);
            }

            if (this.settings.stream) {
                const reader = response.body.getReader();
                const decoder = new TextDecoder("utf-8");
                let resultText = '';

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    
                    const chunk = decoder.decode(value, { stream: true });
                    const lines = chunk.split('\n').filter(line => line.trim() !== '');
                    
                    for (const line of lines) {
                        if (line === 'data: [DONE]') return;
                        if (line.startsWith('data: ')) {
                            try {
                                const json = JSON.parse(line.substring(6));
                                const delta = json.choices[0].delta.content;
                                if (delta) {
                                    resultText += delta;
                                    output.value = resultText;
                                    output.scrollTop = output.scrollHeight;
                                }
                            } catch (e) {
                                console.warn('Stream parse error', e);
                            }
                        }
                    }
                }
            } else {
                const data = await response.json();
                output.value = data.choices[0].message.content;
            }

        } catch (error) {
            throw error;
        }
    }

    setLoading(isLoading, text) {
        const btn = document.getElementById('convert');
        if (isLoading) {
            btn.disabled = true;
            btn.innerHTML = `<svg class="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg> ${text}`;
        } else {
            btn.disabled = false;
            btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg> Solve with AI`;
        }
    }

    enableActions(enabled) {
        document.getElementById('copy').disabled = !enabled;
        document.getElementById('download').disabled = !enabled;
    }

    showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = `toast show ${type}`;
        setTimeout(() => toast.className = 'toast hidden', 2000);
    }

    async copyToClipboard() {
        const output = document.getElementById('output');
        try {
            await navigator.clipboard.writeText(output.value);
            this.showToast('Copied!', 'success');
        } catch (e) {
            this.showToast('Copy failed', 'error');
        }
    }
    
    downloadAnswer() {
        const output = document.getElementById('output');
        if (!output.value) return;
        const blob = new Blob([output.value], {type: 'text/markdown'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `solution-${Date.now()}.md`;
        a.click();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new QuickAnswerApp();
});
