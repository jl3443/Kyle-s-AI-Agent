// DeepSeek LLM 集成到腾讯文档的Chrome扩展
// 主要功能：在腾讯文档右侧注入AI对话框，调用DeepSeek API

// 表格编辑器类 - 专门处理17字段表格
class TableEditor {
    constructor() {
        // 基于您的表格结构定义字段
        this.editableFields = [
            '公司名称', '参考价值', '最后更新时间', '应用场景', '组织/环境',
            '一句点评', '成立时间', '成立国家', '发展阶段', '业务模式',
            '服务连接', '业务简介', 'AI相关功能实况', '公司参考资料/链接',
            '使用链接/途径', '公司类别', '最后编辑新人'
        ];
        
        // 字段优先级（数字越小优先级越高）
        this.fieldPriority = {
            '公司名称': 1, '一句点评': 2, '成立时间': 3, '成立国家': 4,
            '发展阶段': 5, '业务模式': 6, '业务简介': 7, 'AI相关功能实况': 8,
            '参考价值': 9, '应用场景': 10, '公司类别': 11, '使用链接/途径': 12,
            '服务连接': 13, '公司参考资料/链接': 14, '组织/环境': 15, 
            '最后更新时间': 16, '最后编辑新人': 17
        };
        
        this.tencentDocsAdapter = new TencentDocsAdapter();
    }

    // 智能识别缺失字段
    identifyMissingFields(tableData) {
        const missingFields = [];
        
        if (!tableData.tables || tableData.tables.length === 0) {
            return missingFields;
        }

        tableData.tables.forEach((table, tableIndex) => {
            table.rows.forEach((row, rowIndex) => {
                row.forEach((cellValue, colIndex) => {
                    const headerName = table.headers[colIndex] || `列${colIndex + 1}`;
                    
                    // 检查是否为空值或占位符
                    const isEmpty = !cellValue || 
                                   cellValue.trim() === '' || 
                                   cellValue.trim() === '-' ||
                                   cellValue.trim() === '待补充' ||
                                   cellValue.trim() === '...' ||
                                   cellValue.trim() === 'TBD' ||
                                   cellValue.trim() === '○';
                    
                    if (isEmpty && this.editableFields.includes(headerName)) {
                        const companyContext = this.getRowContext(table, rowIndex);
                        
                        // 只有在有公司名称的情况下才添加缺失字段
                        if (companyContext['公司名称'] && companyContext['公司名称'].trim()) {
                            missingFields.push({
                                tableIndex,
                                rowIndex,
                                colIndex,
                                fieldName: headerName,
                                currentValue: cellValue,
                                companyContext: companyContext,
                                priority: this.fieldPriority[headerName] || 99
                            });
                        }
                    }
                });
            });
        });

        // 按优先级排序
        return missingFields.sort((a, b) => a.priority - b.priority);
    }

    // 获取行的上下文信息
    getRowContext(table, rowIndex) {
        const context = {};
        const row = table.rows[rowIndex];
        
        table.headers.forEach((header, index) => {
            if (row[index] && row[index].trim() && row[index].trim() !== '-') {
                context[header] = row[index].trim();
            }
        });
        
        return context;
    }

    // 查找单元格DOM元素
    findCellForField(missingField) {
        const tableElements = document.querySelectorAll('table');
        if (tableElements[missingField.tableIndex]) {
            const table = tableElements[missingField.tableIndex];
            const rows = table.querySelectorAll('tr');
            if (rows[missingField.rowIndex + 1]) { // +1 因为第一行通常是表头
                const cells = rows[missingField.rowIndex + 1].querySelectorAll('td, th');
                return cells[missingField.colIndex];
            }
        }
        return null;
    }

    // 检查单元格是否可编辑
    isCellEditable(cellElement) {
        if (!cellElement) return false;
        
        return cellElement.contentEditable === 'true' || 
               cellElement.tagName === 'INPUT' ||
               cellElement.tagName === 'TEXTAREA' ||
               cellElement.querySelector('input, textarea, [contenteditable="true"]') !== null;
    }

    // 填充单元格内容
    async fillCell(cellElement, content) {
        if (!cellElement || !content) return false;

        try {
            return await this.tencentDocsAdapter.editCell(cellElement, content);
        } catch (error) {
            console.error('填充单元格失败:', error);
            return false;
        }
    }
}

// 腾讯文档适配器类
class TencentDocsAdapter {
    constructor() {
        this.docType = this.detectDocumentType();
        console.log('检测到文档类型:', this.docType);
    }

    detectDocumentType() {
        if (document.querySelector('.ql-editor, .sheets-container')) return 'spreadsheet';
        if (document.querySelector('.docs-texteventtarget-iframe, .kix-appview-editor')) return 'document';
        if (document.querySelector('.online-table, .table-container')) return 'table';
        return 'general';
    }

    // 获取可编辑单元格
    getEditableCells() {
        const selectors = {
            'spreadsheet': [
                '.ql-editor [data-cell]',
                '.cell-input',
                '.sheets-cell',
                'td[contenteditable="true"]'
            ],
            'document': [
                'td[contenteditable="true"]',
                '.docs-table-cell',
                '.kix-table-cell',
                'table td'
            ],
            'general': [
                'td[contenteditable="true"]',
                'table td',
                '[data-cell]',
                '.editable-cell'
            ]
        };

        const cellSelectors = selectors[this.docType] || selectors['general'];
        let cells = [];

        for (const selector of cellSelectors) {
            const foundCells = document.querySelectorAll(selector);
            if (foundCells.length > 0) {
                cells = [...foundCells];
                console.log(`找到 ${cells.length} 个可编辑单元格`);
                break;
            }
        }

        return cells;
    }

    // 编辑单元格内容
    async editCell(cellElement, newContent) {
        if (!cellElement || !newContent) return false;

        try {
            console.log('开始编辑单元格:', newContent);

            // 聚焦到单元格
            cellElement.focus();
            cellElement.click();

            // 等待确保单元格进入编辑状态
            await new Promise(resolve => setTimeout(resolve, 100));

            // 根据元素类型选择编辑方法
            if (cellElement.contentEditable === 'true') {
                cellElement.textContent = newContent;
                const inputEvent = new Event('input', { bubbles: true });
                cellElement.dispatchEvent(inputEvent);
            } else if (cellElement.tagName === 'INPUT' || cellElement.tagName === 'TEXTAREA') {
                cellElement.value = newContent;
                const changeEvent = new Event('change', { bubbles: true });
                cellElement.dispatchEvent(changeEvent);
            } else {
                // 查找内部可编辑元素
                const editableChild = cellElement.querySelector('input, textarea, [contenteditable="true"]');
                if (editableChild) {
                    if (editableChild.contentEditable === 'true') {
                        editableChild.textContent = newContent;
                    } else {
                        editableChild.value = newContent;
                    }
                    const event = new Event('input', { bubbles: true });
                    editableChild.dispatchEvent(event);
                } else {
                    cellElement.textContent = newContent;
                }
            }

            // 模拟Enter键确认
            const enterEvent = new KeyboardEvent('keydown', { 
                key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true 
            });
            cellElement.dispatchEvent(enterEvent);

            // 失去焦点
            cellElement.blur();

            console.log('单元格编辑完成');
            return true;

        } catch (error) {
            console.error('编辑单元格失败:', error);
            return false;
        }
    }
}

class DeepSeekAssistant {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.apiUrl = 'https://api.deepseek.com/v1/chat/completions';
        this.conversationHistory = [];
        this.isInitialized = false;
        
        // 新增：表格编辑功能
        this.tableEditor = new TableEditor();
        this.pendingChanges = [];
        
        // 移除API调用限制，按用户要求
        
        // 针对您的表格字段定义补全规则
        this.fieldCompletionRules = {
            '公司名称': { 
                required: true, 
                prompt: '根据上下文信息，提供准确的公司名称',
                maxLength: 50
            },
            '参考价值': { 
                required: true, 
                prompt: '评估该公司的参考价值，从以下选项中选择',
                options: ['✓', '高', '中', '低', '○']
            },
            '最后更新时间': { 
                required: false, 
                prompt: '提供最后更新时间，格式为YYYY/MM/DD',
                validation: (value) => /\d{4}\/\d{1,2}\/\d{1,2}/.test(value)
            },
            '应用场景': { 
                required: true, 
                prompt: '判断应用场景的适用性',
                options: ['✓', '○', '适用', '不适用']
            },
            '组织/环境': { 
                required: false, 
                prompt: '描述公司的组织结构或运营环境，简洁明了',
                maxLength: 100
            },
            '一句点评': { 
                required: true, 
                prompt: '用一句话点评该公司的核心特点、优势或创新点',
                maxLength: 50
            },
            '成立时间': { 
                required: true, 
                prompt: '提供公司成立年份，格式为YYYY年',
                validation: (value) => /\d{4}/.test(value)
            },
            '成立国家': { 
                required: true, 
                prompt: '提供公司成立的国家或地区',
                options: ['美国', '中国', '英国', '德国', '加拿大', '新加坡', '日本', '韩国', '法国', '其他']
            },
            '发展阶段': { 
                required: true, 
                prompt: '判断公司当前发展阶段',
                options: ['种子轮', 'Pre-A', 'A轮', 'B轮', 'C轮', 'D轮', '上市', '成熟期', '初创期']
            },
            '业务模式': { 
                required: true, 
                prompt: '判断公司的主要业务模式',
                options: ['To B', 'To C', 'To B/To C', 'B2B', 'B2C', 'B2B2C', 'SaaS', '平台型']
            },
            '服务连接': { 
                required: false, 
                prompt: '提供公司官网链接，格式为完整的https://网址',
                validation: (value) => /^https?:\/\//.test(value)
            },
            '业务简介': { 
                required: true, 
                prompt: '简要描述公司主营业务和核心产品服务',
                maxLength: 150
            },
            'AI相关功能实况': { 
                required: true, 
                prompt: '详细描述该公司的AI技术应用、AI产品功能或AI解决方案',
                maxLength: 200
            },
            '公司参考资料/链接': { 
                required: false, 
                prompt: '提供公司相关的参考资料链接、新闻报道或研究报告',
                validation: (value) => /^https?:\/\//.test(value) || value.includes('文档') || value.includes('报告')
            },
            '使用链接/途径': { 
                required: true, 
                prompt: '说明如何使用该公司的产品或服务，包括注册方式、使用步骤等',
                maxLength: 100
            },
            '公司类别': { 
                required: true, 
                prompt: '对公司进行分类',
                options: ['AI科技', '金融科技', '数据分析', '云计算', '企业服务', '消费科技', '教育科技', '医疗科技', '其他']
            },
            '最后编辑新人': { 
                required: false, 
                prompt: '记录最后编辑人员信息'
            }
        };
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
            console.log('⏰ 开始延迟初始化...');
            this.setupEventListeners();
            console.log('✅ 事件监听器设置完成');
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
            
            <!-- 新增：表格智能助手功能区 -->
            <div class="ai-table-actions">
                <h4>📊 表格智能助手</h4>
                <div class="action-buttons">
                    <button id="analyze-table-btn" class="ai-btn ai-btn-primary">
                        🔍 分析表格
                    </button>
                    <button id="auto-fill-btn" class="ai-btn ai-btn-success">
                        🔄 智能补全
                    </button>
                </div>
            </div>
            <div class="ai-chat-container">
                <div class="ai-messages" id="ai-messages">
                    <div class="ai-message assistant">
                        <p>👋 您好！我是Kyle's AI Agent，现在支持智能表格操作！</p>
                        <p>🎯 新功能：</p>
                        <ul>
                            <li>🔍 智能分析表格内容</li>
                            <li>🔄 自动补全缺失信息</li>
                        </ul>
                        <p>请告诉我您想了解什么，或点击表格助手按钮开始！</p>
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

        // 默认隐藏侧边栏，只有按 Ctrl+Q 时才显示
        sidebar.classList.add('ds-hidden');

        console.log('AI侧边栏已创建并添加到页面（默认隐藏）');

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

            /* 表格智能助手样式 */
            .ai-table-actions {
                padding: 16px;
                border-bottom: 1px solid #e0e0e0;
                background: #f0f8ff;
            }

            .ai-table-actions h4 {
                margin: 0 0 12px 0;
                font-size: 14px;
                color: #333;
                font-weight: 600;
            }

            .action-buttons {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 8px;
                margin-bottom: 12px;
            }

            .ai-btn {
                padding: 8px 12px;
                border: none;
                border-radius: 6px;
                font-size: 12px;
                cursor: pointer;
                transition: all 0.2s;
                font-weight: 500;
            }

            .ai-btn:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }

            .ai-btn-primary {
                background: #007bff;
                color: white;
            }

            .ai-btn-primary:hover:not(:disabled) {
                background: #0056b3;
            }

            .ai-btn-success {
                background: #28a745;
                color: white;
            }

            .ai-btn-success:hover:not(:disabled) {
                background: #1e7e34;
            }

            .ai-btn-secondary {
                background: #6c757d;
                color: white;
            }

            .ai-btn-secondary:hover:not(:disabled) {
                background: #545b62;
            }

            .ai-btn-warning {
                background: #ffc107;
                color: #212529;
            }

            .ai-btn-warning:hover:not(:disabled) {
                background: #e0a800;
            }


            .ai-messages ul {
                margin: 8px 0;
                padding-left: 20px;
            }

            .ai-messages li {
                margin: 4px 0;
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

        // 新增：表格智能助手按钮事件
        const analyzeBtn = document.getElementById('analyze-table-btn');
        const autoFillBtn = document.getElementById('auto-fill-btn');

        if (analyzeBtn) {
            analyzeBtn.addEventListener('click', () => this.analyzeTable());
        }

        if (autoFillBtn) {
            autoFillBtn.addEventListener('click', () => this.autoFillTable());
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
        console.log('📚 当前对话历史:', this.conversationHistory);
        
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
        
        // 🚨 临时调试：如果用户只发了简单消息，清空对话历史避免误导
        if (message.length <= 2) {
            console.log('⚠️ 检测到简单消息，清空对话历史避免误导');
            this.conversationHistory = [];
        }

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
    async callDeepSeekAPI(userMessage, tableData, model = 'deepseek-chat') {
        console.log('🔄 开始调用DeepSeek API');
        console.log('💰 模型:', model);
        console.log('📝 用户消息长度:', userMessage.length);
        console.log('📊 表格数据大小:', JSON.stringify(tableData).length);
        // 生成动态知识库上下文
        let knowledgeContext = '';
        if (window.knowledgeBase) {
            knowledgeContext = window.knowledgeBase.generateContext(userMessage, tableData);
        }

        const messages = [
            {
                role: "system",
                content: "金融AI产品分析师。输出TSV格式，17字段用Tab分隔。\n\n" +
                    "字段：公司名称、参考价值、最后更新时间、应用赛道、细分场景、一句点评、成立时间、成立国家、发展阶段、业务模式、服务渠道、官网链接、业务简介、AI相关功能亮点、公开参考资料/链接、使用链接/途径、公司类别\n\n" +
                    "示例（AlphaSense 5星标准）：\n" +
                    "AlphaSense\t5星\t-\t资产管理\t投研助手\t华尔街级AI语义检索引擎\t2011\t美国\tD轮及更多\tTo B\tWeb\thttps://www.alpha-sense.com\t市场情报搜索平台提供商\tNLP语音转录+情感分析标注\thttps://www.alpha-sense.com\thttps://www.alpha-sense.com\t金融科技公司\n\n" +
                    "规则：\n" +
                    "1. 参考价值：1-5星；应用赛道：银行|保险|信贷|支付|资产管理|财富管理|内部运营|Web3（单选）\n" +
                    "2. 发展阶段：种子轮|A轮|B轮|C轮|D轮及更多|上市|成熟期；业务模式：To B|To C|SaaS|平台型\n" +
                    "3. 渠道：小程序|APP|Web|产品方案|平台|插件；公司类别：传统金融机构|金融科技公司|大模型厂商|AI-Native初创公司|开源社区项目\n" +
                    "4. 一句点评≤20字，最后更新时间固定'-'，成立时间和国家必填不编造，避免'未知'\n" +
                    "直接输出TSV，无需表头："
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
            // 使用Chrome扩展的background script调用API（绕过CORS限制）
            console.log('🔄 通过background script调用API');
            
            const response = await new Promise((resolve, reject) => {
                chrome.runtime.sendMessage({
                    type: 'CALL_DEEPSEEK_API',
                    messages: messages,
                    apiKey: this.apiKey,
                    model: model
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                    } else {
                        resolve(response);
                    }
                });
            });
            
            if (response.success) {
                const aiResponse = response.data.choices[0].message.content;
                console.log('✅ Background script API调用成功');
                return { content: aiResponse, suggestions: [] };
            } else {
                throw new Error(response.error);
            }
        } catch (error) {
            console.log('❌ Background script调用失败:', error.message);
        }
        
        // 最后：智能提示用户
        console.log('⚠️ 所有API调用方法都失败，提供解决方案');
        const helpMessage = `抱歉，AI服务暂时无法连接。

🔧 解决方案：
1. 检查API密钥是否正确配置
2. 确保网络连接正常
3. 检查API余额是否充足
4. 重新加载Chrome扩展

💡 如果问题持续，请联系管理员获取帮助。

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

        console.log('🔍 开始提取表格数据');
        console.log('当前页面URL:', window.location.href);
        
        // 调试：输出页面的主要DOM结构
        console.log('📋 页面DOM结构分析:');
        const allElements = document.querySelectorAll('*');
        const elementStats = {};
        allElements.forEach(el => {
            const tag = el.tagName.toLowerCase();
            elementStats[tag] = (elementStats[tag] || 0) + 1;
        });
        console.log('元素统计:', elementStats);
        
        // 特别关注可能的表格相关元素
        const tableRelated = ['table', 'tr', 'td', 'th', 'tbody', 'thead'];
        tableRelated.forEach(tag => {
            const elements = document.querySelectorAll(tag);
            console.log(`${tag}元素: ${elements.length} 个`);
            if (elements.length > 0 && elements.length <= 5) {
                elements.forEach((el, i) => console.log(`  ${tag}[${i}]:`, el));
            }
        });

        // 1. 多种方式提取表格数据
        // 方法1：标准table元素
        let tables = document.querySelectorAll('table');
        console.log(`找到 ${tables.length} 个标准table元素`);

        // 方法2：腾讯文档特殊选择器
        if (tables.length === 0) {
            // 腾讯文档可能的选择器
            const tencentSelectors = [
                '.ql-editor table',
                '.docs-table', 
                '.online-table',
                '[data-table]',
                '.docs-editor table',
                '.editor-content table',
                '.ql-container table',
                '.ql-snow table',
                'div[data-type="table"]',
                '.table-container table',
                '.spreadsheet-table',
                '.grid-table'
            ];
            
            for (const selector of tencentSelectors) {
                tables = document.querySelectorAll(selector);
                console.log(`选择器 "${selector}" 找到 ${tables.length} 个表格`);
                if (tables.length > 0) break;
            }
        }

        // 方法3：通用表格结构检测
        if (tables.length === 0) {
            tables = document.querySelectorAll('div[role="table"], .table, .data-table, .grid');
            console.log(`通用选择器找到 ${tables.length} 个表格结构`);
        }

        // 方法4：智能检测腾讯文档表格结构
        if (tables.length === 0) {
            console.log('🔍 开始智能检测腾讯文档表格结构...');
        
        // 新增：探测腾讯表格的JavaScript数据结构
        console.log('🕵️ 探测腾讯表格JavaScript数据结构:');
        
        // 1. 检查全局对象
        const globalKeys = Object.keys(window).filter(key => 
            key.toLowerCase().includes('sheet') || 
            key.toLowerCase().includes('table') || 
            key.toLowerCase().includes('data') ||
            key.toLowerCase().includes('tencent') ||
            key.toLowerCase().includes('docs')
        );
        console.log('🌐 相关全局对象:', globalKeys);
        
        // 2. 检查常见的数据存储位置
        const dataLocations = [
            'window.__INITIAL_STATE__',
            'window.__DATA__', 
            'window.sheetData',
            'window.tableData',
            'window.docData',
            'window.store',
            'window.app',
            'window.vue',
            'window.react'
        ];
        
        dataLocations.forEach(location => {
            try {
                const data = eval(location);
                if (data) {
                    console.log(`📊 找到数据对象 ${location}:`, typeof data, Object.keys(data).slice(0, 10));
                }
            } catch (e) {
                // 忽略错误
            }
        });
        
        // 3. 检查DOM元素的数据属性
        const containers = document.querySelectorAll('[data-sheet], [data-table], [id*="sheet"], [class*="sheet"], [class*="table"]');
        console.log(`🏗️ 找到 ${containers.length} 个可能的数据容器`);
        containers.forEach((el, i) => {
            if (i < 5) { // 只显示前5个
                console.log(`容器${i + 1}:`, el.tagName, el.className, Object.keys(el.dataset));
            }
        });
        
        // 4. 尝试访问可能的API对象
        const apiChecks = [
            'window.TDocs',
            'window.DocsAPI', 
            'window.SheetAPI',
            'window.wx',
            'window.qq'
        ];
        
        apiChecks.forEach(api => {
            try {
                const obj = eval(api);
                if (obj) {
                    console.log(`🔌 找到API对象 ${api}:`, typeof obj, Object.keys(obj).slice(0, 10));
                }
            } catch (e) {
                // 忽略错误
            }
        });
        
        // 5. 深度探测：检查所有可能包含表格数据的对象
        console.log('🔬 深度探测数据结构...');
        
        // 检查所有script标签中的数据
        const scripts = document.querySelectorAll('script');
        let foundDataInScript = false;
        scripts.forEach((script, i) => {
            if (script.textContent && script.textContent.includes('sheet')) {
                console.log(`📜 Script ${i} 包含sheet相关内容`);
                foundDataInScript = true;
                
                // 尝试提取可能的数据结构
                const content = script.textContent;
                
                // 查找可能的数据模式
                const patterns = [
                    /window\.\w+\s*=\s*\{[\s\S]*?sheet[\s\S]*?\}/gi,
                    /var\s+\w+\s*=\s*\{[\s\S]*?sheet[\s\S]*?\}/gi,
                    /const\s+\w+\s*=\s*\{[\s\S]*?sheet[\s\S]*?\}/gi,
                    /"sheet":\s*\{[\s\S]*?\}/gi,
                    /"data":\s*\[[\s\S]*?\]/gi
                ];
                
                patterns.forEach((pattern, pi) => {
                    const matches = content.match(pattern);
                    if (matches && matches.length > 0) {
                        console.log(`🎯 Script ${i} 模式 ${pi + 1} 匹配:`, matches.length, '个');
                        matches.slice(0, 2).forEach((match, mi) => {
                            console.log(`  匹配 ${mi + 1}:`, match.substring(0, 200) + '...');
                        });
                    }
                });
                
                // 查找可能的表格数据数组
                if (content.includes('rows') || content.includes('cells') || content.includes('data')) {
                    console.log(`📊 Script ${i} 可能包含表格数据结构`);
                }
            }
        });
        
        // 检查可能的React/Vue组件实例
        const reactKeys = Object.keys(window).filter(key => key.startsWith('__REACT') || key.startsWith('__VUE'));
        if (reactKeys.length > 0) {
            console.log('⚛️ 找到React/Vue相关对象:', reactKeys);
        }
        
        // 检查iframe中的数据（腾讯文档可能使用iframe）
        const iframes = document.querySelectorAll('iframe');
        console.log(`🖼️ 找到 ${iframes.length} 个iframe`);
        
        // 检查Canvas元素（表格可能在Canvas中渲染）
        const canvases = document.querySelectorAll('canvas');
        console.log(`🎨 找到 ${canvases.length} 个canvas元素`);
        if (canvases.length > 0) {
            console.log('Canvas可能用于表格渲染，需要通过JS API获取数据');
            canvases.forEach((canvas, i) => {
                console.log(`Canvas ${i + 1}:`, {
                    width: canvas.width,
                    height: canvas.height,
                    id: canvas.id,
                    className: canvas.className,
                    parent: canvas.parentElement?.tagName
                });
            });
        }
        
        // 7. 专门检查腾讯文档可能的数据存储
        console.log('🔍 专门检查腾讯文档数据存储...');
        
        // 8. 基于Canvas发现，深入探测表格数据
        console.log('🎨 基于Canvas发现，探测表格渲染数据...');
        
        // 检查Canvas父元素及其数据
        canvases.forEach((canvas, i) => {
            const parent = canvas.parentElement;
            if (parent) {
                console.log(`Canvas ${i + 1} 父元素:`, {
                    tagName: parent.tagName,
                    className: parent.className,
                    id: parent.id,
                    dataAttributes: Object.keys(parent.dataset)
                });
                
                // 检查父元素的兄弟元素
                const siblings = parent.parentElement?.children;
                if (siblings) {
                    console.log(`Canvas ${i + 1} 父级容器的子元素:`, Array.from(siblings).map(el => ({
                        tag: el.tagName,
                        id: el.id,
                        className: el.className.substring(0, 50)
                    })));
                }
            }
        });
        
        // 9. 检查可能的表格数据存储在DOM元素上
        console.log('🔍 检查DOM元素上的数据存储...');
        const potentialDataElements = document.querySelectorAll('[data-sheet-id], [data-doc-id], [data-file-id]');
        console.log(`找到 ${potentialDataElements.length} 个带有数据ID的元素`);
        
        // 10. 检查全局变量中可能的表格实例
        console.log('🔍 检查全局表格实例...');
        Object.keys(window).forEach(key => {
            if (key.toLowerCase().includes('sheet') || 
                key.toLowerCase().includes('grid') || 
                key.toLowerCase().includes('table') ||
                key.toLowerCase().includes('canvas')) {
                try {
                    const obj = window[key];
                    if (obj && typeof obj === 'object' && obj !== window) {
                        console.log(`🎯 全局对象 window.${key}:`, typeof obj, Object.keys(obj).slice(0, 10));
                    }
                } catch (e) {
                    // 忽略错误
                }
            }
        });
        
        // 检查可能的数据存储对象
        const tencentDataChecks = [
            'window.g_config',
            'window.wx',
            'window.qq', 
            'window.tdocs',
            'window.TDOCS',
            'window.__webpack_require__',
            'window.webpackJsonp',
            'window.modules',
            'window.basicClientVars',
            'window.AppConfig',
            'window.__INITIAL_STATE__',
            'window.store'
        ];
        
        tencentDataChecks.forEach(check => {
            try {
                const obj = eval(check);
                if (obj && typeof obj === 'object') {
                    console.log(`🎯 找到 ${check}:`, typeof obj, Object.keys(obj).slice(0, 15));
                    
                    // 如果是配置对象，深入检查
                    if (check.includes('config') || check.includes('wx') || check.includes('qq')) {
                        Object.keys(obj).forEach(key => {
                            if (key.toLowerCase().includes('sheet') || key.toLowerCase().includes('data')) {
                                console.log(`  📋 ${check}.${key}:`, typeof obj[key]);
                            }
                        });
                    }
                }
            } catch (e) {
                // 忽略错误
            }
        });
        
        // 6. 尝试通过Canvas上下文获取渲染信息
        console.log('🎨 尝试从Canvas获取表格数据...');
        canvases.forEach((canvas, i) => {
            if (canvas.width > 0 && canvas.height > 0) {
                try {
                    // 尝试获取Canvas的渲染上下文
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                        console.log(`Canvas ${i + 1} 渲染上下文可用，尺寸: ${canvas.width}x${canvas.height}`);
                        
                        // 检查Canvas是否有关联的数据属性
                        const canvasData = canvas.dataset;
                        if (Object.keys(canvasData).length > 0) {
                            console.log(`Canvas ${i + 1} 数据属性:`, canvasData);
                        }
                        
                        // 检查Canvas父元素的事件监听器（可能包含数据操作）
                        const parent = canvas.parentElement;
                        if (parent && parent.onclick) {
                            console.log(`Canvas ${i + 1} 父元素有点击事件`);
                        }
                    }
                } catch (e) {
                    console.log(`Canvas ${i + 1} 上下文获取失败:`, e.message);
                }
            }
        });
        
        // 7. 尝试查找React/Vue组件实例（腾讯文档可能使用前端框架）
        console.log('⚛️ 查找前端框架组件实例...');
        const reactFiberKey = Object.keys(document.body).find(key => key.startsWith('__reactInternalInstance') || key.startsWith('_reactInternalFiber'));
        if (reactFiberKey) {
            console.log('🔍 发现React组件，尝试获取数据');
            try {
                const fiberNode = document.body[reactFiberKey];
                console.log('React Fiber节点类型:', typeof fiberNode);
            } catch (e) {
                console.log('React数据获取失败:', e.message);
            }
        }
        
        // 8. 尝试监听网络请求中的数据
        console.log('🌐 检查是否有数据API调用...');
        
        // 检查performance entries中的网络请求
        if (window.performance && window.performance.getEntriesByType) {
            const networkEntries = window.performance.getEntriesByType('resource')
                .filter(entry => entry.name.includes('api') || entry.name.includes('data') || entry.name.includes('sheet'))
                .slice(-10); // 最近10个
            console.log('📡 最近的相关API请求:', networkEntries.map(e => e.name));
        }
        
        // 9. 智能表格数据提取（适配腾讯文档Canvas渲染）
        console.log('🎯 开始智能表格数据提取...');
        
        // 等待数据加载并尝试多种方法提取
        const extractTableDataAsync = () => {
            return new Promise((resolve) => {
                let attempts = 0;
                const maxAttempts = 3;
                
                const tryExtract = () => {
                    attempts++;
                    console.log(`📊 尝试提取数据 (${attempts}/${maxAttempts})`);
                    
                    // 方法1: 检查可选择的单元格 - 扩展腾讯文档选择器
                    // 更精确的腾讯文档选择器，避免选中UI元素
                    const selectableElements = document.querySelectorAll([
                        // 标准表格选择器
                        '[role="gridcell"]', '.cell', '.grid-cell', '[data-row]', '[data-col]',
                        'td', 'th', 'tr > div', 'tr > span',
                        // 腾讯文档数据区域选择器（更精确）
                        '.excel-container canvas + div div', // Canvas后的数据div
                        '.excel-container [style*="position"]', // 定位元素可能是单元格
                        '[class*="cell"]:not([class*="button"]):not([class*="toolbar"])', // 排除按钮和工具栏
                        '[id*="cell"]:not([id*="button"])', // 排除按钮
                        // 查找可能的数据容器
                        '.excel-container > div > div > div', // 深层数据div
                        'div[style*="left:"]:not([class*="toolbar"]):not([class*="menu"])', // 有定位的非UI元素
                    ].join(', '));
                    
                    console.log(`🔍 找到 ${selectableElements.length} 个可能的单元格`);
                    
                    // 分析所有元素，了解数据分布
                    console.log('🔍 分析所有候选元素:');
                    const elementAnalysis = Array.from(selectableElements).slice(0, 20).map((el, i) => {
                        const text = el.textContent?.trim();
                        const rect = el.getBoundingClientRect();
                        return {
                            index: i,
                            text: text?.substring(0, 50) + (text?.length > 50 ? '...' : ''),
                            length: text?.length || 0,
                            width: Math.round(rect.width),
                            height: Math.round(rect.height),
                            tagName: el.tagName,
                            className: el.className || 'no-class'
                        };
                    });
                    console.table(elementAnalysis);
                    
                    // 进一步过滤，使用更宽松的条件
                    const filteredElements = Array.from(selectableElements).filter(el => {
                        const text = el.textContent?.trim();
                        const rect = el.getBoundingClientRect();
                        
                        // 更宽松的过滤条件
                        const hasText = text && text.length > 0 && text.length < 1000;
                        const hasSize = rect.width > 5 && rect.height > 5; // 更宽松的尺寸要求
                        const notEmpty = text && !/^[\s\n\t]*$/.test(text); // 不是纯空白
                        
                        // 只排除明显的UI元素
                        const notUIElement = text && 
                                           !text.includes('添加行') && 
                                           !text.includes('删除行') &&
                                           !text.includes('工具栏') &&
                                           !text.includes('菜单栏') &&
                                           !text.includes('按钮');
                        
                        return hasText && hasSize && notEmpty && notUIElement;
                    });
                    
                    console.log(`🎯 过滤后剩余 ${filteredElements.length} 个有效单元格`);
                    
                    // 如果还是没有，显示被过滤掉的原因
                    if (filteredElements.length === 0) {
                        console.log('❌ 所有元素都被过滤，分析原因:');
                        const reasons = Array.from(selectableElements).slice(0, 10).map(el => {
                            const text = el.textContent?.trim();
                            const rect = el.getBoundingClientRect();
                            const reasons = [];
                            
                            if (!text || text.length === 0) reasons.push('无文本');
                            if (text && text.length >= 1000) reasons.push('文本过长');
                            if (rect.width <= 5) reasons.push('宽度过小');
                            if (rect.height <= 5) reasons.push('高度过小');
                            if (text && /^[\s\n\t]*$/.test(text)) reasons.push('纯空白');
                            
                            return {
                                text: text?.substring(0, 30) + '...',
                                reasons: reasons.join(', ') || '通过所有检查'
                            };
                        });
                        console.table(reasons);
                    }
                    
                    // 如果过滤后元素太少，尝试其他方法
                    let elementsToProcess = filteredElements;
                    if (filteredElements.length < 10) {
                        console.log('⚠️ 过滤后元素太少，尝试直接从表格容器提取...');
                        
                        // 尝试从excel-container中找所有可能的数据元素
                        const excelContainer = document.querySelector('.excel-container');
                        if (excelContainer) {
                            // 扩大搜索范围，包括所有可能的数据元素
                            const dataElements = excelContainer.querySelectorAll('div, span, p, td, th');
                            console.log(`🔍 从excel-container找到 ${dataElements.length} 个所有元素`);
                            
                            // 分析这些元素
                            const analysisData = Array.from(dataElements).slice(0, 10).map((el, i) => {
                                const text = el.textContent?.trim();
                                const rect = el.getBoundingClientRect();
                                return {
                                    index: i,
                                    tag: el.tagName,
                                    text: text?.substring(0, 30) + '...',
                                    length: text?.length || 0,
                                    width: Math.round(rect.width),
                                    height: Math.round(rect.height)
                                };
                            });
                            console.table(analysisData);
                            
                            // 使用更宽松的过滤条件
                            const validDataElements = Array.from(dataElements).filter(el => {
                                const text = el.textContent?.trim();
                                const rect = el.getBoundingClientRect();
                                
                                return text && 
                                       text.length > 0 && 
                                       text.length < 1000 && // 更宽松的长度限制
                                       rect.width > 5 && 
                                       rect.height > 5 &&
                                       !/^[\s\n\t]*$/.test(text) && // 不是纯空白
                                       !text.includes('添加行') && // 只排除明显的UI
                                       !text.includes('删除行');
                            });
                            
                            console.log(`🎯 找到 ${validDataElements.length} 个有效数据元素`);
                            
                            // 显示找到的数据样本
                            if (validDataElements.length > 0) {
                                const samples = validDataElements.slice(0, 10).map(el => el.textContent?.trim().substring(0, 50));
                                console.log('📊 数据样本:', samples);
                                
                                elementsToProcess = validDataElements;
                                console.log('✅ 使用excel-container中的数据元素');
                            }
                        }
                    }
                    
                    if (elementsToProcess.length > 0) {
                        const cellData = Array.from(elementsToProcess).map((cell, i) => {
                            const text = cell.textContent?.trim();
                            if (text && text.length > 0 && text.length < 500) { // 增加文本长度限制
                                // 更智能的行列识别
                                let row = cell.getAttribute('data-row') || cell.getAttribute('row');
                                let col = cell.getAttribute('data-col') || cell.getAttribute('col');
                                
                                // 尝试从父元素或位置推断行列
                                if (!row || !col) {
                                    const rect = cell.getBoundingClientRect();
                                    const estimatedCol = Math.floor(rect.left / 100); // 假设每列约100px
                                    const estimatedRow = Math.floor(rect.top / 30);   // 假设每行约30px
                                    
                                    row = row || estimatedRow;
                                    col = col || estimatedCol;
                                }
                                
                                // 如果还是没有，使用更合理的推算
                                if (!row && !col) {
                                    // 假设表格有合理的列数（比如10-20列）
                                    const estimatedCols = Math.min(20, Math.ceil(Math.sqrt(elementsToProcess.length)));
                                    row = Math.floor(i / estimatedCols);
                                    col = i % estimatedCols;
                                }
                                
                                return {
                                    index: i,
                                    text: text,
                                    row: parseInt(row) || 0,
                                    col: parseInt(col) || 0,
                                    element: cell
                                };
                            }
                            return null;
                        }).filter(Boolean);
                        
                        if (cellData.length > 5) {
                            console.log('✅ 通过单元格提取到数据:', cellData.length, '个');
                            console.log('📊 数据样本:', cellData.slice(0, 10).map(cell => `[${cell.row},${cell.col}] "${cell.text}"`));
                            
                            // 分析行列分布
                            const rowSet = new Set(cellData.map(cell => cell.row));
                            const colSet = new Set(cellData.map(cell => cell.col));
                            console.log(`📏 检测到 ${rowSet.size} 行, ${colSet.size} 列`);
                            console.log(`📏 行范围: ${Math.min(...rowSet)} - ${Math.max(...rowSet)}`);
                            console.log(`📏 列范围: ${Math.min(...colSet)} - ${Math.max(...colSet)}`);
                            
                            const table = this.buildTableFromCells(cellData);
                            if (table) {
                                pageData.tables.push(table);
                                resolve(pageData);
                                return;
                            }
                        }
                    }
                    
                    // 方法2: 检查表格容器内的文本
                    const excelContainer = document.querySelector('.excel-container');
                    if (excelContainer) {
                        const allText = excelContainer.innerText?.trim();
                        if (allText && allText.length > 50) {
                            console.log('📄 从容器文本提取数据，长度:', allText.length);
                            console.log('📄 容器文本预览:', allText.substring(0, 200) + '...');
                            const table = this.buildTableFromText(allText);
                            if (table) {
                                pageData.tables.push(table);
                                resolve(pageData);
                                return;
                            }
                        }
                    }
                    
                    // 方法3: 尝试解析脚本标签中的数据
                    if (attempts === 2) {
                        console.log('📜 尝试解析脚本标签中的表格数据...');
                        const scripts = document.querySelectorAll('script');
                        console.log(`🔍 找到 ${scripts.length} 个脚本标签`);
                        
                        for (let i = 0; i < scripts.length; i++) {
                            const script = scripts[i];
                            const content = script.textContent || script.innerHTML;
                            
                            if (content && (content.includes('sheet') || content.includes('cell') || content.includes('row') || content.includes('data'))) {
                                console.log(`📜 Script ${i} 可能包含表格数据，长度: ${content.length}`);
                                
                                // 尝试提取JSON数据
                                const jsonMatches = content.match(/\{[^{}]*"[^"]*":[^{}]*\}/g);
                                if (jsonMatches && jsonMatches.length > 0) {
                                    console.log(`📊 Script ${i} 找到 ${jsonMatches.length} 个JSON对象`);
                                    jsonMatches.slice(0, 3).forEach((match, j) => {
                                        console.log(`JSON ${j}: ${match.substring(0, 100)}...`);
                                    });
                                }
                                
                                // 尝试提取数组数据
                                const arrayMatches = content.match(/\[[^\[\]]*\]/g);
                                if (arrayMatches && arrayMatches.length > 0) {
                                    console.log(`📊 Script ${i} 找到 ${arrayMatches.length} 个数组`);
                                    arrayMatches.slice(0, 3).forEach((match, j) => {
                                        if (match.length > 10 && match.length < 500) {
                                            console.log(`Array ${j}: ${match}`);
                                        }
                                    });
                                }
                            }
                        }
                    }
                    
                    // 方法4: 模拟滚动和点击来触发数据显示
                    if (attempts === 1) {
                        console.log('🖱️ 尝试模拟用户交互...');
                        this.simulateTableInteraction();
                    }
                    
                    // 继续尝试或放弃
                    if (attempts < maxAttempts) {
                        setTimeout(tryExtract, 2000); // 等待2秒后重试
                    } else {
                        console.log('❌ 多次尝试后仍未找到表格数据');
                        resolve(pageData);
                    }
                };
                
                tryExtract();
            });
        };
        
        // 如果是腾讯文档，使用异步提取
        if (window.location.href.includes('doc.weixin.qq.com')) {
            console.log('🔄 检测到腾讯文档，启用异步数据提取...');
            
            // 添加更多环境诊断信息
            console.log('🔍 页面环境诊断:');
            console.log('- 页面标题:', document.title);
            console.log('- 页面URL:', window.location.href);
            console.log('- 是否包含sheet:', window.location.href.includes('sheet'));
            console.log('- 页面加载状态:', document.readyState);
            
            // 检查关键容器
            const containers = {
                'excel-container': document.querySelector('.excel-container'),
                'main-board': document.querySelector('.main-board'), 
                'sheet-container': document.querySelector('.sheet-container'),
                'table-container': document.querySelector('.table-container'),
                'spreadsheet': document.querySelector('.spreadsheet'),
                'grid': document.querySelector('.grid')
            };
            
            console.log('🏗️ 关键容器检查:');
            Object.entries(containers).forEach(([name, element]) => {
                if (element) {
                    console.log(`✅ ${name}:`, {
                        tagName: element.tagName,
                        className: element.className,
                        childCount: element.children.length,
                        textLength: element.textContent?.length || 0
                    });
                } else {
                    console.log(`❌ ${name}: 未找到`);
                }
            });
            
            // 检查Canvas元素的详细信息
            const canvases = document.querySelectorAll('canvas');
            console.log(`🎨 Canvas元素详细信息 (${canvases.length}个):`);
            canvases.forEach((canvas, i) => {
                const rect = canvas.getBoundingClientRect();
                console.log(`Canvas ${i+1}:`, {
                    id: canvas.id || 'no-id',
                    width: canvas.width,
                    height: canvas.height,
                    actualWidth: Math.round(rect.width),
                    actualHeight: Math.round(rect.height),
                    parentClass: canvas.parentElement?.className || 'no-parent-class'
                });
            });
            
            // 专门探测腾讯文档的数据存储方式
            console.log('🕵️ 深度探测腾讯文档数据存储:');
            
            // 首先检查表格是否可用
            const pageText = document.body.innerText;
            if (pageText.includes('表格已不再使用') || 
                pageText.includes('The sheet is no longer in use') ||
                pageText.includes('同步新智能表格') ||
                pageText.includes('重新啟用此表格')) {
                console.log('⚠️ 检测到表格可能已被禁用或迁移！');
                console.log('📄 页面提示信息:', pageText.split('\n').filter(line => 
                    line.includes('表格') || line.includes('sheet') || line.includes('智能')
                ).slice(0, 5));
                
                // 寻找"同步新智能表格"或类似的按钮
                const migrationButtons = document.querySelectorAll('button, a, div[role="button"]');
                const relevantButtons = Array.from(migrationButtons).filter(btn => {
                    const text = btn.textContent?.trim();
                    return text && (
                        text.includes('同步') || 
                        text.includes('智能表格') || 
                        text.includes('新表格') ||
                        text.includes('启用')
                    );
                });
                
                if (relevantButtons.length > 0) {
                    console.log('🔘 找到可能的迁移/启用按钮:');
                    relevantButtons.forEach((btn, i) => {
                        console.log(`${i+1}. "${btn.textContent?.trim()}" (${btn.tagName})`);
                    });
                    console.log('💡 建议：可能需要点击这些按钮来访问真实的表格数据');
                }
            }
            
            this.probeTencentDocsData();
            
            // 启动异步提取，但不等待结果，让同步代码继续执行
            extractTableDataAsync().then(result => {
                if (result.tables.length > 0) {
                    console.log('✅ 异步提取成功，找到', result.tables.length, '个表格');
                    // 更新页面数据
                    pageData.tables = result.tables;
                    
                    // 触发表格数据更新事件
                    const event = new CustomEvent('tableDataExtracted', { 
                        detail: { tables: result.tables } 
                    });
                    document.dispatchEvent(event);
                } else {
                    console.log('⚠️ 异步提取未找到表格数据');
                }
            }).catch(error => {
                console.log('❌ 异步提取失败:', error);
            });
        }
            
            // 查找可能包含表格数据的div结构
            const potentialTables = document.querySelectorAll('div');
            const detectedTables = [];
            
            potentialTables.forEach(div => {
                // 检查是否包含类似表格的结构
                const rows = div.querySelectorAll('div, tr');
                const cells = div.querySelectorAll('td, th, span, p');
                
                // 启发式检测：如果一个div包含多个子元素，且这些元素排列整齐
                if (rows.length >= 2 && cells.length >= 4) {
                    // 检查是否有规律的网格布局
                    const style = window.getComputedStyle(div);
                    if (style.display === 'grid' || 
                        style.display === 'table' || 
                        div.className.includes('table') ||
                        div.className.includes('grid') ||
                        div.getAttribute('role') === 'table') {
                        detectedTables.push(div);
                        console.log('🎯 检测到可能的表格结构:', div);
                    }
                }
            });
            
            if (detectedTables.length > 0) {
                tables = detectedTables;
                console.log(`智能检测找到 ${tables.length} 个可能的表格`);
            }
        }

        // 方法5：查找包含tr元素的容器
        if (tables.length === 0) {
            const trElements = document.querySelectorAll('tr');
            if (trElements.length > 0) {
                const tableContainers = new Set();
                trElements.forEach(tr => {
                    let parent = tr.parentElement;
                    while (parent && parent !== document.body) {
                        if (parent.tagName === 'TABLE' || parent.classList.contains('table') || parent.getAttribute('role') === 'table') {
                            tableContainers.add(parent);
                            break;
                        }
                        parent = parent.parentElement;
                    }
                });
                tables = Array.from(tableContainers);
                console.log(`通过tr元素找到 ${tables.length} 个表格容器`);
            }
        }

        tables.forEach((table, index) => {
            const headers = [];
            const rows = [];

            console.log(`处理表格 ${index + 1}:`, table);

            // 提取表头 - 专门针对腾讯文档优化
            let headerCells = table.querySelectorAll('th');
            console.log(`找到 ${headerCells.length} 个th元素`);
            
            // 如果没有th，尝试第一行作为表头
            if (headerCells.length === 0) {
                const firstRow = table.querySelector('tr');
                if (firstRow) {
                    // 腾讯文档可能使用div、span等作为单元格
                    headerCells = firstRow.querySelectorAll('td, div, span, p, .cell, [role="cell"], [role="columnheader"]');
                    console.log(`第一行找到 ${headerCells.length} 个可能的单元格元素`);
                }
            }

            // 如果还是没有，尝试查找包含表头文本的元素
            if (headerCells.length === 0) {
                headerCells = table.querySelectorAll('td, th, div, span, p, .header-cell, .table-header, [role="columnheader"]');
                console.log(`通用选择器找到 ${headerCells.length} 个可能的表头元素`);
            }

            Array.from(headerCells).forEach((cell, cellIndex) => {
                const text = cell.textContent.trim();
                if (text) {
                    headers.push(text);
                    console.log(`表头${cellIndex + 1}: "${text}"`);
                }
            });

            console.log(`提取到表头:`, headers);

            // 提取数据行 - 专门针对腾讯文档优化
            let dataRows = table.querySelectorAll('tbody tr');
            console.log(`tbody中找到 ${dataRows.length} 个数据行`);
            
            // 如果没有tbody，直接查找所有tr
            if (dataRows.length === 0) {
                dataRows = table.querySelectorAll('tr');
                console.log(`表格中总共找到 ${dataRows.length} 个tr元素`);
                // 如果第一行是表头，跳过它
                if (dataRows.length > 0 && headers.length > 0) {
                    dataRows = Array.from(dataRows).slice(1);
                    console.log(`跳过表头后剩余 ${dataRows.length} 个数据行`);
                }
            }

            // 如果还是没有tr，尝试查找其他行结构
            if (dataRows.length === 0) {
                dataRows = table.querySelectorAll('div[role="row"], .table-row, .data-row');
                console.log(`其他行结构找到 ${dataRows.length} 个`);
            }

            console.log(`找到 ${dataRows.length} 个数据行`);

            dataRows.forEach((row, rowIndex) => {
                const rowData = [];
                
                // 腾讯文档可能使用的单元格选择器
                let cells = row.querySelectorAll('td, th');
                console.log(`行${rowIndex + 1} 标准单元格: ${cells.length} 个`);
                
                // 如果没有标准单元格，尝试其他元素
                if (cells.length === 0) {
                    cells = row.querySelectorAll('div, span, p');
                    console.log(`行${rowIndex + 1} div/span/p元素: ${cells.length} 个`);
                }
                
                // 如果还是没有，尝试直接子元素
                if (cells.length === 0) {
                    cells = row.children;
                    console.log(`行${rowIndex + 1} 直接子元素: ${cells.length} 个`);
                }
                
                Array.from(cells).forEach((cell, cellIndex) => {
                    const text = cell.textContent.trim();
                    if (text) {
                        rowData.push(text);
                    }
                });

                if (rowData.length > 0) {
                    rows.push(rowData);
                    console.log(`✅ 行 ${rowIndex + 1} 数据:`, rowData.slice(0, 5), rowData.length > 5 ? `...(共${rowData.length}个)` : '');
                } else {
                    console.log(`❌ 行 ${rowIndex + 1} 没有提取到数据`);
                }
            });

            // 只要有表头或数据行就认为是有效表格
            if (headers.length > 0 || rows.length > 0) {
                const tableInfo = {
                    index: index,
                    headers: headers,
                    rows: rows
                };
                pageData.tables.push(tableInfo);
                console.log(`✅ 成功提取表格 ${index + 1}:`, tableInfo);
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

        console.log('📊 提取的页面数据总结:');
        console.log(`- 找到表格数量: ${pageData.tables.length}`);
        console.log(`- 找到列表数量: ${pageData.lists.length}`);
        console.log(`- 主要内容长度: ${pageData.mainContent.length}`);
        
        if (pageData.tables.length > 0) {
            pageData.tables.forEach((table, index) => {
                console.log(`表格 ${index + 1}: ${table.headers.length} 个表头, ${table.rows.length} 行数据`);
            });
        } else {
            console.warn('⚠️ 未找到任何表格数据');
            // 额外调试信息
            console.log('页面中的所有元素统计:');
            console.log(`- table元素: ${document.querySelectorAll('table').length}`);
            console.log(`- tr元素: ${document.querySelectorAll('tr').length}`);
            console.log(`- td元素: ${document.querySelectorAll('td').length}`);
            console.log(`- th元素: ${document.querySelectorAll('th').length}`);
            console.log(`- 包含"table"类的元素: ${document.querySelectorAll('.table, [class*="table"]').length}`);
        }
        
        console.log('完整页面数据:', pageData);
        return pageData;
    }

    // 新增：从单元格数据构建表格结构
    buildTableFromCells(cellData) {
        if (!cellData || cellData.length < 2) return null;
        
        console.log('🔧 从单元格数据构建表格...');
        console.log(`📊 输入数据: ${cellData.length} 个单元格`);
        
        // 按行分组
        const rowGroups = {};
        cellData.forEach(cell => {
            const row = parseInt(cell.row) || 0;
            if (!rowGroups[row]) rowGroups[row] = [];
            rowGroups[row].push(cell);
        });
        
        const sortedRows = Object.keys(rowGroups).sort((a, b) => parseInt(a) - parseInt(b));
        console.log(`📊 分组后: ${sortedRows.length} 行`);
        console.log(`📊 各行数据量:`, sortedRows.map(row => `行${row}:${rowGroups[row].length}个`).join(', '));
        
        if (sortedRows.length < 2) {
            console.log('❌ 行数不足，至少需要2行（表头+数据）');
            return null;
        }
        
        // 第一行作为表头
        const headerRow = rowGroups[sortedRows[0]].sort((a, b) => (parseInt(a.col) || 0) - (parseInt(b.col) || 0));
        const headers = headerRow.map(cell => cell.text);
        
        // 其余行作为数据
        const rows = [];
        for (let i = 1; i < sortedRows.length; i++) { // 提取所有数据行
            const rowData = rowGroups[sortedRows[i]].sort((a, b) => (parseInt(a.col) || 0) - (parseInt(b.col) || 0));
            if (rowData.length > 0) {
                rows.push(rowData.map(cell => cell.text));
            }
        }
        
        if (headers.length > 0 && rows.length > 0) {
            console.log('✅ 成功构建表格:', headers.length, '列,', rows.length, '行');
            return {
                index: 0,
                headers: headers,
                rows: rows
            };
        }
        
        return null;
    }

    // 新增：从文本内容构建表格结构
    buildTableFromText(text) {
        if (!text || text.length < 20) return null;
        
        console.log('🔧 从文本内容构建表格...');
        
        // 尝试按行分割
        const lines = text.split('\n').filter(line => line.trim().length > 0);
        if (lines.length < 3) return null; // 至少需要表头+2行数据
        
        // 检查是否有表格样的结构（包含制表符或多个空格分隔）
        const tabSeparated = lines.filter(line => line.includes('\t'));
        const spaceSeparated = lines.filter(line => line.match(/\s{2,}/));
        
        let tableLines = [];
        if (tabSeparated.length >= 3) {
            tableLines = tabSeparated; // 提取所有表格行
        } else if (spaceSeparated.length >= 3) {
            tableLines = spaceSeparated; // 提取所有表格行
        } else {
            // 尝试其他分割方式
            const potentialLines = lines.filter(line => 
                line.split(/\s+/).length >= 3 && line.split(/\s+/).length <= 20
            );
            if (potentialLines.length >= 3) {
                tableLines = potentialLines; // 提取所有表格行
            }
        }
        
        if (tableLines.length >= 3) {
            const headers = tableLines[0].split(/\t|\s{2,}/).filter(h => h.trim().length > 0);
            const rows = tableLines.slice(1).map(line => 
                line.split(/\t|\s{2,}/).filter(cell => cell.trim().length > 0)
            ).filter(row => row.length > 0);
            
            if (headers.length > 0 && rows.length > 0) {
                console.log('✅ 从文本构建表格:', headers.length, '列,', rows.length, '行');
                return {
                    index: 0,
                    headers: headers,
                    rows: rows
                };
            }
        }
        
        return null;
    }

    // 新增：专门探测腾讯文档的数据存储方式
    probeTencentDocsData() {
        console.log('🔍 探测window对象中的表格数据...');
        
        // 检查window对象中可能的数据存储
        const windowKeys = Object.keys(window).filter(key => 
            key.includes('sheet') || 
            key.includes('table') || 
            key.includes('data') || 
            key.includes('cell') ||
            key.includes('excel') ||
            key.includes('grid')
        );
        
        console.log('🌐 Window对象中相关的键:', windowKeys);
        
        // 检查一些常见的数据存储位置
        const dataLocations = [
            'window.__INITIAL_STATE__',
            'window.__APP_DATA__',
            'window.__SHEET_DATA__',
            'window.__TABLE_DATA__',
            'window.sheetData',
            'window.tableData',
            'window.cellData',
            'window.spreadsheetData'
        ];
        
        dataLocations.forEach(location => {
            try {
                const data = eval(location);
                if (data) {
                    console.log(`✅ 找到数据在 ${location}:`, typeof data, Object.keys(data || {}).slice(0, 10));
                }
            } catch (e) {
                // 忽略错误，这是正常的
            }
        });
        
        // 尝试从页面上可见的文本中寻找表格数据
        console.log('📄 尝试从页面可见文本中寻找真实数据...');
        const pageText = document.body.innerText;
        const lines = pageText.split('\n').filter(line => line.trim().length > 0);
        
        // 寻找可能的公司名称
        const possibleCompanies = lines.filter(line => {
            const text = line.trim();
            return text.length > 3 && 
                   text.length < 50 && 
                   !text.includes('卢君洋') &&
                   !text.includes('添加') &&
                   !text.includes('删除') &&
                   !text.includes('工具') &&
                   (text.includes('AI') || 
                    text.includes('Tech') || 
                    text.includes('Corp') ||
                    text.includes('Inc') ||
                    text.includes('Ltd') ||
                    /^[A-Z][a-zA-Z]+/.test(text)); // 以大写字母开头的英文
        });
        
        console.log('🏢 可能的公司名称:', possibleCompanies.slice(0, 10));
        
        // 检查是否有评级信息
        const possibleRatings = lines.filter(line => {
            return line.includes('星') || line.includes('Star') || /[1-5]星/.test(line);
        });
        
        console.log('⭐ 可能的评级信息:', possibleRatings.slice(0, 5));
        
        // 尝试通过DOM遍历找到数据
        console.log('🔍 通过DOM遍历寻找数据...');
        this.traverseForTableData();
    }
    
    // 新增：遍历DOM寻找表格数据
    traverseForTableData() {
        const excelContainer = document.querySelector('.excel-container');
        if (!excelContainer) {
            console.log('❌ 未找到.excel-container');
            return;
        }
        
        console.log('🏗️ 遍历excel-container的所有子元素...');
        
        // 递归遍历所有元素，寻找包含真实数据的元素
        const findDataElements = (element, depth = 0) => {
            if (depth > 10) return []; // 限制递归深度
            
            const results = [];
            const text = element.textContent?.trim();
            
            // 检查当前元素是否包含有意义的数据
            if (text && 
                text.length > 2 && 
                text.length < 100 &&
                !text.includes('卢君洋') &&
                !text.includes('添加') &&
                !text.includes('删除') &&
                element.children.length === 0) { // 叶子节点
                
                const rect = element.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) {
                    results.push({
                        text: text,
                        tagName: element.tagName,
                        className: element.className,
                        width: Math.round(rect.width),
                        height: Math.round(rect.height),
                        left: Math.round(rect.left),
                        top: Math.round(rect.top)
                    });
                }
            }
            
            // 递归检查子元素
            for (let child of element.children) {
                results.push(...findDataElements(child, depth + 1));
            }
            
            return results;
        };
        
        const dataElements = findDataElements(excelContainer);
        console.log(`📊 找到 ${dataElements.length} 个可能的数据元素:`);
        
        // 显示前20个数据元素
        dataElements.slice(0, 20).forEach((elem, i) => {
            console.log(`${i+1}. "${elem.text}" (${elem.tagName}, ${elem.width}x${elem.height})`);
        });
        
        // 尝试按位置排序，看是否能发现表格结构
        const sortedByPosition = dataElements.sort((a, b) => {
            if (Math.abs(a.top - b.top) < 5) { // 同一行
                return a.left - b.left; // 按列排序
            }
            return a.top - b.top; // 按行排序
        });
        
        console.log('📍 按位置排序的前10个元素:');
        sortedByPosition.slice(0, 10).forEach((elem, i) => {
            console.log(`${i+1}. [${elem.left},${elem.top}] "${elem.text}"`);
        });
    }

    // 新增：模拟表格交互来触发数据显示
    simulateTableInteraction() {
        console.log('🖱️ 模拟表格交互...');
        
        // 尝试点击表格区域
        const excelContainer = document.querySelector('.excel-container');
        if (excelContainer) {
            // 模拟点击
            const clickEvent = new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                view: window
            });
            excelContainer.dispatchEvent(clickEvent);
            
            // 模拟滚动来加载更多数据
            excelContainer.scrollTop = 100;
            excelContainer.scrollLeft = 100;
            
            setTimeout(() => {
                excelContainer.scrollTop = 0;
                excelContainer.scrollLeft = 0;
            }, 500);
        }
        
        // 尝试点击Canvas
        const canvas = document.querySelector('canvas');
        if (canvas && canvas.width > 0 && canvas.height > 0) {
            const rect = canvas.getBoundingClientRect();
            const clickEvent = new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                clientX: rect.left + 50,
                clientY: rect.top + 50
            });
            canvas.dispatchEvent(clickEvent);
        }
    }

    // 添加消息到聊天界面
    addMessage(content, role) {
        const messagesContainer = document.getElementById('ai-messages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `ai-message ${role}`;
        
        // 支持换行和简单格式
        const formattedContent = content.replace(/\n/g, '<br>');
        messageDiv.innerHTML = formattedContent;
        
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
        console.log('🔄 开始执行 toggleSidebar 方法');
        
        const sidebar = document.getElementById('deepseek-ai-sidebar');
        if (!sidebar) {
            console.log('❌ AI助手侧边栏未找到，ID: deepseek-ai-sidebar');
            console.log('🔍 当前页面所有ID元素:', Array.from(document.querySelectorAll('[id]')).map(el => el.id));
            return;
        }
        
        console.log('✅ 找到侧边栏元素');
        console.log('📊 当前样式:', {
            transform: sidebar.style.transform,
            display: sidebar.style.display,
            classList: Array.from(sidebar.classList)
        });
        
        const isHidden = sidebar.style.transform === 'translateX(100%)' || 
                        sidebar.style.display === 'none' ||
                        sidebar.classList.contains('hidden');
        
        console.log('🔄 切换AI助手显示状态:', isHidden ? '显示' : '隐藏');
        
        if (isHidden) {
            // 显示侧边栏
            console.log('👁️ 执行显示操作...');
            sidebar.style.transform = 'translateX(0)';
            sidebar.style.display = 'flex';
            sidebar.classList.remove('hidden');
            
            // 更新切换按钮
            const toggleBtn = document.getElementById('toggle-sidebar');
            if (toggleBtn) {
                toggleBtn.textContent = '−';
                console.log('🔘 更新按钮为 "−"');
            }
            
            // 显示成功提示
            this.showTemporaryMessage('✅ AI助手已显示 (Ctrl+Q 切换)');
            console.log('✅ 显示操作完成');
            
        } else {
            // 隐藏侧边栏
            console.log('👁️‍🗨️ 执行隐藏操作...');
            sidebar.style.transform = 'translateX(100%)';
            sidebar.classList.add('hidden');
            
            // 更新切换按钮
            const toggleBtn = document.getElementById('toggle-sidebar');
            if (toggleBtn) {
                toggleBtn.textContent = '+';
                console.log('🔘 更新按钮为 "+"');
            }
            
            // 显示成功提示
            this.showTemporaryMessage('✅ AI助手已隐藏 (Ctrl+Q 切换)');
            console.log('✅ 隐藏操作完成');
        }
        
        console.log('📊 操作后样式:', {
            transform: sidebar.style.transform,
            display: sidebar.style.display,
            classList: Array.from(sidebar.classList)
        });
    }

    // 监听表格变化 - 完全禁用避免意外API调用
    observeTableChanges() {
        console.log('⚠️ MutationObserver已禁用，避免意外API调用');
        // 完全禁用MutationObserver，防止任何自动触发
        // const observer = new MutationObserver(...);
        // observer.observe(...);
    }

    // 表格变化处理
    onTableChanged() {
        // 这里可以实现自动分析逻辑
        console.log('表格内容发生变化');
        
        // 暂时禁用自动建议，避免无限循环API调用
        // TODO: 未来可以添加更智能的变化检测逻辑
        // setTimeout(() => {
        //     this.autoSuggest();
        // }, 1000); // 延迟1秒，避免频繁触发
    }

    // 自动建议 - 完全禁用避免意外API调用
    async autoSuggest() {
        console.log('⚠️ autoSuggest已禁用，避免意外API调用');
        return; // 直接返回，不执行任何API调用
        
        // 以下代码已禁用
        // const tableData = this.extractTableData();
        // if (tableData.length === 0) return;
        // const response = await this.callDeepSeekAPI(...);
    }

    
    
    
    // 新增：显示临时提示消息
    showTemporaryMessage(message) {
        // 创建临时提示框
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4CAF50;
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 999999;
            transition: all 0.3s ease;
            max-width: 300px;
            word-wrap: break-word;
        `;
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        // 3秒后自动消失
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-20px)';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 3000);
    }

    // 新增：分析表格方法
    async analyzeTable() {
        this.updateStatus('正在分析表格...', 'warning');
        console.log('🔍 开始分析表格');


        try {
        const tableData = this.extractTableData();
            
            if (!tableData.tables || tableData.tables.length === 0) {
                this.updateStatus('未找到表格数据', 'error');
                this.addMessage('❌ 凯尔正在马不停蹄迭代"分析表格"功能，请稍等片刻~~\n\n' +
                    '技术说明：腾讯表格对第三方API访问有拦截机制，我们正在开发绕过方案。\n\n' +
                    '当前状态：功能开发中，暂未完全部署。', 'assistant');
                return;
            }

            const missingFields = this.tableEditor.identifyMissingFields(tableData);
            
            // 统计信息
            const totalRows = tableData.tables.reduce((sum, table) => sum + table.rows.length, 0);
            const totalCells = tableData.tables.reduce((sum, table) => sum + (table.headers.length * table.rows.length), 0);
            const completionRate = totalCells > 0 ? ((totalCells - missingFields.length) / totalCells * 100).toFixed(1) : 0;
            
            let analysisMessage = `📊 表格分析结果：\n\n`;
            analysisMessage += `📋 表格数量：${tableData.tables.length} 个\n`;
            analysisMessage += `📝 数据行数：${totalRows} 行\n`;
            analysisMessage += `📈 数据完整度：${completionRate}%\n`;
            analysisMessage += `❓ 缺失字段：${missingFields.length} 个\n\n`;

            if (missingFields.length > 0) {
                // 按字段分组统计
                const fieldGroups = {};
                const companyFieldMap = {}; // 按公司分组缺失字段
                
                missingFields.forEach(field => {
                    // 字段统计
                    if (!fieldGroups[field.fieldName]) {
                        fieldGroups[field.fieldName] = 0;
                    }
                    fieldGroups[field.fieldName]++;
                    
                    // 公司字段统计
                    const company = field.companyContext['公司名称'] || field.companyContext['产品名称'] || '未知公司';
                    if (!companyFieldMap[company]) {
                        companyFieldMap[company] = [];
                    }
                    companyFieldMap[company].push(field.fieldName);
                });
                
                analysisMessage += `🔍 缺失字段分布：\n`;
                Object.entries(fieldGroups)
                    .sort(([,a], [,b]) => b - a)
                    .slice(0, 10)
                    .forEach(([fieldName, count]) => {
                        const percentage = ((count / totalRows) * 100).toFixed(1);
                        analysisMessage += `• ${fieldName}: ${count} 处 (${percentage}%)\n`;
                    });
                
                if (Object.keys(fieldGroups).length > 10) {
                    analysisMessage += `... 还有 ${Object.keys(fieldGroups).length - 10} 个其他字段\n`;
                }
                
                analysisMessage += `\n📊 缺失最多的公司：\n`;
                Object.entries(companyFieldMap)
                    .sort(([,a], [,b]) => b.length - a.length)
                    .slice(0, 8)
                    .forEach(([company, fields], index) => {
                        const uniqueFields = [...new Set(fields)]; // 去重
                        analysisMessage += `${index + 1}. ${company}: 缺失 ${uniqueFields.length} 个字段\n`;
                        if (uniqueFields.length <= 3) {
                            analysisMessage += `   └ ${uniqueFields.join('、')}\n`;
                        } else {
                            analysisMessage += `   └ ${uniqueFields.slice(0, 3).join('、')} 等${uniqueFields.length}个\n`;
                        }
                    });
                
                // 按字段类型详细分析
                const criticalFields = ['公司名称', '产品名称', '成立时间', '成立国家', '应用赛道', '细分场景'];
                const criticalMissing = criticalFields.filter(field => fieldGroups[field] > 0);
                
                if (criticalMissing.length > 0) {
                    analysisMessage += `\n⚠️ 关键字段缺失：\n`;
                    criticalMissing.forEach(field => {
                        const count = fieldGroups[field];
                        const percentage = ((count / totalRows) * 100).toFixed(1);
                        analysisMessage += `• ${field}: ${count}个公司缺失 (${percentage}%)\n`;
                    });
                }
                
                analysisMessage += `\n🎯 建议优先处理：\n`;
                missingFields.slice(0, 10).forEach((field, index) => {
                    const company = field.companyContext['公司名称'] || field.companyContext['产品名称'] || '未知公司';
                    const currentValue = field.companyContext[field.fieldName] || '空';
                    analysisMessage += `${index + 1}. ${company} - "${field.fieldName}" (当前: ${currentValue})\n`;
                });
                
                if (missingFields.length > 10) {
                    analysisMessage += `... 还有 ${missingFields.length - 10} 个待补充\n`;
                }
                
                analysisMessage += `\n💡 点击"智能补全"开始自动填充！`;
            } else {
                analysisMessage += `✅ 恭喜！表格数据完整，无需补充！`;
            }

            this.addMessage(analysisMessage, 'assistant');
            this.updateStatus(`完整度 ${completionRate}%，${missingFields.length} 个缺失`, 
                             missingFields.length > 0 ? 'warning' : 'success');

            if (missingFields.length > 0) {
                document.getElementById('auto-fill-btn').disabled = false;
            }

        } catch (error) {
            console.error('表格分析失败:', error);
            this.updateStatus('分析失败', 'error');
            this.addMessage('❌ 表格分析失败，请稍后重试。', 'assistant');
        }
    }

    // 新增：自动补全表格方法
    async autoFillTable() {
        this.updateStatus('正在智能补全...', 'warning');
        console.log('🔄 开始智能补全');

        try {
            const tableData = this.extractTableData();
            const missingFields = this.tableEditor.identifyMissingFields(tableData);

            if (missingFields.length === 0) {
                this.addMessage('✅ 表格数据已完整，无需补充！', 'assistant');
                this.updateStatus('数据完整', 'success');
                return;
            }

            this.showThinkingIndicator();
            this.pendingChanges = [];

            const maxFields = Math.min(missingFields.length, 15); // 恢复正常处理数量
            let processedCount = 0;

            for (const missingField of missingFields.slice(0, maxFields)) {
                try {
                    this.updateStatus(`处理中 ${processedCount + 1}/${maxFields}`, 'warning');
                    
                    const suggestion = await this.generateFieldSuggestion(missingField);
                    
                    if (suggestion && suggestion.content) {
                        this.pendingChanges.push({
                            field: missingField,
                            suggestion: suggestion.content,
                            confidence: suggestion.confidence || 0.8,
                            fieldType: suggestion.fieldType || 'text'
                        });
                    }
                    
                    processedCount++;
                    
                    // 移除延迟，按用户要求
                    
                } catch (error) {
                    console.error('生成建议失败:', error);
                }
            }

            this.hideThinkingIndicator();

            if (this.pendingChanges.length > 0) {
                let message = `🎉 智能补全完成！\n\n`;
                message += `📝 生成建议：${this.pendingChanges.length} 条\n`;
                message += `🎯 覆盖字段：${new Set(this.pendingChanges.map(c => c.field.fieldName)).size} 种\n`;
                message += `💡 平均置信度：${(this.pendingChanges.reduce((sum, c) => sum + c.confidence, 0) / this.pendingChanges.length * 100).toFixed(0)}%\n\n`;
                
                this.addMessage(message, 'assistant');
                this.updateStatus(`生成 ${this.pendingChanges.length} 条建议`, 'success');
                
            } else {
                this.addMessage('❌ 未能生成有效建议，请检查API配置或稍后重试。', 'assistant');
                this.updateStatus('补全失败', 'error');
            }

        } catch (error) {
            console.error('智能补全失败:', error);
            this.hideThinkingIndicator();
            this.updateStatus('补全失败', 'error');
            this.addMessage('❌ 智能补全失败，请稍后重试。', 'assistant');
        }
    }



    // 新增：生成字段建议
    async generateFieldSuggestion(missingField) {
        const fieldName = missingField.fieldName;
        const context = missingField.companyContext;
        const rules = this.fieldCompletionRules[fieldName];
        
        if (!rules) {
            return null;
        }

        // 构建智能提示词
        let prompt = `你是专业的企业信息分析师。请为"${fieldName}"字段提供准确信息。

公司信息：
${Object.entries(context).map(([key, value]) => `${key}: ${value}`).join('\n')}

要求：${rules.prompt}`;

        if (rules.options) {
            prompt += `\n\n可选项：${rules.options.join('、')}`;
            prompt += `\n请从上述选项中选择最合适的一个。`;
        }

        if (rules.maxLength) {
            prompt += `\n字数限制：不超过${rules.maxLength}字`;
        }

        prompt += `\n\n请直接提供"${fieldName}"的值，不要解释：`;

        try {
            const response = await this.callDeepSeekAPI(prompt, { tables: [] }, 'deepseek-chat');
            
            if (response && response.content && !response.content.includes('抱歉，AI服务暂时无法连接')) {
                let suggestion = response.content.trim();
                
                // 清理回复
                suggestion = suggestion.replace(/^(根据|基于|建议|答案|结果)[：:]\s*/g, '');
                suggestion = suggestion.replace(/^["'"`'"]|["'"`'"]$/g, '');
                suggestion = suggestion.split('\n')[0];
                
                // 选项验证
                if (rules.options) {
                    const matchedOption = rules.options.find(option => 
                        suggestion.toLowerCase().includes(option.toLowerCase()) ||
                        option.toLowerCase().includes(suggestion.toLowerCase())
                    );
                    if (matchedOption) {
                        suggestion = matchedOption;
                    } else if (!rules.options.includes(suggestion)) {
                        suggestion = rules.options[0]; // 默认第一个选项
                    }
                }
                
                // 长度限制
                if (rules.maxLength && suggestion.length > rules.maxLength) {
                    suggestion = suggestion.substring(0, rules.maxLength);
                }
                
                // 验证
                if (rules.validation && !rules.validation(suggestion)) {
                    console.warn(`字段验证失败: ${fieldName} = ${suggestion}`);
                    return null;
                }
                
                return {
                    content: suggestion,
                    confidence: this.calculateConfidence(suggestion, rules),
                    fieldType: this.getFieldType(fieldName)
                };
            }
        } catch (error) {
            console.error(`生成字段建议失败 [${fieldName}]:`, error);
        }
        
        return null;
    }

    // 新增：更新状态显示
    updateStatus(message, type = 'info') {
        console.log(`状态: ${message}`);
    }

    // API使用统计方法已移除，按用户要求

    // 新增：计算置信度
    calculateConfidence(suggestion, rules) {
        let confidence = 0.7;
        
        if (rules.options && rules.options.includes(suggestion)) {
            confidence += 0.2;
        }
        
        if (rules.validation && rules.validation(suggestion)) {
            confidence += 0.1;
        }
        
        if (suggestion.length > 5) {
            confidence += 0.05;
        }
        
        return Math.min(confidence, 1.0);
    }

    // 新增：获取字段类型
    getFieldType(fieldName) {
        const typeMap = {
            '参考价值': 'selection',
            '应用场景': 'selection',
            '发展阶段': 'selection',
            '业务模式': 'selection',
            '成立国家': 'selection',
            '公司类别': 'selection',
            '成立时间': 'date',
            '最后更新时间': 'date',
            '服务连接': 'url',
            '公司参考资料/链接': 'url'
        };
        return typeMap[fieldName] || 'text';
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

// 全局 Ctrl+Q 快捷键监听器（独立于类初始化）
/** Ctrl/⌘ + Q 全局快捷键：切换 AI 侧栏显示/隐藏  **************************/

// 避免被重复注入（热更新/多次执行）
if (!window.__DS_CTRL_Q_BOUND__) {
    window.__DS_CTRL_Q_BOUND__ = true;
  
    // 统一的 CSS 开关：避免被其他样式覆盖（!important）
    const CSS_ID = 'ds-sidebar-toggle-style';
    if (!document.getElementById(CSS_ID)) {
      const style = document.createElement('style');
      style.id = CSS_ID;
      style.textContent = `
        #deepseek-ai-sidebar.ds-hidden { transform: translateX(100%) !important; }
        #deepseek-ai-sidebar        { transition: transform .25s ease; }
      `;
      document.head.appendChild(style);
    }
  
    // 防抖 & 长按防重触发
    let lastTs = 0;
    const COOLDOWN = 220; // ms
  
    function setButtonSymbol(visible) {
      const btn = document.getElementById('toggle-sidebar');
      if (btn) btn.textContent = visible ? '−' : '+';
    }
  
    function toggleSidebarVisibility() {
      const sidebar = document.getElementById('deepseek-ai-sidebar');
      if (!sidebar) return false;
  
      const willHide = !sidebar.classList.contains('ds-hidden'); // 现在可见→将隐藏
      sidebar.classList.toggle('ds-hidden', willHide);
      setButtonSymbol(!willHide);
  
      // 记住用户选择，刷新后还原（可选）
      try {
        localStorage.setItem('ds_sidebar_hidden', String(willHide));
      } catch {}
      return true;
    }
  
    // 初始还原（可选）
    try {
      const storedValue = localStorage.getItem('ds_sidebar_hidden');
      // 如果 localStorage 中没有值，默认隐藏（null 或 undefined）
      const hidden = storedValue === null ? true : storedValue === 'true';
      const sb = document.getElementById('deepseek-ai-sidebar');
      if (sb) {
        sb.classList.toggle('ds-hidden', hidden);
        setButtonSymbol(!hidden);
      }
    } catch {}
  
    function handleCtrlQ(e) {
      // 仅在 Ctrl/⌘ + Q 时触发
      const hit = (e.ctrlKey || e.metaKey) &&
                  (e.key?.toLowerCase() === 'q' || e.code === 'KeyQ');
      if (!hit) return;
  
      // 过滤输入框/可编辑区域（避免影响正在输入）
      const target = e.target;
      const inEditor = target &&
        (target.closest?.('input, textarea, [contenteditable="true"], [contenteditable=""]'));
  
      if (inEditor) return;
  
      // 防长按 & 防抖
      const now = Date.now();
      if (e.repeat || now - lastTs < COOLDOWN) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      lastTs = now;
  
      e.preventDefault();
      e.stopPropagation();
  
      // 先尝试 DOM 切换
      const ok = toggleSidebarVisibility();
  
      // 如果没有找到元素，尝试调用实例方法
      if (!ok && window.deepseekAssistant?.toggleSidebar) {
        window.deepseekAssistant.toggleSidebar();
      }
    }
  
    // 只绑定**一个**捕获型监听器即可（避免多次触发）
    window.addEventListener('keydown', handleCtrlQ, { capture: true });
  
    console.log('✅ 已设置 Ctrl/⌘ + Q 切换侧栏（单监听，防抖，防重复）');
  }
  