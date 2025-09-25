// DeepSeek AI助手后台脚本

chrome.runtime.onInstalled.addListener(() => {
    console.log('DeepSeek AI助手已安装');
});

// 监听快捷键命令 - 暂时禁用，让页面内监听器处理
// chrome.commands.onCommand.addListener((command) => {
//     console.log('🎹 收到快捷键命令:', command);
//     
//     if (command === 'toggle-sidebar') {
//         // 向当前活动标签页发送切换消息
//         chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
//             if (tabs[0]) {
//                 chrome.tabs.sendMessage(tabs[0].id, {
//                     type: 'TOGGLE_SIDEBAR'
//                 }).catch(error => {
//                     console.log('发送切换消息失败:', error.message);
//                     // 可能是页面还没有注入内容脚本，忽略错误
//                 });
//             }
//         });
//     }
// });

// 处理来自内容脚本的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'GET_API_KEY') {
        chrome.storage.sync.get(['deepseekApiKey', 'deepseekModel'], (result) => {
            sendResponse({
                apiKey: result.deepseekApiKey,
                model: result.deepseekModel || 'deepseek-reasoner'
            });
        });
        return true; // 保持消息通道开放
    }
    
        // 新增：代理DeepSeek API调用
        if (request.type === 'CALL_DEEPSEEK_API') {
            callDeepSeekAPI(request.messages, request.apiKey, request.model)
                .then(response => {
                    sendResponse({ success: true, data: response });
                })
                .catch(error => {
                    console.error('后台脚本API调用失败:', error);
                    sendResponse({ success: false, error: error.message });
                });
            return true; // 保持异步响应通道开放
        }
});

// 在background script中调用DeepSeek API（绕过CSP限制）
async function callDeepSeekAPI(messages, apiKey, model = 'deepseek-chat') {
    console.log('🔄 后台脚本调用DeepSeek API');
    console.log('消息数量:', messages.length);
    console.log('使用模型:', model);
    console.log('⚠️ 警告：如果使用deepseek-reasoner模型，费用会很高！');
    
    try {
        const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: model,
                messages: messages,
                temperature: 0.7,
                max_tokens: model === 'deepseek-reasoner' ? 200 : 100  // 严格限制token避免费用过高
            })
        });

        if (!response.ok) {
            throw new Error(`API请求失败: ${response.status} - ${response.statusText}`);
        }

        const data = await response.json();
        console.log('✅ DeepSeek API调用成功');
        return data;
    } catch (error) {
        console.error('❌ DeepSeek API调用失败:', error);
        throw error;
    }
}

// 监听标签页更新
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url && tab.url.includes('docs.qq.com')) {
        // 腾讯文档页面加载完成，可以注入脚本
        console.log('腾讯文档页面已加载');
    }
});
