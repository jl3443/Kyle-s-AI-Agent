// Kyle's AI Agent - 基于LangChain和React的新架构
// 使用链式处理、记忆管理、工具调用等LangChain概念

class DeepSeekAssistantLangChain {
    constructor() {
        this.langChainAdapter = null;
        this.sidebar = null;
        this.isInitialized = false;
        this.init();
    }

    async init() {
        console.log('🚀 Kyle\'s AI Agent (LangChain版) 初始化中...');

        // 加载API配置
        await this.loadSettings();

        // 初始化LangChain适配器
        if (this.apiKey) {
            this.langChainAdapter = new LangChainAdapter(this.apiKey, this.model);
            console.log('✅ LangChain适配器已初始化');
        }

        // 创建UI（使用React组件）
        this.createSidebar();

        // 设置事件监听
        this.setupEventListeners();

        this.isInitialized = true;
        console.log('✅ Kyle\'s AI Agent (LangChain版) 初始化完成');
    }

    // 加载API设置
    async loadSettings() {
        return new Promise((resolve) => {
            chrome.storage.sync.get(['deepseekApiKey', 'deepseekModel'], (result) => {
                this.apiKey = result.deepseekApiKey;
                this.model = result.deepseekModel || 'deepseek-chat';
                console.log('📦 已加载设置:', {
                    hasApiKey: !!this.apiKey,
                    model: this.model
                });
                resolve();
            });
        });
    }

    // 创建侧边栏UI（使用React组件）
    createSidebar() {
        // 检查是否已存在
        if (document.getElementById('deepseek-ai-sidebar')) {
            console.log('侧边栏已存在，跳过创建');
            return;
        }

        // 添加样式
        this.addStyles();

        // 创建容器
        const container = document.createElement('div');
        container.id = 'deepseek-ai-sidebar-container';
        document.body.appendChild(container);

        // 使用React渲染侧边栏
        // 注意：这里需要根据你选择的React引入方式调整
        if (window.React && window.ReactDOM) {
            // 使用CDN React
            const root = ReactDOM.createRoot(container);
            root.render(React.createElement(AISidebar, {
                langChainAdapter: this.langChainAdapter,
                onClose: () => this.toggleSidebar()
            }));
            this.sidebar = container;
        } else {
            // 使用ReactLike实现
            const sidebarElement = ReactLike.createElement(AISidebar, {
                langChainAdapter: this.langChainAdapter,
                onClose: () => this.toggleSidebar()
            });
            container.appendChild(sidebarElement);
            this.sidebar = container;
        }

        console.log('✅ 侧边栏UI已创建（React组件）');
    }

    // 添加样式
    addStyles() {
        if (document.getElementById('deepseek-styles-langchain')) return;

        const style = document.createElement('style');
        style.id = 'deepseek-styles-langchain';
        style.textContent = `
            /* 侧边栏容器 */
            #deepseek-ai-sidebar, .ds-sidebar {
                position: fixed;
                right: 0;
                top: 0;
                width: 380px;
                height: 100vh;
                background: #ffffff;
                border-left: 1px solid #e0e0e0;
                box-shadow: -2px 0 8px rgba(0,0,0,0.1);
                z-index: 999999;
                display: flex;
                flex-direction: column;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                transition: transform 0.3s ease;
            }

            #deepseek-ai-sidebar.ds-hidden, .ds-sidebar.ds-hidden {
                transform: translateX(100%);
            }

            /* 头部 */
            .ds-header {
                padding: 16px 20px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                display: flex;
                justify-content: space-between;
                align-items: center;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }

            .ds-header h3 {
                margin: 0;
                font-size: 16px;
                font-weight: 600;
            }

            #ds-close {
                background: rgba(255,255,255,0.2);
                border: none;
                color: white;
                width: 28px;
                height: 28px;
                border-radius: 50%;
                font-size: 20px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: background 0.2s;
            }

            #ds-close:hover {
                background: rgba(255,255,255,0.3);
            }

            /* 消息区域 */
            .ds-messages {
                flex: 1;
                padding: 20px;
                overflow-y: auto;
                background: #f8f9fa;
            }

            .ds-message {
                margin-bottom: 16px;
                padding: 12px 16px;
                border-radius: 12px;
                line-height: 1.5;
                font-size: 14px;
                animation: fadeIn 0.3s ease;
            }

            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(10px); }
                to { opacity: 1; transform: translateY(0); }
            }

            .ds-message.ds-user {
                background: #667eea;
                color: white;
                margin-left: 30px;
                border-bottom-right-radius: 4px;
            }

            .ds-message.ds-assistant {
                background: white;
                color: #333;
                margin-right: 30px;
                border: 1px solid #e0e0e0;
                border-bottom-left-radius: 4px;
            }

            .ds-message p {
                margin: 8px 0;
            }

            .ds-message p:first-child {
                margin-top: 0;
            }

            .ds-message p:last-child {
                margin-bottom: 0;
            }

            /* TSV内容样式 */
            .tsv-content {
                margin-top: 8px;
            }

            .tsv-content pre {
                background: #f5f5f5;
                padding: 12px;
                border-radius: 4px;
                overflow: auto;
                font-size: 12px;
                font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
                border: 1px solid #ddd;
            }

            /* 思考指示器 */
            .ds-thinking {
                padding: 12px 20px;
                background: #fff3cd;
                border-top: 1px solid #ffeaa7;
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 13px;
                color: #856404;
            }

            .ds-dot {
                width: 6px;
                height: 6px;
                background: #856404;
                border-radius: 50%;
                animation: bounce 1.4s infinite ease-in-out both;
            }

            .ds-dot:nth-child(1) { animation-delay: -0.32s; }
            .ds-dot:nth-child(2) { animation-delay: -0.16s; }

            @keyframes bounce {
                0%, 80%, 100% { transform: scale(0); }
                40% { transform: scale(1); }
            }

            /* 输入区域 */
            .ds-input-area {
                padding: 16px 20px;
                background: white;
                border-top: 1px solid #e0e0e0;
                display: flex;
                gap: 12px;
            }

            #ds-input {
                flex: 1;
                padding: 10px 12px;
                border: 1px solid #ddd;
                border-radius: 8px;
                font-size: 14px;
                font-family: inherit;
                resize: none;
                transition: border-color 0.2s;
            }

            #ds-input:focus {
                outline: none;
                border-color: #667eea;
            }

            #ds-send {
                padding: 10px 24px;
                background: #667eea;
                color: white;
                border: none;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                transition: background 0.2s;
            }

            #ds-send:hover:not(:disabled) {
                background: #5568d3;
            }

            #ds-send:disabled {
                background: #ccc;
                cursor: not-allowed;
            }

            #ds-send:active:not(:disabled) {
                transform: scale(0.98);
            }

            /* 错误提示 */
            .ds-error {
                padding: 12px 20px;
                background: #f8d7da;
                color: #721c24;
                border-top: 1px solid #f5c6cb;
                font-size: 13px;
            }

            /* 滚动条样式 */
            .ds-messages::-webkit-scrollbar {
                width: 6px;
            }

            .ds-messages::-webkit-scrollbar-track {
                background: #f1f1f1;
            }

            .ds-messages::-webkit-scrollbar-thumb {
                background: #ccc;
                border-radius: 3px;
            }

            .ds-messages::-webkit-scrollbar-thumb:hover {
                background: #999;
            }
        `;

        document.head.appendChild(style);
    }

    // 设置事件监听
    setupEventListeners() {
        // 快捷键 Command+K / Ctrl+K
        document.addEventListener('keydown', (e) => {
            const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
            const modifierKey = isMac ? e.metaKey : e.ctrlKey;

            if (modifierKey && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                this.toggleSidebar();
            }
        });

        // 监听设置更新
        chrome.runtime.onMessage.addListener((request) => {
            if (request.type === 'SETTINGS_UPDATED') {
                this.apiKey = request.apiKey;
                this.model = request.model;
                
                // 重新初始化LangChain适配器
                if (this.apiKey) {
                    this.langChainAdapter = new LangChainAdapter(this.apiKey, this.model);
                    console.log('✅ LangChain适配器已更新');
                }
            }
        });

        console.log('✅ 事件监听器已设置');
    }

    // 切换侧边栏
    toggleSidebar() {
        const sidebar = document.getElementById('deepseek-ai-sidebar') || 
                       document.querySelector('.ds-sidebar');
        if (!sidebar) return;

        sidebar.classList.toggle('ds-hidden');

        // 如果显示，聚焦输入框
        if (!sidebar.classList.contains('ds-hidden')) {
            const input = document.getElementById('ds-input');
            if (input) {
                setTimeout(() => input.focus(), 100);
            }
        }
    }
}

// 初始化
if (typeof window.deepseekAssistantLangChain === 'undefined') {
    // 等待依赖加载完成
    if (typeof LangChainAdapter !== 'undefined' && typeof AISidebar !== 'undefined') {
        window.deepseekAssistantLangChain = new DeepSeekAssistantLangChain();
        console.log('✅ Kyle\'s AI Agent (LangChain版) 已加载');
    } else {
        // 延迟初始化
        window.addEventListener('load', () => {
            if (typeof LangChainAdapter !== 'undefined' && typeof AISidebar !== 'undefined') {
                window.deepseekAssistantLangChain = new DeepSeekAssistantLangChain();
                console.log('✅ Kyle\'s AI Agent (LangChain版) 已加载（延迟）');
            }
        });
    }
}

