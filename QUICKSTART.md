# 🚀 快速开始 - LangChain + React 版本

## 📦 文件说明

### 核心文件
- `langchain-adapter.js` - LangChain适配器（链、记忆、工具）
- `react-components.jsx` - React组件（UI）
- `deepseek_integration_langchain.js` - 主集成文件

### 配置文件
- `manifest.langchain.json` - 新版本manifest配置示例
- `manifest.json` - 原版本配置（保留）

## 🔧 安装步骤

### 方式1：使用ReactLike（推荐，无需CDN）

1. **复制manifest配置**：
   ```bash
   cp manifest.langchain.json manifest.json
   ```

2. **在Chrome中加载扩展**：
   - 打开 `chrome://extensions/`
   - 开启"开发者模式"
   - 点击"加载已解压的扩展程序"
   - 选择项目文件夹

3. **配置API密钥**：
   - 点击扩展图标
   - 输入DeepSeek API密钥
   - 选择模型
   - 保存设置

4. **使用**：
   - 在任何网页按 `Command+K` (Mac) 或 `Ctrl+K` (Windows)
   - 开始对话！

### 方式2：使用CDN React（需要网络）

修改 `manifest.json` 的 `content_scripts`：

```json
{
  "content_scripts": [
    {
      "matches": ["http://*/*", "https://*/*"],
      "js": [
        "https://unpkg.com/react@18/umd/react.production.min.js",
        "https://unpkg.com/react-dom@18/umd/react-dom.production.min.js",
        "knowledge_base.js",
        "langchain-adapter.js",
        "react-components.jsx",
        "deepseek_integration_langchain.js"
      ]
    }
  ]
}
```

## 🎯 核心概念

### LangChain架构

```
用户输入
   ↓
路由链 (RouterChain)
   ↓
  ├─→ 对话链 (ConversationChain) - 普通对话
  └─→ 分析链 (AnalysisChain) - 产品分析
   ↓
记忆管理 (Memory)
   ↓
工具调用 (Tools)
   ↓
API调用
   ↓
输出解析 (Output Parser)
   ↓
React组件渲染
```

### 链式处理示例

```javascript
// 自动路由（推荐）
const response = await langChainAdapter.route("分析AlphaSense");

// 使用特定链
const chat = await langChainAdapter.run('conversation', "你好");
const analysis = await langChainAdapter.run('analysis', "分析AlphaSense");
```

## 🔍 功能对比

| 功能 | 原版本 | LangChain版本 |
|------|--------|--------------|
| 对话 | ✅ | ✅ (对话链) |
| 产品分析 | ✅ | ✅ (分析链) |
| 知识库 | ✅ | ✅ (工具) |
| 表格分析 | ✅ | ✅ (工具) |
| 意图识别 | 简单 | 智能路由 |
| 记忆管理 | 手动 | 自动 |
| UI框架 | DOM | React |

## 🛠️ 开发调试

### 查看日志
打开浏览器控制台（F12），查看：
- `🚀 Kyle's AI Agent (LangChain版) 初始化中...`
- `✅ LangChain适配器已初始化`
- `✅ 侧边栏UI已创建（React组件）`

### 常见问题

**Q: 侧边栏不显示？**
- 检查控制台是否有错误
- 确认所有JS文件都已加载
- 尝试按 `Command+K` 切换显示

**Q: API调用失败？**
- 检查API密钥是否正确
- 确认网络连接正常
- 查看background.js的日志

**Q: React组件未渲染？**
- 如果使用CDN，检查网络连接
- 如果使用ReactLike，检查控制台错误

## 📚 更多信息

查看 `LANGCHAIN_REACT_README.md` 了解详细架构说明。

## 🎉 开始使用

1. 加载扩展
2. 配置API密钥
3. 按 `Command+K` 打开侧边栏
4. 开始对话或分析产品！

---

**提示**：新版本完全兼容原版本功能，可以随时切换回原版本。

