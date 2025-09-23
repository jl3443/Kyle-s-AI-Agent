// DeepSeek AI助手 Chrome扩展设置页面

document.addEventListener('DOMContentLoaded', function() {
    const apiKeyInput = document.getElementById('apiKey');
    const modelSelect = document.getElementById('model');
    const saveBtn = document.getElementById('saveBtn');
    const statusDiv = document.getElementById('status');

    // 加载已保存的设置
    loadSettings();

    // 保存按钮点击事件
    saveBtn.addEventListener('click', saveSettings);

    // API密钥输入变化时的验证
    apiKeyInput.addEventListener('input', function() {
        const apiKey = apiKeyInput.value.trim();
        if (apiKey) {
            validateApiKey(apiKey);
        }
    });

    // 加载设置
    function loadSettings() {
        chrome.storage.sync.get(['deepseekApiKey', 'deepseekModel'], function(result) {
            if (result.deepseekApiKey) {
                apiKeyInput.value = result.deepseekApiKey;
            }
            if (result.deepseekModel) {
                modelSelect.value = result.deepseekModel;
            }
        });
    }

    // 保存设置
    function saveSettings() {
        const apiKey = apiKeyInput.value.trim();
        const model = modelSelect.value;

        if (!apiKey) {
            showStatus('请输入DeepSeek API密钥', 'error');
            return;
        }

        // 验证API密钥格式
        if (!apiKey.startsWith('sk-')) {
            showStatus('API密钥格式不正确，应该以sk-开头', 'error');
            return;
        }

        saveBtn.disabled = true;
        saveBtn.textContent = '保存中...';

        // 验证API密钥是否有效
        validateApiKey(apiKey).then(isValid => {
            if (isValid) {
                // 保存到Chrome存储
                chrome.storage.sync.set({
                    deepseekApiKey: apiKey,
                    deepseekModel: model
                }, function() {
                    showStatus('设置保存成功！', 'success');
                    saveBtn.disabled = false;
                    saveBtn.textContent = '保存设置';

                    // 通知内容脚本重新初始化
                    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                        if (tabs[0] && tabs[0].url.includes('docs.qq.com')) {
                            chrome.tabs.sendMessage(tabs[0].id, {
                                type: 'SETTINGS_UPDATED',
                                apiKey: apiKey,
                                model: model
                            });
                        }
                    });
                });
            } else {
                showStatus('API密钥验证失败，请检查密钥是否正确', 'error');
                saveBtn.disabled = false;
                saveBtn.textContent = '保存设置';
            }
        });
    }

    // 验证API密钥
    async function validateApiKey(apiKey) {
        try {
            const response = await fetch('https://api.deepseek.com/v1/models', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            return response.ok;
        } catch (error) {
            console.error('API密钥验证失败:', error);
            return false;
        }
    }

    // 显示状态信息
    function showStatus(message, type) {
        statusDiv.textContent = message;
        statusDiv.className = `status ${type}`;
        statusDiv.style.display = 'block';

        // 3秒后隐藏状态信息
        setTimeout(() => {
            statusDiv.style.display = 'none';
        }, 3000);
    }

    // 处理快捷键
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            saveSettings();
        }
    });
});
