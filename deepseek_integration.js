// DeepSeek LLM 集成到腾讯文档的Chrome扩展
// 主要功能：在腾讯文档右侧注入AI对话框，调用DeepSeek API

class DeepSeekAssistant {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.apiUrl = 'https://api.deepseek.com/v1/chat/completions';
        this.conversationHistory = [];
        this.isInitialized = false;
    }

    // 初始化AI助手界面
    init() {
        if (this.isInitialized) return;
        
        // AI助手可在任何网页使用
        console.log('当前页面:', window.location.href);
        console.log('AI助手可在任何网页使用');

        this.createAISidebar();
        // 延迟设置事件监听，确保DOM元素已创建
        setTimeout(() => {
            this.setupEventListeners();
        }, 100);
        this.isInitialized = true;
        console.log('DeepSeek AI助手已初始化');
    }

    // 创建AI侧边栏
    createAISidebar() {
        console.log('开始创建AI侧边栏');
        
        // 检查是否已经存在
        const existingSidebar = document.getElementById('deepseek-ai-sidebar');
        if (existingSidebar) {
            console.log('AI侧边栏已存在，移除旧的');
            existingSidebar.remove();
        }
        
        // 创建侧边栏容器
        const sidebar = document.createElement('div');
        sidebar.id = 'deepseek-ai-sidebar';
        sidebar.innerHTML = `
            <div class="ai-sidebar-header">
                <h3>🐧 Kyle's AI Agent</h3>
                <button id="toggle-sidebar">−</button>
            </div>
            <div class="ai-model-selector">
                <label for="model-select">模型选择:</label>
                <select id="model-select">
                    <option value="deepseek-chat" selected>💬 DeepSeek-V3.1 Non-thinking (推荐)</option>
                    <option value="deepseek-coder">💻 DeepSeek Coder</option>
                    <option value="deepseek-reasoner">🧠 DeepSeek-V3.1 Thinking Mode (费用高)</option>
                </select>
            </div>
            <div class="ai-chat-container">
                <div class="ai-messages" id="ai-messages">
                    <div class="ai-message assistant">
                        <p>👋 您好！我是DeepSeek AI智能助手，可以帮您分析任何网页内容。</p>
                        <p>我可以：分析页面数据、回答问题、提供建议、解释内容等。</p>
                        <p>请告诉我您想了解什么？</p>
                    </div>
                </div>
                <div class="ai-thinking-indicator" id="ai-thinking" style="display: none;">
                    <div class="thinking-content">
                        <div class="thinking-animation">
                            <div class="thinking-dots">
                                <span></span><span></span><span></span>
                            </div>
                            <span class="thinking-text">AI正在思考中...</span>
                        </div>
                        <div class="thinking-progress">
                            <div class="progress-bar">
                                <div class="progress-fill" id="thinking-progress-fill"></div>
                            </div>
                            <span class="progress-text" id="thinking-progress-text">0%</span>
                        </div>
                    </div>
                </div>
                <div class="ai-input-container">
                    <textarea id="ai-input" placeholder="问我关于这个页面的任何问题..."></textarea>
                    <button id="ai-send" onclick="window.deepseekAssistant.sendMessage()">发送</button>
                </div>
            </div>
            <div class="ai-suggestions" id="ai-suggestions">
                <!-- AI建议将显示在这里 -->
            </div>
        `;

        // 添加样式
        this.addStyles();
        
        // 插入到页面
        document.body.appendChild(sidebar);
        
        console.log('AI侧边栏已创建并添加到页面');
        
        // 验证是否成功添加
        const addedSidebar = document.getElementById('deepseek-ai-sidebar');
        if (addedSidebar) {
            console.log('AI侧边栏验证成功');
        } else {
            console.error('AI侧边栏创建失败');
        }
    }

    // 添加CSS样式
    addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            #deepseek-ai-sidebar {
                position: fixed;
                right: 0;
                top: 0;
                width: 350px;
                height: 100vh;
                background: #ffffff;
                border-left: 1px solid #e0e0e0;
                box-shadow: -2px 0 10px rgba(0,0,0,0.1);
                z-index: 10000;
                display: flex;
                flex-direction: column;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }

            .ai-sidebar-header {
                padding: 16px;
                border-bottom: 1px solid #e0e0e0;
                background: #f8f9fa;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .ai-sidebar-header h3 {
                margin: 0;
                font-size: 14px;
                color: #333;
            }

            #toggle-sidebar {
                background: none;
                border: none;
                font-size: 18px;
                cursor: pointer;
                padding: 4px 8px;
                border-radius: 4px;
            }

            #toggle-sidebar:hover {
                background: #e9ecef;
            }

            .ai-chat-container {
                flex: 1;
                display: flex;
                flex-direction: column;
                overflow: hidden;
            }

            .ai-messages {
                flex: 1;
                padding: 16px;
                overflow-y: auto;
                max-height: 60vh;
            }

            .ai-message {
                margin-bottom: 16px;
                padding: 12px;
                border-radius: 8px;
                line-height: 1.4;
                font-size: 14px;
            }

            .ai-message.user {
                background: #e3f2fd;
                margin-left: 20px;
            }

            .ai-message.assistant {
                background: #f5f5f5;
                margin-right: 20px;
            }

            .ai-input-container {
                padding: 16px;
                border-top: 1px solid #e0e0e0;
                display: flex;
                gap: 8px;
            }

            #ai-input {
                flex: 1;
                border: 1px solid #ddd;
                border-radius: 6px;
                padding: 8px 12px;
                resize: none;
                font-size: 14px;
                min-height: 36px;
                max-height: 100px;
            }

            #ai-input:focus {
                outline: none;
                border-color: #007bff;
            }

            #ai-send {
                background: #007bff;
                color: white;
                border: none;
                border-radius: 6px;
                padding: 8px 16px;
                cursor: pointer;
                font-size: 14px;
            }

            #ai-send:hover {
                background: #0056b3;
            }

            /* 模型选择器样式 */
            .ai-model-selector {
                padding: 12px 16px;
                border-bottom: 1px solid #e0e0e0;
                background: #f8f9fa;
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 13px;
            }

            .ai-model-selector label {
                font-weight: 500;
                color: #555;
                white-space: nowrap;
            }

            #model-select {
                flex: 1;
                border: 1px solid #ddd;
                border-radius: 4px;
                padding: 4px 8px;
                font-size: 12px;
                background: white;
            }

            /* 思考指示器样式 */
            .ai-thinking-indicator {
                padding: 16px;
                border-bottom: 1px solid #e0e0e0;
                background: #fff3cd;
                border-left: 4px solid #ffc107;
            }

            .thinking-content {
                display: flex;
                flex-direction: column;
                gap: 10px;
            }

            .thinking-animation {
                display: flex;
                align-items: center;
                gap: 10px;
            }

            .thinking-dots {
                display: flex;
                gap: 4px;
            }

            .thinking-dots span {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background: #007bff;
                animation: thinking-pulse 1.4s infinite ease-in-out both;
            }

            .thinking-dots span:nth-child(1) { animation-delay: -0.32s; }
            .thinking-dots span:nth-child(2) { animation-delay: -0.16s; }
            .thinking-dots span:nth-child(3) { animation-delay: 0s; }

            @keyframes thinking-pulse {
                0%, 80%, 100% { 
                    transform: scale(0.8);
                    opacity: 0.5;
                }
                40% { 
                    transform: scale(1);
                    opacity: 1;
                }
            }

            .thinking-text {
                font-size: 14px;
                color: #856404;
                font-weight: 500;
            }

            .thinking-progress {
                display: flex;
                align-items: center;
                gap: 10px;
            }

            .progress-bar {
                flex: 1;
                height: 6px;
                background: #e9ecef;
                border-radius: 3px;
                overflow: hidden;
            }

            .progress-fill {
                height: 100%;
                background: linear-gradient(90deg, #007bff, #0056b3);
                border-radius: 3px;
                transition: width 0.3s ease;
                width: 0%;
            }

            .progress-text {
                font-size: 12px;
                color: #856404;
                font-weight: 500;
                min-width: 35px;
                text-align: right;
            }


            .ai-suggestions {
                border-top: 1px solid #e0e0e0;
                max-height: 200px;
                overflow-y: auto;
            }

            .ai-suggestion {
                padding: 12px 16px;
                border-bottom: 1px solid #f0f0f0;
                cursor: pointer;
                font-size: 13px;
            }

            .ai-suggestion:hover {
                background: #f8f9fa;
            }

            .ai-suggestion.accepted {
                background: #d4edda;
                color: #155724;
            }

            .ai-suggestion.rejected {
                background: #f8d7da;
                color: #721c24;
            }

            .suggestion-actions {
                margin-top: 8px;
                display: flex;
                gap: 8px;
            }

            .suggestion-btn {
                padding: 4px 12px;
                border: none;
                border-radius: 4px;
                font-size: 12px;
                cursor: pointer;
            }

            .accept-btn {
                background: #28a745;
                color: white;
            }

            .reject-btn {
                background: #dc3545;
                color: white;
            }
        `;
        document.head.appendChild(style);
    }

    // 设置事件监听
    setupEventListeners() {
        console.log('开始设置事件监听器');
        
        // 发送消息
        const sendBtn = document.getElementById('ai-send');
        const inputField = document.getElementById('ai-input');
        
        if (sendBtn && inputField) {
            console.log('✅ 找到发送按钮和输入框，绑定事件');
            
            sendBtn.addEventListener('click', () => {
                console.log('发送按钮被点击');
                this.sendMessage();
            });

            // 回车发送
            inputField.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    console.log('回车键发送消息');
                    this.sendMessage();
                }
            });
        } else {
            console.error('❌ 未找到发送按钮或输入框', {sendBtn, inputField});
            // 重试设置事件监听
            setTimeout(() => {
                console.log('重试设置事件监听器');
                this.setupEventListeners();
            }, 500);
        }

        // 切换侧边栏
        const toggleBtn = document.getElementById('toggle-sidebar');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                this.toggleSidebar();
            });
        }

        // 监听表格变化（自动分析）
        this.observeTableChanges();
    }

    // 发送消息到DeepSeek
    async sendMessage() {
        console.log('🚀 sendMessage方法被调用');
        
        const input = document.getElementById('ai-input');
        if (!input) {
            console.error('❌ 未找到输入框元素');
            alert('未找到输入框！');
            return;
        }
        
        const message = input.value.trim();
        console.log('📝 用户输入的消息:', message);
        
        if (!message) {
            console.log('⚠️ 消息为空，不发送');
            alert('请输入消息！');
            return;
        }

        // 获取选择的模型，默认使用更便宜的chat模型
        const modelSelect = document.getElementById('model-select');
        const selectedModel = modelSelect ? modelSelect.value : 'deepseek-chat';
        console.log('🤖 选择的模型:', selectedModel);

        // 显示用户消息
        this.addMessage(message, 'user');
        input.value = '';

        // 显示思考指示器
        this.showThinkingIndicator();

        // 获取表格数据作为上下文
        const tableData = this.extractTableData();
        
        try {
            // 调用DeepSeek API
            const response = await this.callDeepSeekAPI(message, tableData, selectedModel);
            
            // 隐藏思考指示器
            this.hideThinkingIndicator();
            
            // 显示AI回复
            this.addMessage(response.content, 'assistant');
            
            // 检查是否有建议
            if (response.suggestions && response.suggestions.length > 0) {
                this.processSuggestions(response.suggestions);
            }
            
            // 更新对话历史（只有成功的API调用才更新）
            if (!response.content.includes('抱歉，AI服务暂时无法连接')) {
                this.conversationHistory.push(
                    { role: "user", content: message },
                    { role: "assistant", content: response.content }
                );
                
                // 保持历史记录在合理范围内
                if (this.conversationHistory.length > 10) {
                    this.conversationHistory = this.conversationHistory.slice(-10);
                }
            }
            
        } catch (error) {
            console.error('DeepSeek API调用失败:', error);
            this.hideThinkingIndicator();
            this.addMessage('抱歉，AI服务暂时不可用。请稍后重试。', 'assistant');
        }
    }

    // 显示思考指示器
    showThinkingIndicator() {
        const thinkingIndicator = document.getElementById('ai-thinking');
        if (thinkingIndicator) {
            thinkingIndicator.style.display = 'block';
            
            // 启动进度条动画
            this.startThinkingProgress();
            
            // 滚动到思考指示器
            thinkingIndicator.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    // 隐藏思考指示器
    hideThinkingIndicator() {
        const thinkingIndicator = document.getElementById('ai-thinking');
        if (thinkingIndicator) {
            thinkingIndicator.style.display = 'none';
        }
        
        // 停止进度条动画
        this.stopThinkingProgress();
    }

    // 启动思考进度条
    startThinkingProgress() {
        const progressFill = document.getElementById('thinking-progress-fill');
        const progressText = document.getElementById('thinking-progress-text');
        
        if (!progressFill || !progressText) return;
        
        let progress = 0;
        
        this.thinkingInterval = setInterval(() => {
            progress += Math.random() * 8 + 2; // 随机增长2-10%，更慢一些
            if (progress > 90) progress = 90; // 最多到90%，等API返回再到100%
            
            progressFill.style.width = progress + '%';
            progressText.textContent = Math.round(progress) + '%';
        }, 1000); // 每1秒更新一次，更稳定
    }

    // 停止思考进度条
    stopThinkingProgress() {
        if (this.thinkingInterval) {
            clearInterval(this.thinkingInterval);
            this.thinkingInterval = null;
        }
        
        // 完成进度条
        const progressFill = document.getElementById('thinking-progress-fill');
        const progressText = document.getElementById('thinking-progress-text');
        if (progressFill && progressText) {
            progressFill.style.width = '100%';
            progressText.textContent = '100%';
        }
    }

    // 调用DeepSeek API
    async callDeepSeekAPI(userMessage, tableData, model = 'deepseek-reasoner') {
        // 生成动态知识库上下文
        let knowledgeContext = '';
        if (window.knowledgeBase) {
            knowledgeContext = window.knowledgeBase.generateContext(userMessage, tableData);
        }

        const messages = [
            {
                role: "system",
                content: `你是金融AI产品案例库助手。简洁回答用户问题，分析页面内容。

当前页面：${tableData.title}
数据：${JSON.stringify(tableData).substring(0, 200)}...

请用中文简洁回答，不超过200字。`
            },
            ...this.conversationHistory,
            {
              role: "user",
              content: userMessage
            }
          ];

        // 尝试多种方法调用API
        console.log('🔄 开始调用DeepSeek API');
        let response;
        
        try {
            // 方法1：尝试直接调用（可能被CSP阻止）
            console.log('尝试方法1：直接API调用');
            response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: model,
                    messages: messages,
                    temperature: 0.7,
                    max_tokens: model === 'deepseek-reasoner' ? 800 : 500  // 大幅降低token限制节省费用
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                const aiResponse = data.choices[0].message.content;
                console.log('✅ 直接API调用成功');
                return { content: aiResponse, suggestions: [] };
            }
        } catch (error) {
            console.log('❌ 直接API调用失败:', error.message);
        }
        
        try {
            // 方法2：通过本地代理服务器
            console.log('尝试方法2：本地代理服务器');
            response = await fetch('http://localhost:3001/api/deepseek', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: userMessage,
                    apiKey: this.apiKey,
                    model: model,
                    tableData: tableData
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    console.log('✅ 本地代理调用成功');
                    return { content: data.message, suggestions: [] };
                }
            }
        } catch (error) {
            console.log('❌ 本地代理调用失败:', error.message);
        }
        
        // 方法3：智能提示用户
        console.log('⚠️ 所有API调用方法都失败，提供解决方案');
        const helpMessage = `抱歉，AI服务暂时无法连接。

🔧 解决方案：
1. 检查API密钥是否正确
2. 启动本地代理服务器：
   - 下载并安装 Node.js
   - 在项目目录运行：npm install && npm start
   - 确保服务器在 localhost:3001 运行

💡 或者联系管理员获取帮助。

您的问题："${userMessage}"已记录，服务恢复后会自动处理。`;

        return { content: helpMessage, suggestions: [] };
    }

    // 提取页面数据（表格、列表、文本等）
    extractTableData() {
        const pageData = {
            url: window.location.href,
            title: document.title,
            tables: [],
            lists: [],
            mainContent: ''
        };

        // 1. 提取表格数据
        const tables = document.querySelectorAll('table');
        tables.forEach((table, index) => {
            const headers = [];
            const rows = [];

            // 提取表头
            const headerCells = table.querySelectorAll('th');
            headerCells.forEach(cell => {
                headers.push(cell.textContent.trim());
            });

            // 提取数据行
            const dataRows = table.querySelectorAll('tbody tr, tr');
            dataRows.forEach(row => {
                const rowData = [];
                const cells = row.querySelectorAll('td, th');
                cells.forEach(cell => {
                    rowData.push(cell.textContent.trim());
                });
                if (rowData.length > 0 && !headers.includes(rowData.join(''))) {
                    rows.push(rowData);
                }
            });

            if (headers.length > 0 || rows.length > 0) {
                pageData.tables.push({
                    index: index,
                    headers: headers,
                    rows: rows
                });
            }
        });

        // 2. 提取列表数据
        const lists = document.querySelectorAll('ul, ol');
        lists.forEach((list, index) => {
            const items = [];
            const listItems = list.querySelectorAll('li');
            listItems.forEach(item => {
                const text = item.textContent.trim();
                if (text && text.length < 200) { // 避免过长的文本
                    items.push(text);
                }
            });
            if (items.length > 0) {
                pageData.lists.push({
                    index: index,
                    type: list.tagName.toLowerCase(),
                    items: items.slice(0, 10) // 限制条目数量
                });
            }
        });

        // 3. 提取主要文本内容
        const contentSelectors = [
            'main', 'article', '.content', '.main-content', 
            '#content', '#main', '.post-content', '.entry-content'
        ];
        
        let mainContent = '';
        for (const selector of contentSelectors) {
            const element = document.querySelector(selector);
            if (element) {
                mainContent = element.textContent.trim().substring(0, 1000); // 限制长度
                break;
            }
        }
        
        // 如果没有找到特定内容区域，提取页面主体文本
        if (!mainContent) {
            const bodyText = document.body.textContent.trim();
            mainContent = bodyText.substring(0, 500); // 更短的摘要
        }
        
        pageData.mainContent = mainContent;

        console.log('📊 提取的页面数据:', pageData);
        return pageData;
    }

    // 添加消息到聊天界面
    addMessage(content, role) {
        const messagesContainer = document.getElementById('ai-messages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `ai-message ${role}`;
        messageDiv.textContent = content;
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // 处理AI建议
    processSuggestions(suggestions) {
        if (!suggestions || suggestions.length === 0) return;

        const suggestionsContainer = document.getElementById('ai-suggestions');
        suggestionsContainer.innerHTML = '';

        suggestions.forEach((suggestion, index) => {
            const suggestionDiv = document.createElement('div');
            suggestionDiv.className = 'ai-suggestion';
            suggestionDiv.innerHTML = `
                <div>${suggestion.description}</div>
                <div class="suggestion-actions">
                    <button class="suggestion-btn accept-btn" onclick="deepseekAssistant.acceptSuggestion(${index})">
                        接受
                    </button>
                    <button class="suggestion-btn reject-btn" onclick="deepseekAssistant.rejectSuggestion(${index})">
                        拒绝
                    </button>
                </div>
            `;
            suggestionsContainer.appendChild(suggestionDiv);
        });

        this.currentSuggestions = suggestions;
    }

    // 接受建议
    acceptSuggestion(index) {
        const suggestion = this.currentSuggestions[index];
        // 这里实现具体的建议执行逻辑
        console.log('接受建议:', suggestion);
        
        // 标记为已接受
        const suggestionElements = document.querySelectorAll('.ai-suggestion');
        if (suggestionElements[index]) {
            suggestionElements[index].classList.add('accepted');
        }
    }

    // 拒绝建议
    rejectSuggestion(index) {
        const suggestion = this.currentSuggestions[index];
        console.log('拒绝建议:', suggestion);
        
        // 标记为已拒绝
        const suggestionElements = document.querySelectorAll('.ai-suggestion');
        if (suggestionElements[index]) {
            suggestionElements[index].classList.add('rejected');
        }
    }

    // 切换侧边栏显示/隐藏
    toggleSidebar() {
        const sidebar = document.getElementById('deepseek-ai-sidebar');
        const isHidden = sidebar.style.transform === 'translateX(100%)';
        
        if (isHidden) {
            sidebar.style.transform = 'translateX(0)';
            document.getElementById('toggle-sidebar').textContent = '−';
        } else {
            sidebar.style.transform = 'translateX(100%)';
            document.getElementById('toggle-sidebar').textContent = '+';
        }
    }

    // 监听表格变化
    observeTableChanges() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList' || mutation.type === 'characterData') {
                    // 表格内容发生变化，可以触发自动分析
                    this.onTableChanged();
                }
            });
        });

        // 观察整个文档的变化
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true
        });
    }

    // 表格变化处理
    onTableChanged() {
        // 这里可以实现自动分析逻辑
        console.log('表格内容发生变化');
        
        // 例如：自动提供建议
        setTimeout(() => {
            this.autoSuggest();
        }, 1000); // 延迟1秒，避免频繁触发
    }

    // 自动建议
    async autoSuggest() {
        const tableData = this.extractTableData();
        if (tableData.length === 0) return;

        // 自动分析表格并提供建议
        try {
            const response = await this.callDeepSeekAPI(
                '请分析当前表格数据，提供有用的建议', 
                tableData
            );
            
            if (response.suggestions && response.suggestions.length > 0) {
                this.processSuggestions(response.suggestions);
            }
        } catch (error) {
            console.error('自动建议失败:', error);
        }
    }
}

// 初始化DeepSeek助手
let deepseekAssistant;

console.log('DeepSeek扩展脚本已加载');

// 页面加载完成后初始化
function initDeepSeekAssistant() {
    console.log('开始初始化DeepSeek助手');
    
    // AI助手支持所有网页
    console.log('当前网页:', window.location.href);
    console.log('AI助手支持所有网页，开始初始化');
    
    console.log('继续初始化AI助手');
    
    // 从Chrome扩展存储中获取API密钥
    if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.sync.get(['deepseekApiKey'], (result) => {
            console.log('获取到API密钥:', result.deepseekApiKey ? '已设置' : '未设置');
            if (result.deepseekApiKey) {
                window.deepseekAssistant = new DeepSeekAssistant(result.deepseekApiKey);
                window.deepseekAssistant.init();
                console.log('✅ DeepSeek助手初始化完成');
            } else {
                console.warn('DeepSeek API密钥未设置');
                // 即使没有API密钥也显示界面，让用户可以设置
                window.deepseekAssistant = new DeepSeekAssistant('');
                window.deepseekAssistant.init();
                console.log('✅ AI助手界面已显示（待设置API密钥）');
                // 显示提示用户设置API密钥
                showApiKeyPrompt();
            }
        });
    } else {
        console.error('Chrome扩展API不可用');
    }
}

// 显示API密钥设置提示
function showApiKeyPrompt() {
    const promptDiv = document.createElement('div');
    promptDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #ff4444;
        color: white;
        padding: 15px;
        border-radius: 8px;
        z-index: 99999;
        max-width: 300px;
        font-family: Arial, sans-serif;
        font-size: 14px;
    `;
    promptDiv.innerHTML = `
        <strong>DeepSeek AI助手</strong><br>
        请先设置API密钥才能使用AI功能<br>
        <button onclick="this.parentElement.remove()" style="margin-top: 10px; padding: 5px 10px; border: none; border-radius: 4px; cursor: pointer;">知道了</button>
    `;
    document.body.appendChild(promptDiv);
    
    // 5秒后自动消失
    setTimeout(() => {
        if (promptDiv.parentElement) {
            promptDiv.remove();
        }
    }, 5000);
}

// 监听来自popup的设置更新消息
if (typeof chrome !== 'undefined' && chrome.runtime) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        console.log('收到消息:', message);
        if (message.type === 'SETTINGS_UPDATED') {
            console.log('设置已更新，重新初始化AI助手');
            // 更新API密钥并重新初始化
            if (window.deepseekAssistant) {
                window.deepseekAssistant.apiKey = message.apiKey;
                console.log('✅ API密钥已更新');
            } else {
                // 如果助手还未初始化，现在初始化
                window.deepseekAssistant = new DeepSeekAssistant(message.apiKey);
                window.deepseekAssistant.init();
                console.log('✅ AI助手重新初始化完成');
            }
            sendResponse({success: true});
        }
    });
}

// 多种方式确保初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDeepSeekAssistant);
} else {
    initDeepSeekAssistant();
}

// 延迟初始化，确保页面完全加载
setTimeout(initDeepSeekAssistant, 2000);

// 强制初始化（调试用）
setTimeout(() => {
    console.log('🔧 强制检查AI助手状态...');
    if (!document.getElementById('deepseek-ai-sidebar')) {
        console.log('⚠️ AI侧边栏未找到，强制创建');
        // 强制创建AI助手
        if (!window.deepseekAssistant) {
            console.log('创建新的DeepSeek助手实例');
            window.deepseekAssistant = new DeepSeekAssistant('');
        }
        window.deepseekAssistant.createAISidebar();
        console.log('✅ AI侧边栏强制创建完成');
    } else {
        console.log('✅ AI侧边栏已存在');
    }
}, 5000);

// 监听页面变化（SPA应用）
let lastUrl = location.href;
new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
        lastUrl = url;
        console.log('页面URL变化，重新初始化');
        setTimeout(initDeepSeekAssistant, 1000);
    }
}).observe(document, { subtree: true, childList: true });
