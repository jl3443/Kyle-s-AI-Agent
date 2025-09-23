// DeepSeek API 代理服务器
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = 3001;

// 启用CORS和JSON解析
app.use(cors());
app.use(express.json());

// DeepSeek API代理端点
app.post('/api/deepseek', async (req, res) => {
    try {
        const { message, apiKey, model = 'deepseek-reasoner' } = req.body;
        
        console.log('收到请求:', message);
        console.log('使用模型:', model);
        
        const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: model,
                messages: [
                    {
                        role: 'system',
                        content: '你是一个专业的表格数据分析助手，专门帮助用户分析腾讯文档中的表格数据，提供智能建议和优化方案。'
                    },
                    {
                        role: 'user',
                        content: message
                    }
                ],
                temperature: 0.7,
                max_tokens: model === 'deepseek-reasoner' ? 800 : 500
            })
        });

        if (!response.ok) {
            throw new Error(`DeepSeek API错误: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        console.log('DeepSeek API响应成功');
        
        res.json({
            success: true,
            message: data.choices[0].message.content
        });

    } catch (error) {
        console.error('代理服务器错误:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 健康检查端点
app.get('/health', (req, res) => {
    res.json({ status: 'OK', message: 'DeepSeek代理服务器运行中' });
});

app.listen(PORT, () => {
    console.log(`🚀 DeepSeek代理服务器启动成功！`);
    console.log(`📡 服务地址: http://localhost:${PORT}`);
    console.log(`🔗 API端点: http://localhost:${PORT}/api/deepseek`);
});
