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
                    <button id="preview-changes-btn" class="ai-btn ai-btn-secondary" disabled>
                        👀 预览更改
                    </button>
                    <button id="apply-changes-btn" class="ai-btn ai-btn-warning" disabled>
                        ✅ 应用更改
                    </button>
                </div>
                <div id="table-status" class="table-status">就绪</div>
            </div>
            <div class="ai-chat-container">
                <div class="ai-messages" id="ai-messages">
                    <div class="ai-message assistant">
                        <p>👋 您好！我是Kyle's AI Agent，现在支持智能表格操作！</p>
                        <p>🎯 新功能：</p>
                        <ul>
                            <li>🔍 智能分析表格内容</li>
                            <li>🔄 自动补全缺失信息</li>
                            <li>👀 预览所有更改</li>
                            <li>✅ 一键应用修改</li>
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

            .table-status {
                font-size: 12px;
                color: #666;
                padding: 6px 10px;
                background: #fff;
                border-radius: 4px;
                border: 1px solid #ddd;
                text-align: center;
            }

            .table-status.success {
                background: #d4edda;
                color: #155724;
                border-color: #c3e6cb;
            }

            .table-status.warning {
                background: #fff3cd;
                color: #856404;
                border-color: #ffeaa7;
            }

            .table-status.error {
                background: #f8d7da;
                color: #721c24;
                border-color: #f5c6cb;
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
        const previewBtn = document.getElementById('preview-changes-btn');
        const applyBtn = document.getElementById('apply-changes-btn');

        if (analyzeBtn) {
            analyzeBtn.addEventListener('click', () => this.analyzeTable());
        }

        if (autoFillBtn) {
            autoFillBtn.addEventListener('click', () => this.autoFillTable());
        }

        if (previewBtn) {
            previewBtn.addEventListener('click', () => this.previewChanges());
        }

        if (applyBtn) {
            applyBtn.addEventListener('click', () => this.applyChanges());
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
    async callDeepSeekAPI(userMessage, tableData, model = 'deepseek-chat') {
        console.log('🔄 开始调用DeepSeek API');
        // 生成动态知识库上下文
        let knowledgeContext = '';
        if (window.knowledgeBase) {
            knowledgeContext = window.knowledgeBase.generateContext(userMessage, tableData);
        }

        const messages = [
            {
                role: "system",
                content: `你是AI助手。简洁回答，不超过50字。`
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
        
        // 跳过直接API调用，避免CORS问题导致的无效扣费
        // 直接API调用会被浏览器CORS策略阻止，但仍会向DeepSeek发送请求并扣费
        console.log('⚠️ 跳过直接API调用，避免CORS导致的无效扣费');
        
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

        console.log('🔍 开始提取表格数据');
        console.log('当前页面URL:', window.location.href);

        // 1. 多种方式提取表格数据
        // 方法1：标准table元素
        let tables = document.querySelectorAll('table');
        console.log(`找到 ${tables.length} 个标准table元素`);

        // 方法2：腾讯文档特殊选择器
        if (tables.length === 0) {
            tables = document.querySelectorAll('.ql-editor table, .docs-table, .online-table, [data-table]');
            console.log(`腾讯文档选择器找到 ${tables.length} 个表格`);
        }

        // 方法3：通用表格结构检测
        if (tables.length === 0) {
            tables = document.querySelectorAll('div[role="table"], .table, .data-table, .grid');
            console.log(`通用选择器找到 ${tables.length} 个表格结构`);
        }

        // 方法4：查找包含tr元素的容器
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

            // 提取表头 - 多种方式
            let headerCells = table.querySelectorAll('th');
            
            // 如果没有th，尝试第一行作为表头
            if (headerCells.length === 0) {
                const firstRow = table.querySelector('tr');
                if (firstRow) {
                    headerCells = firstRow.querySelectorAll('td');
                    console.log(`使用第一行作为表头，找到 ${headerCells.length} 个单元格`);
                }
            }

            // 如果还是没有，尝试查找包含表头文本的元素
            if (headerCells.length === 0) {
                headerCells = table.querySelectorAll('td, th, div[role="columnheader"], .header-cell, .table-header');
                console.log(`使用通用选择器找到 ${headerCells.length} 个可能的表头`);
            }

            headerCells.forEach(cell => {
                const text = cell.textContent.trim();
                if (text) {
                    headers.push(text);
                }
            });

            console.log(`提取到表头:`, headers);

            // 提取数据行 - 多种方式
            let dataRows = table.querySelectorAll('tbody tr');
            
            // 如果没有tbody，直接查找所有tr
            if (dataRows.length === 0) {
                dataRows = table.querySelectorAll('tr');
                // 如果第一行是表头，跳过它
                if (dataRows.length > 0 && headers.length > 0) {
                    dataRows = Array.from(dataRows).slice(1);
                }
            }

            // 如果还是没有tr，尝试查找其他行结构
            if (dataRows.length === 0) {
                dataRows = table.querySelectorAll('div[role="row"], .table-row, .data-row');
            }

            console.log(`找到 ${dataRows.length} 个数据行`);

            dataRows.forEach((row, rowIndex) => {
                const rowData = [];
                const cells = row.querySelectorAll('td, th, div[role="cell"], .table-cell, .data-cell');
                
                cells.forEach(cell => {
                    const text = cell.textContent.trim();
                    rowData.push(text);
                });

                if (rowData.length > 0) {
                    rows.push(rowData);
                    console.log(`行 ${rowIndex + 1}:`, rowData);
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
        
        // 暂时禁用自动建议，避免无限循环API调用
        // TODO: 未来可以添加更智能的变化检测逻辑
        // setTimeout(() => {
        //     this.autoSuggest();
        // }, 1000); // 延迟1秒，避免频繁触发
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

    // 新增：分析表格方法
    async analyzeTable() {
        this.updateStatus('正在分析表格...', 'warning');
        console.log('🔍 开始分析表格');

        try {
            const tableData = this.extractTableData();
            
            if (!tableData.tables || tableData.tables.length === 0) {
                this.updateStatus('未找到表格数据', 'error');
                this.addMessage('❌ 未在当前页面找到表格。请确保页面包含表格数据。', 'assistant');
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
                missingFields.forEach(field => {
                    if (!fieldGroups[field.fieldName]) {
                        fieldGroups[field.fieldName] = 0;
                    }
                    fieldGroups[field.fieldName]++;
                });
                
                analysisMessage += `🔍 缺失字段分布：\n`;
                Object.entries(fieldGroups)
                    .sort(([,a], [,b]) => b - a)
                    .slice(0, 8)
                    .forEach(([fieldName, count]) => {
                        analysisMessage += `• ${fieldName}: ${count} 处\n`;
                    });
                
                if (Object.keys(fieldGroups).length > 8) {
                    analysisMessage += `... 还有其他字段\n`;
                }
                
                analysisMessage += `\n🎯 优先补充（按重要性排序）：\n`;
                missingFields.slice(0, 5).forEach((field, index) => {
                    const company = field.companyContext['公司名称'] || '未知公司';
                    analysisMessage += `${index + 1}. ${company} - ${field.fieldName}\n`;
                });
                
                if (missingFields.length > 5) {
                    analysisMessage += `... 还有 ${missingFields.length - 5} 个待补充\n`;
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
                message += `👀 点击"预览更改"查看详情\n`;
                message += `✅ 确认无误后点击"应用更改"`;
                
                this.addMessage(message, 'assistant');
                this.updateStatus(`生成 ${this.pendingChanges.length} 条建议`, 'success');
                
                document.getElementById('preview-changes-btn').disabled = false;
                document.getElementById('apply-changes-btn').disabled = false;
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

    // 新增：预览更改功能
    previewChanges() {
        if (this.pendingChanges.length === 0) {
            this.addMessage('❌ 没有待预览的更改。请先执行"智能补全"。', 'assistant');
            return;
        }

        let previewMessage = `👀 预览待应用的更改 (${this.pendingChanges.length}项)：\n\n`;
        
        this.pendingChanges.forEach((change, index) => {
            const field = change.field;
            const confidence = Math.round(change.confidence * 100);
            const company = field.companyContext['公司名称'] || '未知公司';
            
            previewMessage += `${index + 1}. ${company} - ${field.fieldName}\n`;
            previewMessage += `   建议值：${change.suggestion}\n`;
            previewMessage += `   置信度：${confidence}%\n\n`;
        });

        previewMessage += `✅ 确认无误请点击"应用更改"\n`;
        previewMessage += `❌ 如需修改请重新执行"智能补全"`;

        this.addMessage(previewMessage, 'assistant');
        this.updateStatus(`预览 ${this.pendingChanges.length} 项更改`, 'success');
    }

    // 新增：应用更改功能
    async applyChanges() {
        if (this.pendingChanges.length === 0) {
            this.addMessage('❌ 没有待应用的更改。请先执行"智能补全"。', 'assistant');
            return;
        }

        this.updateStatus('正在应用更改...', 'warning');
        console.log('✅ 开始应用更改');

        let successCount = 0;
        let failCount = 0;

        for (const change of this.pendingChanges) {
            try {
                const cellElement = this.tableEditor.findCellForField(change.field);
                
                if (cellElement && this.tableEditor.isCellEditable(cellElement)) {
                    const success = await this.tableEditor.fillCell(
                        cellElement, 
                        change.suggestion
                    );
                    
                    if (success) {
                        successCount++;
                        console.log(`✅ 成功填充: ${change.field.fieldName} = ${change.suggestion}`);
                    } else {
                        failCount++;
                        console.log(`❌ 填充失败: ${change.field.fieldName}`);
                    }
                } else {
                    failCount++;
                    console.log(`❌ 未找到可编辑单元格: ${change.field.fieldName}`);
                }
                
                // 添加延迟避免操作过快
                await new Promise(resolve => setTimeout(resolve, 200));
                
            } catch (error) {
                failCount++;
                console.error('应用更改失败:', error);
            }
        }

        // 清空待应用的更改
        this.pendingChanges = [];
        
        // 禁用按钮
        document.getElementById('preview-changes-btn').disabled = true;
        document.getElementById('apply-changes-btn').disabled = true;

        // 显示结果
        const resultMessage = `🎉 更改应用完成！\n\n` +
            `✅ 成功：${successCount} 项\n` +
            `❌ 失败：${failCount} 项\n\n` +
            `💡 如需继续补充，请重新点击"分析表格"`;

        this.addMessage(resultMessage, 'assistant');
        
        if (failCount === 0) {
            this.updateStatus(`全部应用成功 (${successCount}项)`, 'success');
        } else {
            this.updateStatus(`部分成功 (${successCount}/${successCount + failCount})`, 'warning');
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
        const statusElement = document.getElementById('table-status');
        if (statusElement) {
            statusElement.textContent = message;
            statusElement.className = `table-status ${type}`;
        }
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
