// 商分内部知识库系统
class KnowledgeBase {
    constructor() {
        this.knowledgeData = {
            // 公司数据库
            companies: {},
            // 行业报告
            industryReports: {},
            // 分析模板
            analysisTemplates: {},
            // 自定义数据
            customData: {}
        };
        this.loadKnowledgeBase();
    }

    // 加载知识库
    async loadKnowledgeBase() {
        try {
            // 从Chrome存储加载知识库
            const stored = await this.getStoredKnowledge();
            if (stored) {
                this.knowledgeData = { ...this.knowledgeData, ...stored };
            }
            
            // 加载默认知识库
            this.loadDefaultKnowledge();
        } catch (error) {
            console.error('知识库加载失败:', error);
        }
    }

    // 获取存储的知识库
    getStoredKnowledge() {
        return new Promise((resolve) => {
            if (typeof chrome !== 'undefined' && chrome.storage) {
                chrome.storage.local.get(['knowledgeBase'], (result) => {
                    resolve(result.knowledgeBase);
                });
            } else {
                resolve(null);
            }
        });
    }

    // 保存知识库
    saveKnowledgeBase() {
        if (typeof chrome !== 'undefined' && chrome.storage) {
            chrome.storage.local.set({ knowledgeBase: this.knowledgeData });
        }
    }

    // 加载默认知识库
    loadDefaultKnowledge() {
        // 行业分析模板
        this.knowledgeData.analysisTemplates = {
            companyAnalysis: {
                name: "公司分析模板",
                framework: [
                    "1. 基本信息：公司名称、成立时间、主营业务、注册资本",
                    "2. 商业模式：收入来源、客户群体、价值主张、成本结构",
                    "3. 市场地位：市场份额、竞争优势、品牌价值",
                    "4. 财务状况：营收规模、盈利能力、现金流、负债情况",
                    "5. 发展前景：增长潜力、风险因素、投资价值"
                ]
            },
            marketAnalysis: {
                name: "市场分析模板",
                framework: [
                    "1. 市场规模：总体市场容量、增长率、细分市场",
                    "2. 竞争格局：主要参与者、市场集中度、竞争强度",
                    "3. 发展趋势：技术趋势、消费趋势、政策趋势",
                    "4. 机会与威胁：新兴机会、潜在风险、监管变化"
                ]
            }
        };

        // 行业知识
        this.knowledgeData.industryReports = {
            tech: {
                name: "科技行业",
                keyMetrics: ["用户增长率", "月活跃用户", "收入增长", "研发投入比例"],
                valuationMethods: ["P/S倍数", "EV/Revenue", "DCF模型"],
                trends: ["AI应用", "云原生", "数字化转型", "数据安全"]
            },
            finance: {
                name: "金融行业",
                keyMetrics: ["净息差", "资产质量", "资本充足率", "ROE"],
                valuationMethods: ["P/B倍数", "P/E倍数", "股息折现模型"],
                trends: ["数字银行", "区块链", "监管科技", "ESG投资"]
            }
        };

        // 常用分析指标
        this.knowledgeData.customData.metrics = {
            profitability: ["毛利率", "净利率", "ROE", "ROA", "ROIC"],
            growth: ["营收增长率", "利润增长率", "用户增长率", "市场份额增长"],
            efficiency: ["资产周转率", "存货周转率", "应收账款周转率"],
            liquidity: ["流动比率", "速动比率", "现金比率"],
            leverage: ["资产负债率", "权益乘数", "利息保障倍数"]
        };
    }

    // 添加公司数据
    addCompanyData(companyName, data) {
        this.knowledgeData.companies[companyName] = {
            ...data,
            addedDate: new Date().toISOString()
        };
        this.saveKnowledgeBase();
    }

    // 获取公司数据
    getCompanyData(companyName) {
        return this.knowledgeData.companies[companyName] || null;
    }

    // 搜索相关知识
    searchKnowledge(query) {
        const results = [];
        const queryLower = query.toLowerCase();

        // 搜索公司数据
        Object.keys(this.knowledgeData.companies).forEach(companyName => {
            if (companyName.toLowerCase().includes(queryLower)) {
                results.push({
                    type: 'company',
                    name: companyName,
                    data: this.knowledgeData.companies[companyName]
                });
            }
        });

        // 搜索行业报告
        Object.keys(this.knowledgeData.industryReports).forEach(industry => {
            const report = this.knowledgeData.industryReports[industry];
            if (report.name.toLowerCase().includes(queryLower) || 
                report.trends.some(trend => trend.toLowerCase().includes(queryLower))) {
                results.push({
                    type: 'industry',
                    name: report.name,
                    data: report
                });
            }
        });

        return results;
    }

    // 生成上下文信息
    generateContext(userMessage, pageData) {
        const context = [];
        
        // 添加页面相关的知识
        const searchResults = this.searchKnowledge(pageData.title || '');
        if (searchResults.length > 0) {
            context.push("# 相关知识库信息：");
            searchResults.forEach(result => {
                context.push(`## ${result.name} (${result.type})`);
                context.push(JSON.stringify(result.data, null, 2));
            });
        }

        // 添加分析框架
        if (userMessage.includes('分析') || userMessage.includes('评估')) {
            context.push("# 分析框架：");
            context.push(JSON.stringify(this.knowledgeData.analysisTemplates.companyAnalysis.framework, null, 2));
        }

        // 添加行业指标
        const industryKeywords = ['科技', '金融', '银行', '保险', 'AI', '云计算'];
        const matchedIndustry = industryKeywords.find(keyword => 
            pageData.title?.includes(keyword) || userMessage.includes(keyword)
        );
        
        if (matchedIndustry) {
            const industryKey = matchedIndustry.includes('科技') || matchedIndustry.includes('AI') ? 'tech' : 'finance';
            const industryData = this.knowledgeData.industryReports[industryKey];
            if (industryData) {
                context.push("# 行业专业知识：");
                context.push(JSON.stringify(industryData, null, 2));
            }
        }

        return context.join('\n');
    }
}

// 全局知识库实例
window.knowledgeBase = new KnowledgeBase();
