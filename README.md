# Nota Agent

Nota Agent 是一个智能的个人任务管理和记忆助手。它结合了现代化的任务管理功能和 AI 驱动的对话能力，帮助用户高效地组织待办事项并记住重要信息。

## 功能特性

- **智能任务管理**:
  - 创建、更新、完成和删除待办事项。
  - 支持设置开始和结束时间（自动处理时区）。
  - 支持任务优先级和循环任务（Cron）。
  - 移动端优化的任务列表视图。

- **AI 对话助手**:
  - 智能对话，理解并执行任务管理指令。
  - **记忆功能**: 自动提取对话中的重要信息并长期保存（如事实、偏好等）。
  - 基于上下文的问答。
  - 支持 Markdown、Mermaid 图表、数学公式和代码高亮渲染。

- **现代化界面**:
  - 响应式设计，完美适配移动端和桌面端。
  - 暗黑/明亮模式切换。
  - 优雅的 UI 组件（基于 HeroUI）。

## 快速开始

### 1. 克隆项目

```bash
git clone <repository-url>
cd nota-agent
```

### 2. 安装依赖

```bash
pnpm install
```

### 3. 配置环境变量

复制示例环境变量文件并配置你的 API Key：

```bash
cp .env.example .env
```

编辑 `.env` 文件，填入你的 OpenAI 兼容 API 信息：

```env
DATABASE_URL="file:./data/nota-agent.db"
MODEL_API_BASE="https://api.openai.com/v1" # 或其他兼容接口地址
MODEL_API_KEY="your-api-key"
CHAT_MODEL_NAME="gpt-4o" # 指定使用的模型名称，例如 gpt-4o, Kimi-K2.5 等
```

### 4. 运行开发服务器

启动 Next.js 开发服务器：

```bash
pnpm dev
```

访问 [http://localhost:3000](http://localhost:3000) 查看应用。

或者同时启动 Electron 开发环境（如果有 Electron 需求）：

```bash
pnpm run electron:dev
```

## 技术栈

- **框架**: [Next.js](https://nextjs.org/) (App Router)
- **UI 组件库**: [HeroUI](https://heroui.com/)
- **样式**: [Tailwind CSS](https://tailwindcss.com/)
- **AI SDK**: [Vercel AI SDK](https://sdk.vercel.ai/)
- **Markdown 渲染**: [Streamdown](https://github.com/streamdown/streamdown)
- **图标**: 自定义 SVG 图标

## 许可证

MIT