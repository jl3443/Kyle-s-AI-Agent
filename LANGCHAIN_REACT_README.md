# Kyle's AI Agent - LangChain + React 架构

## 📋 概述

这是基于 **LangChain** 概念和 **React** 组件化设计的新架构版本。

### 🎯 核心优势

1. **LangChain架构**：
   - ✅ 链式处理（Chains）：对话链、分析链、路由链
   - ✅ 记忆管理（Memory）：自动管理对话历史
   - ✅ 工具调用（Tools）：知识库搜索、表格分析、TSV格式化
   - ✅ 输出解析（Output Parsers）：智能识别TSV和文本格式

2. **React组件化**：
   - ✅ 组件化UI：Message, MessageList, InputArea等
   - ✅ 状态管理：使用React状态管理
   - ✅ 更好的用户体验

## 📁 文件结构

```
Kyle-s-AI-Agent/
├── langchain-adapter.js          # LangChain适配器（核心）
├── react-components.jsx          # React组件
├── deepseek_integration_langchain.js  # 主集成文件
├── deepseek_integration.js       # 原版本（保留）
└── manifest.json                 # 扩展配置
```

## 🚀 使用方法

### 方式1：使用CDN React（推荐）

在 `manifest.json` 中添加React CDN：

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
      ],
      "run_at": "document_end"
    }
  ]
}
```

### 方式2：使用ReactLike（轻量级，无需CDN）

直接使用内置的ReactLike实现，无需外部依赖：

```json
{
  "content_scripts": [
    {
      "matches": ["http://*/*", "https://*/*"],
      "js": [
        "knowledge_base.js",
        "langchain-adapter.js",
        "react-components.jsx",
        "deepseek_integration_langchain.js"
      ],
      "run_at": "document_end"
    }
  ]
}
```

## 🔧 LangChain架构说明

### 1. 链（Chains）

#### 对话链（ConversationChain）
- 处理普通对话
- 使用系统提示词进行友好对话
- 自动管理对话历史

#### 分析链（AnalysisChain）
- 处理金融产品分析
- 集成知识库搜索
- 自动提取表格数据
- 输出TSV格式

#### 路由链（RouterChain）
- 智能识别用户意图
- 自动选择最合适的链
- 关键词：分析、评估、公司、产品 → 分析链
- 其他 → 对话链

### 2. 记忆（Memory）

```javascript
// ConversationBufferMemory
- 自动保存对话历史
- 限制历史记录数量（默认20条）
- 提供上下文给API调用
```

### 3. 工具（Tools）

```javascript
// 已注册的工具：
- knowledge_search: 知识库搜索
- table_analysis: 表格数据分析
- tsv_formatter: TSV格式化
```

### 4. 使用示例

```javascript
// 初始化
const adapter = new LangChainAdapter(apiKey, model);

// 智能路由（推荐）
const response = await adapter.route(userMessage);

// 或直接使用特定链
const response = await adapter.run('conversation', userMessage);
const analysis = await adapter.run('analysis', userMessage);
```

## 🎨 React组件说明

### AISidebar
主侧边栏组件，包含：
- 消息列表
- 输入区域
- 思考指示器
- 错误提示

### Message
消息组件，支持：
- 用户消息
- AI回复
- TSV格式显示

### MessageList
消息列表组件，自动滚动到底部

### InputArea
输入区域组件，支持：
- 回车发送
- Shift+回车换行
- 禁用状态

## 🔄 迁移指南

### 从旧版本迁移

1. **更新manifest.json**：
   ```json
   {
     "content_scripts": [
       {
         "js": [
           "knowledge_base.js",
           "langchain-adapter.js",
           "react-components.jsx",
           "deepseek_integration_langchain.js"
         ]
       }
     ]
   }
   ```

2. **保持向后兼容**：
   - 原版本 `deepseek_integration.js` 仍然可用
   - 新版本使用 `deepseek_integration_langchain.js`

3. **切换版本**：
   - 修改manifest.json中的js文件列表即可

## 📊 架构对比

| 特性 | 原版本 | LangChain版本 |
|------|--------|--------------|
| 代码组织 | 单一类 | 链式处理 |
| 记忆管理 | 手动管理 | 自动管理 |
| 工具调用 | 硬编码 | 可扩展工具系统 |
| UI框架 | 原生DOM | React组件 |
| 意图识别 | 简单判断 | 智能路由链 |
| 扩展性 | 中等 | 高 |

## 🛠️ 扩展开发

### 添加新工具

```javascript
// 在langchain-adapter.js中
adapter.tools.register('my_tool', {
    name: 'my_tool',
    description: '工具描述',
    execute: async (input) => {
        // 工具逻辑
        return result;
    }
});
```

### 添加新链

```javascript
class MyChain extends BaseChain {
    async run(input, options = {}) {
        // 链逻辑
        return result;
    }
}

adapter.chains.register('my_chain', new MyChain(adapter));
```

### 自定义React组件

```javascript
function MyComponent({ prop1, prop2 }) {
    return React.createElement('div', { className: 'my-component' },
        React.createElement('p', null, prop1),
        React.createElement('p', null, prop2)
    );
}
```

## 🐛 故障排除

### React未加载
- 检查CDN链接是否正确
- 或使用ReactLike实现

### LangChainAdapter未定义
- 确保 `langchain-adapter.js` 在 `deepseek_integration_langchain.js` 之前加载

### 组件未渲染
- 检查控制台错误
- 确保所有依赖文件都已加载

## 📝 注意事项

1. **React CDN**：如果使用CDN，需要确保网络连接正常
2. **ReactLike**：轻量级实现，功能有限，适合简单场景
3. **兼容性**：新架构保持与原版本API兼容
4. **性能**：LangChain版本可能略慢，但提供更好的扩展性

## 🎯 未来计划

- [ ] 添加更多工具（网页搜索、代码分析等）
- [ ] 实现更复杂的链（多步骤推理）
- [ ] 添加流式输出支持
- [ ] 优化React组件性能
- [ ] 添加单元测试

