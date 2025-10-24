// Vercel无服务器函数 - 放在 /api/deepseek.js
export default async function handler(req, res) {
    // 设置CORS头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // 处理预检请求
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: '只支持POST请求' });
    }
    
    try {
        const { message, apiKey } = req.body;
        
        const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [
                    {
                        role: 'system',
                        content: '你是一个专业的表格数据分析助手。'
                    },
                    {
                        role: 'user',
                        content: message
                    }
                ],
                temperature: 0.2,  // 数据提取任务需要精确性，降低随机性
                max_tokens: 350  // 17字段TSV优化后刚好够用，避免浪费
            })
        });
        
        if (!response.ok) {
            throw new Error(`API错误: ${response.status}`);
        }
        
        const data = await response.json();
        
        res.json({
            success: true,
            message: data.choices[0].message.content
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}
