// Kyle's AI Agent - 简化版
// 核心功能：AI对话助手，支持任意网页使用

class DeepSeekAssistant {
    constructor() {
        this.apiKey = null;
        this.model = 'deepseek-chat';
        this.conversationHistory = [];
        this.init();
    }

    async init() {
        console.log('🚀 Kyle\'s AI Agent 初始化中...');

        // 获取API配置
        await this.loadSettings();

        // 创建UI
        this.createSidebar();

        // 设置事件监听
        this.setupEventListeners();

        console.log('✅ Kyle\'s AI Agent 初始化完成');
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

    // 创建侧边栏UI
    createSidebar() {
        // 检查是否已存在
        if (document.getElementById('deepseek-ai-sidebar')) {
            console.log('侧边栏已存在，跳过创建');
            return;
        }

        const sidebar = document.createElement('div');
        sidebar.id = 'deepseek-ai-sidebar';
        sidebar.className = 'ds-hidden';
        sidebar.innerHTML = `
            <div class="ds-header">
                <h3>🤖 Kyle's AI Agent</h3>
                <button id="ds-close" title="关闭 (Command+K)">×</button>
            </div>

            <div class="ds-messages" id="ds-messages">
                <div class="ds-message ds-assistant">
                    <p>👋 你好！我是Kyle's AI Agent</p>
                    <p>有什么可以帮你的吗？</p>
                </div>
            </div>

            <div class="ds-thinking" id="ds-thinking" style="display: none;">
                <span class="ds-dot"></span>
                <span class="ds-dot"></span>
                <span class="ds-dot"></span>
                <span>思考中...</span>
            </div>

            <div class="ds-input-area">
                <textarea id="ds-input" placeholder="输入消息..." rows="3"></textarea>
                <button id="ds-send">发送</button>
            </div>
        `;

        // 添加样式
        this.addStyles();

        // 插入页面
        document.body.appendChild(sidebar);

        console.log('✅ 侧边栏UI已创建');
    }

    // 添加样式
    addStyles() {
        if (document.getElementById('deepseek-styles')) return;

        const style = document.createElement('style');
        style.id = 'deepseek-styles';
        style.textContent = `
            /* 侧边栏容器 */
            #deepseek-ai-sidebar {
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

            #deepseek-ai-sidebar.ds-hidden {
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

            #ds-send:hover {
                background: #5568d3;
            }

            #ds-send:active {
                transform: scale(0.98);
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
        // 发送按钮
        const sendBtn = document.getElementById('ds-send');
        const input = document.getElementById('ds-input');
        const closeBtn = document.getElementById('ds-close');

        if (sendBtn) {
            sendBtn.addEventListener('click', () => this.sendMessage());
        }

        // 回车发送（Shift+回车换行）
        if (input) {
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
        }

        // 关闭按钮
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.toggleSidebar());
        }

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
                console.log('✅ 设置已更新');
            }
        });

        console.log('✅ 事件监听器已设置');
    }

    // 切换侧边栏
    toggleSidebar() {
        const sidebar = document.getElementById('deepseek-ai-sidebar');
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

    // 发送消息
    async sendMessage() {
        const input = document.getElementById('ds-input');
        const message = input.value.trim();

        if (!message) {
            alert('请输入消息');
            return;
        }

        if (!this.apiKey) {
            alert('请先在扩展设置中配置API密钥');
            return;
        }

        // 显示用户消息
        this.addMessage(message, 'user');
        input.value = '';

        // 显示思考指示器
        this.showThinking(true);

        try {
            // 调用API
            const response = await this.callAPI(message);

            // 隐藏思考指示器
            this.showThinking(false);

            // 显示AI回复
            this.addMessage(response, 'assistant');

            // 更新对话历史
            this.conversationHistory.push(
                { role: 'user', content: message },
                { role: 'assistant', content: response }
            );

            // 保持历史记录在合理范围
            if (this.conversationHistory.length > 20) {
                this.conversationHistory = this.conversationHistory.slice(-20);
            }

        } catch (error) {
            this.showThinking(false);
            this.addMessage('抱歉，AI服务暂时不可用：' + error.message, 'assistant');
            console.error('API调用失败:', error);
        }
    }

    // 调用DeepSeek API
    async callAPI(userMessage) {
        // 智能系统提示词：支持普通对话和金融产品分析
        const systemPrompt = `你是Kyle's AI Agent，一个金融AI产品分析助手。

**核心能力**：
1. 友好对话：回答问题、闲聊、提供帮助
2. 金融AI产品分析：输出标准TSV格式数据

**TSV输出格式**（仅当用户明确要求分析产品/公司时使用）：
17字段用Tab分隔：公司名称、参考价值、最后更新时间、应用赛道、细分场景、一句点评、成立时间、成立国家、发展阶段、业务模式、服务渠道、官网链接、业务简介、AI相关功能亮点、公开参考资料/链接、使用链接/途径、公司类别

**TSV示例**（AlphaSense 5星标准）：
AlphaSense	5星	-	资产管理	投研助手	华尔街级AI语义检索引擎	2011	美国	D轮及更多	To B	Web	https://www.alpha-sense.com	市场情报搜索平台提供商	NLP语音转录+情感分析标注	https://www.alpha-sense.com	https://www.alpha-sense.com	金融科技公司

**字段规则**：
1. 参考价值：1-5星；应用赛道：银行|保险|信贷|支付|资产管理|财富管理|内部运营|Web3（单选）
2. 发展阶段：种子轮|A轮|B轮|C轮|D轮及更多|上市|成熟期；业务模式：To B|To C|SaaS|平台型
3. 渠道：小程序|APP|Web|产品方案|平台|插件；公司类别：传统金融机构|金融科技公司|大模型厂商|AI-Native初创公司|开源社区项目
4. 一句点评≤20字，最后更新时间固定'-'，成立时间和国家必填不编造，避免'未知'

**重要提示**：
- 普通对话（如"你好"、"在吗"）→ 用自然语言回复，不要输出TSV
- 产品分析请求（如"分析AlphaSense"、"公司XXX"）→ 直接输出TSV，无需表头
- 根据用户意图智能选择回复方式`;

        const messages = [
            {
                role: 'system',
                content: systemPrompt
            },
            ...this.conversationHistory,
            {
                role: 'user',
                content: userMessage
            }
        ];

        // 通过background script调用API
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({
                type: 'CALL_DEEPSEEK_API',
                messages: messages,
                apiKey: this.apiKey,
                model: this.model
            }, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else if (response.success) {
                    const content = response.data?.choices?.[0]?.message?.content;
                    if (content) {
                        resolve(content);
                    } else {
                        reject(new Error('API返回数据格式不正确'));
                    }
                } else {
                    reject(new Error(response.error || '未知错误'));
                }
            });
        });
    }

    // 添加消息到界面
    addMessage(content, role) {
        const container = document.getElementById('ds-messages');
        if (!container) return;

        const messageDiv = document.createElement('div');
        messageDiv.className = `ds-message ds-${role}`;

        // 简单处理换行
        const lines = content.split('\n');
        lines.forEach((line, index) => {
            const p = document.createElement('p');
            p.textContent = line || '\u00A0'; // 空行用空格占位
            messageDiv.appendChild(p);
        });

        container.appendChild(messageDiv);
        container.scrollTop = container.scrollHeight;
    }

    // 显示/隐藏思考指示器
    showThinking(show) {
        const thinking = document.getElementById('ds-thinking');
        if (thinking) {
            thinking.style.display = show ? 'flex' : 'none';
        }
    }
}

// 初始化
if (typeof window.deepseekAssistant === 'undefined') {
    window.deepseekAssistant = new DeepSeekAssistant();
    console.log('✅ Kyle\'s AI Agent 已加载');
}
