# 🐧 Kyle's AI Agent (Chrome Extension)

> A Chrome extension built specifically for the Business Analysis team, providing intelligent analysis and suggestion features

[中文版本](#中文版本) | [English Version](#english-version)

---

## English Version

### 🌟 Project Overview

Kyle's AI Agent is a Chrome browser extension that integrates with the DeepSeek API to provide intelligent analysis, data extraction, and real-time conversation features on any webpage. It's specially optimized for Tencent Docs and business analysis scenarios.

### ✨ Core Features

- 🧠 **Intelligent Analysis**: Automatically analyzes webpage content and provides professional suggestions
- 📊 **Data Extraction**: Intelligently identifies structured data like tables and lists
- 💬 **Real-time Chat**: ChatGPT-like smooth conversation experience
- 🔍 **Knowledge Base**: Built-in financial AI product case library for professional analysis
- 🌐 **Universal Support**: Works on any webpage, not limited to Tencent Docs
- ⚡ **Accept/Reject Mechanism**: Smart suggestions can be accepted or rejected
- 📋 **Automatic Data Classification**: Automatically organizes and categorizes information
- 🎯 **Similar Case Recommendations**: Recommends related cases based on knowledge base

### 🚀 Quick Installation

#### Method 1: Chrome Extension Installation

1. **Download Project Files**
   ```bash
   git clone https://github.com/jl3443/Kyle-s-AI-Agent.git
   cd Kyle-s-AI-Agent
   ```

2. **Install Chrome Extension** （Not recommended）
   - Open Chrome browser and visit `chrome://extensions/`
   - Enable "Developer mode" in the top right
   - Click "Load unpacked"
   - Select the project folder
   - ✅ Extension installation complete!

#### Method 2: Local Development Environment

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Start Proxy Server** (Optional, for CORS issues)
   ```bash
   npm start
   ```

### ⚙️ Configuration

#### API Key Setup（Necessary step!）

First-time use requires DeepSeek API key configuration:

1. Visit [DeepSeek Platform](https://platform.deepseek.com) to get API key
2. Click the extension icon 🐧 in Chrome toolbar
3. Enter API key (format: sk-xxxxxx)
4. Select model:
   - 🧠 **DeepSeek-V3.1 Thinking Mode** (Recommended, strongest reasoning)
   - 💬 **DeepSeek-V3.1 Non-thinking Mode** (Fast response)
   - 💻 **DeepSeek Coder** (Programming specialized)
5. Click "Save Settings"

### 📁 Project Structure

```
Kyle-s-AI-Agent/
├── manifest.json              # Chrome extension configuration
├── popup.html                 # Extension popup interface
├── popup.js                   # Popup logic
├── background.js              # Background service script
├── deepseek_integration.js    # DeepSeek API integration
├── knowledge_base.js          # Knowledge base functionality
├── proxy-server.js           # CORS proxy server
├── package.json              # Node.js dependency management
├── vercel-api.js            # Vercel deployment config
├── api-test-advanced.html   # API testing page
└── 安装部署指南.md           # Detailed installation guide
```

### 🛠️ Development

#### Tech Stack
- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **API**: DeepSeek API v1
- **Architecture**: Chrome Extension Manifest v3
- **Proxy Server**: Node.js + Express

#### Main Components
- `DeepSeekAssistant`: Core AI assistant class
- `KnowledgeBase`: Knowledge base management
- `ProxyServer`: CORS proxy server

### 🚨 FAQ

**Q: Extension not showing after installation?**  
A: Check if developer mode is enabled, reload the extension

**Q: AI assistant not responding?**  
A: Check if API key is configured correctly, ensure network connection is stable

**Q: Can it be used on other webpages?**  
A: Yes! AI assistant supports any webpage and automatically analyzes page content

**Q: How to solve CORS issues?**  
A: Run `npm start` to start local proxy server

### 📝 Changelog

#### v1.0.0 (2024-12-XX)
- ✅ Initial release
- ✅ DeepSeek API integration support
- ✅ Intelligent table analysis
- ✅ Real-time AI suggestions
- ✅ Accept/Reject mechanism
- ✅ Built-in knowledge base

### 🤝 Contributing

Welcome to submit Issues and Pull Requests!

1. Fork this project
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

### 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details

### 👥 Team

**Business Analysis Internal Team**
- Developer: Kyle
- Version: 1.0.0
- Dedicated to: CDG BA Team

---

🎉 **Team, let's boost our productivity together!**

---

## 中文版本

> 专为商分内部团队打造的Chrome扩展，提供智能分析和建议功能

## 🌟 项目简介

Kyle's AI Agent是一个Chrome浏览器扩展，集成了DeepSeek API，可以在任何网页上提供智能分析、数据提取和实时对话功能。特别针对腾讯文档和商业分析场景进行了优化。

## ✨ 核心功能

- 🧠 **智能分析**：自动分析网页内容，提供专业建议
- 📊 **数据提取**：智能识别表格、列表等结构化数据
- 💬 **实时对话**：类似ChatGPT的流畅对话体验
- 🔍 **知识库**：内置金融AI产品案例库，提供专业分析
- 🌐 **通用支持**：支持任何网页，不限于腾讯文档
- ⚡ **Accept/Reject机制**：智能建议可接受或拒绝
- 📋 **数据自动分类**：自动整理和分类信息
- 🎯 **相似案例推荐**：基于知识库推荐相关案例

## 🚀 快速安装

### 方法一：Chrome扩展安装

1. **下载项目文件**
   ```bash
   git clone https://github.com/jl3443/Kyle-s-AI-Agent.git
   cd Kyle-s-AI-Agent
   ```

2. **安装Chrome扩展**
   - 打开Chrome浏览器，访问 `chrome://extensions/`
   - 开启右上角的"开发者模式"
   - 点击"加载已解压的扩展程序"
   - 选择项目文件夹
   - ✅ 扩展安装完成！

### 方法二：本地开发环境（你们还是别用方法二了）

1. **安装依赖**
   ```bash
   npm install
   ```

2. **启动代理服务器**（可选，用于解决CORS问题）
   ```bash
   npm start
   ```

## ⚙️ 配置说明

### API密钥配置（记住，这个一定要！）

首次使用需要配置DeepSeek API密钥：

1. 访问 [DeepSeek开放平台](https://platform.deepseek.com) 获取API密钥
2. 点击Chrome工具栏中的扩展图标 🐧
3. 输入API密钥（格式：sk-xxxxxx）
4. 选择模型：
   - 🧠 **DeepSeek-V3.1 Thinking Mode**（推荐，最强推理能力）
   - 💬 **DeepSeek-V3.1 Non-thinking Mode**（快速响应）
   - 💻 **DeepSeek Coder**（编程专用）
5. 点击"保存设置"

## 📁 项目结构

```
商分内部agent/
├── manifest.json              # Chrome扩展配置文件
├── popup.html                 # 扩展弹窗界面
├── popup.js                   # 弹窗逻辑
├── background.js              # 后台服务脚本
├── deepseek_integration.js    # DeepSeek API集成
├── knowledge_base.js          # 知识库功能
├── proxy-server.js           # CORS代理服务器
├── package.json              # Node.js依赖管理
├── vercel-api.js            # Vercel部署配置
├── api-test-advanced.html   # API测试页面
└── 安装部署指南.md           # 详细安装说明
```

## 🛠️ 开发说明

### 技术栈
- **前端**：HTML5, CSS3, JavaScript (ES6+)
- **API**：DeepSeek API v1
- **架构**：Chrome Extension Manifest v3
- **代理服务器**：Node.js + Express

### 主要组件
- `DeepSeekAssistant`: 核心AI助手类
- `KnowledgeBase`: 知识库管理
- `ProxyServer`: CORS代理服务器

## 🚨 常见问题

**Q: 扩展安装后没有显示？**  
A: 检查开发者模式是否开启，重新加载扩展

**Q: AI助手不回复？**  
A: 检查API密钥是否正确配置，确保网络连接正常

**Q: 在其他网页也能使用吗？**  
A: 是的！AI助手支持任何网页，会自动分析页面内容

**Q: 如何解决CORS跨域问题？**  
A: 运行 `npm start` 启动本地代理服务器

## 📝 更新日志

### v1.0.0 (2024-12-XX)
- ✅ 初始版本发布
- ✅ 支持DeepSeek API集成
- ✅ 智能表格分析功能
- ✅ 实时AI建议
- ✅ Accept/Reject机制
- ✅ 内置知识库

## 🤝 贡献指南

欢迎提交Issue和Pull Request！

1. Fork本项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 👥 团队

**商分内部团队**
- 开发者：Kyle
- 版本：1.0.0
- 专用于：CDG BA团队

---

🎉 **小伙伴们，让我们一起提升工作效率！**