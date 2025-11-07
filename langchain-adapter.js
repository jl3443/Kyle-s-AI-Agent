// LangChain适配器 - 为Chrome扩展提供链式处理能力
// 实现类似LangChain的Chains, Memory, Tools等概念

/**
 * LangChain适配器 - 提供链式处理、记忆管理、工具调用等功能
 */
class LangChainAdapter {
    constructor(apiKey, model = 'deepseek-chat') {
        this.apiKey = apiKey;
        this.model = model;
        this.memory = new ConversationBufferMemory();
        this.tools = new ToolRegistry();
        this.chains = new ChainRegistry();
        this.outputParsers = new OutputParserRegistry();
        
        // 注册默认工具
        this.registerDefaultTools();
        
        // 注册默认链
        this.registerDefaultChains();
    }

    /**
     * 注册默认工具
     */
    registerDefaultTools() {
        // 知识库搜索工具
        this.tools.register('knowledge_search', {
            name: 'knowledge_search',
            description: '在知识库中搜索相关信息',
            execute: async (query) => {
                if (window.knowledgeBase) {
                    return window.knowledgeBase.searchKnowledge(query);
                }
                return [];
            }
        });

        // 表格分析工具
        this.tools.register('table_analysis', {
            name: 'table_analysis',
            description: '分析当前页面的表格数据',
            execute: async () => {
                return this.extractTableData();
            }
        });

        // TSV格式化工具
        this.tools.register('tsv_formatter', {
            name: 'tsv_formatter',
            description: '将数据格式化为TSV格式',
            execute: async (data) => {
                return this.formatAsTSV(data);
            }
        });
    }

    /**
     * 注册默认链
     */
    registerDefaultChains() {
        // 对话链 - 处理普通对话
        this.chains.register('conversation', new ConversationChain(this));
        
        // 分析链 - 处理金融产品分析
        this.chains.register('analysis', new AnalysisChain(this));
        
        // 智能路由链 - 根据用户意图选择链
        this.chains.register('router', new RouterChain(this));
    }

    /**
     * 运行链式处理
     */
    async run(chainName, input, options = {}) {
        const chain = this.chains.get(chainName);
        if (!chain) {
            throw new Error(`Chain "${chainName}" not found`);
        }
        
        return await chain.run(input, {
            memory: this.memory,
            tools: this.tools,
            ...options
        });
    }

    /**
     * 智能路由 - 自动选择最合适的链
     */
    async route(input) {
        const router = this.chains.get('router');
        return await router.run(input);
    }

    /**
     * 提取表格数据
     */
    extractTableData() {
        const tables = document.querySelectorAll('table');
        const tableData = [];
        
        tables.forEach((table, index) => {
            const headers = [];
            const rows = [];
            
            // 提取表头
            const headerRow = table.querySelector('thead tr, tr:first-child');
            if (headerRow) {
                headerRow.querySelectorAll('th, td').forEach(cell => {
                    headers.push(cell.textContent.trim());
                });
            }
            
            // 提取数据行
            const dataRows = table.querySelectorAll('tbody tr, tr:not(:first-child)');
            dataRows.forEach(row => {
                const rowData = [];
                row.querySelectorAll('td, th').forEach(cell => {
                    rowData.push(cell.textContent.trim());
                });
                if (rowData.length > 0) {
                    rows.push(rowData);
                }
            });
            
            if (headers.length > 0 || rows.length > 0) {
                tableData.push({
                    index,
                    headers,
                    rows
                });
            }
        });
        
        return tableData;
    }

    /**
     * TSV格式化
     */
    formatAsTSV(data) {
        if (Array.isArray(data)) {
            return data.map(row => row.join('\t')).join('\n');
        }
        return String(data);
    }
}

/**
 * 对话记忆管理
 */
class ConversationBufferMemory {
    constructor(maxHistory = 20) {
        this.history = [];
        this.maxHistory = maxHistory;
    }

    addMessage(role, content) {
        this.history.push({ role, content, timestamp: Date.now() });
        
        // 保持历史记录在合理范围
        if (this.history.length > this.maxHistory) {
            this.history = this.history.slice(-this.maxHistory);
        }
    }

    getHistory() {
        return this.history;
    }

    clear() {
        this.history = [];
    }

    getContext() {
        return this.history.map(msg => ({
            role: msg.role,
            content: msg.content
        }));
    }
}

/**
 * 工具注册表
 */
class ToolRegistry {
    constructor() {
        this.tools = new Map();
    }

    register(name, tool) {
        this.tools.set(name, tool);
    }

    get(name) {
        return this.tools.get(name);
    }

    async execute(name, ...args) {
        const tool = this.get(name);
        if (!tool) {
            throw new Error(`Tool "${name}" not found`);
        }
        return await tool.execute(...args);
    }

    list() {
        return Array.from(this.tools.values());
    }
}

/**
 * 链注册表
 */
class ChainRegistry {
    constructor() {
        this.chains = new Map();
    }

    register(name, chain) {
        this.chains.set(name, chain);
    }

    get(name) {
        return this.chains.get(name);
    }
}

/**
 * 基础链类
 */
class BaseChain {
    constructor(adapter) {
        this.adapter = adapter;
    }

    async run(input, options = {}) {
        throw new Error('run() method must be implemented');
    }
}

/**
 * 对话链 - 处理普通对话
 */
class ConversationChain extends BaseChain {
    async run(input, options = {}) {
        const { memory, tools } = options;
        
        // 构建消息
        const messages = [
            {
                role: 'system',
                content: `你是Kyle's AI Agent，一个友好的AI助手。

**关于你的能力**：
- 你通过DeepSeek API工作，可以正常进行对话
- 你可以回答问题、提供帮助、进行友好对话
- 你不能调用其他外部API（如天气、股票等），但可以基于知识库回答

保持回复简洁、有用、友好。当用户问"你能调用API吗"时，回答：是的，我通过DeepSeek API工作，可以对话和分析。但我不能调用其他外部API。`
            },
            ...memory.getContext(),
            {
                role: 'user',
                content: input
            }
        ];

        // 调用API
        const response = await this.callAPI(messages);
        
        // 更新记忆
        memory.addMessage('user', input);
        memory.addMessage('assistant', response);

        return response;
    }

    async callAPI(messages) {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({
                type: 'CALL_DEEPSEEK_API',
                messages: messages,
                apiKey: this.adapter.apiKey,
                model: this.adapter.model
            }, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else if (response && response.success) {
                    const content = response.data?.choices?.[0]?.message?.content;
                    if (content) {
                        resolve(content);
                    } else {
                        reject(new Error('API返回数据格式不正确'));
                    }
                } else {
                    reject(new Error(response?.error || '未知错误'));
                }
            });
        });
    }
}

/**
 * 分析链 - 处理金融产品分析
 */
class AnalysisChain extends BaseChain {
    async run(input, options = {}) {
        const { memory, tools } = options;
        
        // 使用知识库工具搜索相关信息
        const knowledgeResults = await tools.execute('knowledge_search', input);
        
        // 获取表格数据
        const tableData = await tools.execute('table_analysis');
        
        // 构建系统提示词
        const systemPrompt = this.buildSystemPrompt(knowledgeResults, tableData);
        
        // 构建消息
        const messages = [
            {
                role: 'system',
                content: systemPrompt
            },
            ...memory.getContext(),
            {
                role: 'user',
                content: input
            }
        ];

        // 调用API
        const response = await this.callAPI(messages);
        
        // 解析输出（检查是否是TSV格式）
        const parsedResponse = this.parseOutput(response);
        
        // 更新记忆
        memory.addMessage('user', input);
        memory.addMessage('assistant', response);

        return parsedResponse;
    }

    buildSystemPrompt(knowledgeResults, tableData) {
        return `你是Kyle's AI Agent，一个金融AI产品分析助手。

**关于你的能力**：
- 你通过DeepSeek API工作，可以正常进行对话和分析
- 你可以访问知识库、分析表格数据、提供专业建议
- 你不能调用其他外部API（如天气、股票、新闻等第三方API）
- 但你可以基于已有知识和数据进行分析和回答

**核心能力**：
1. 友好对话：回答问题、闲聊、提供帮助、解释概念
2. 金融AI产品分析：输出标准TSV格式数据
3. 知识库查询：基于内置知识库提供专业分析
4. 表格分析：分析当前页面的表格数据

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
- 普通对话（如"你好"、"在吗"、"你能调用API吗"）→ 用自然语言友好回复，说明你的能力范围
- 产品分析请求（如"分析AlphaSense"、"公司XXX"）→ 直接输出TSV，无需表头
- 当用户问"你能调用API吗"时，回答：是的，我通过DeepSeek API工作，可以对话和分析。但我不能调用其他外部API（如天气、股票等）。我可以访问知识库和分析表格数据。
- 根据用户意图智能选择回复方式

${knowledgeResults.length > 0 ? `\n**相关知识库信息**：\n${JSON.stringify(knowledgeResults, null, 2)}` : ''}
${tableData.length > 0 ? `\n**当前页面表格数据**：\n${JSON.stringify(tableData, null, 2)}` : ''}`;
    }

    parseOutput(response) {
        // 检查是否是TSV格式（包含Tab分隔符）
        if (response.includes('\t') && response.split('\t').length >= 10) {
            return {
                type: 'tsv',
                data: response,
                raw: response
            };
        }
        
        return {
            type: 'text',
            data: response,
            raw: response
        };
    }

    async callAPI(messages) {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({
                type: 'CALL_DEEPSEEK_API',
                messages: messages,
                apiKey: this.adapter.apiKey,
                model: this.adapter.model
            }, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else if (response && response.success) {
                    const content = response.data?.choices?.[0]?.message?.content;
                    if (content) {
                        resolve(content);
                    } else {
                        reject(new Error('API返回数据格式不正确'));
                    }
                } else {
                    reject(new Error(response?.error || '未知错误'));
                }
            });
        });
    }
}

/**
 * 路由链 - 根据用户意图选择最合适的链
 */
class RouterChain extends BaseChain {
    async run(input, options = {}) {
        // 简单的意图识别
        const intent = this.detectIntent(input);
        
        if (intent === 'analysis') {
            // 使用分析链
            const analysisChain = this.adapter.chains.get('analysis');
            return await analysisChain.run(input, options);
        } else {
            // 使用对话链
            const conversationChain = this.adapter.chains.get('conversation');
            return await conversationChain.run(input, options);
        }
    }

    detectIntent(input) {
        const analysisKeywords = ['分析', '评估', '公司', '产品', 'TSV', 'AlphaSense'];
        const lowerInput = input.toLowerCase();
        
        for (const keyword of analysisKeywords) {
            if (lowerInput.includes(keyword.toLowerCase())) {
                return 'analysis';
            }
        }
        
        return 'conversation';
    }
}

/**
 * 输出解析器注册表
 */
class OutputParserRegistry {
    constructor() {
        this.parsers = new Map();
    }

    register(name, parser) {
        this.parsers.set(name, parser);
    }

    get(name) {
        return this.parsers.get(name);
    }

    parse(name, output) {
        const parser = this.get(name);
        if (!parser) {
            return output;
        }
        return parser.parse(output);
    }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { LangChainAdapter };
} else {
    window.LangChainAdapter = LangChainAdapter;
}

