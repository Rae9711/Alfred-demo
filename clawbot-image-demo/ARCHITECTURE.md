# 系统架构文档

## 概述

这是一个基于 Plan-Execute-Report 模式的 AI 助手系统，支持多步骤任务规划、工具执行和结果报告。

## 核心架构

```
User Request
    ↓
Planner (LLM) → Plan (JSON with steps)
    ↓
User Approval (with permissions)
    ↓
Executor → Tool Execution (deterministic)
    ↓
Reporter (LLM) → Final Answer
    ↓ (optional)
Styler (LLM) → Styled Answer
```

## 目录结构

```
clawbot-image-demo/
├── server/                 # 后端服务
│   ├── src/
│   │   ├── index.ts       # Express 服务器和 WebSocket
│   │   ├── agent/
│   │   │   ├── plan.ts    # 计划生成（Planner）
│   │   │   ├── execute.ts # 计划执行（Executor）
│   │   │   ├── render.ts  # 结果渲染（Reporter + Styler）
│   │   │   ├── ollama.ts  # LLM 调用封装
│   │   │   ├── persona.ts # 风格定义
│   │   │   ├── tools/     # 工具注册系统
│   │   │   │   ├── registry.ts    # 工具注册表
│   │   │   │   ├── index.ts       # 工具导入
│   │   │   │   ├── contacts.apple.ts  # Apple 通讯录
│   │   │   │   ├── imessage.send.ts   # iMessage 发送
│   │   │   │   └── ... (其他工具)
│   │   │   └── executeStore.ts # 执行结果存储
│   │   ├── sessionStore.ts    # 会话管理
│   │   ├── planStore.ts       # 计划存储
│   │   └── sandbox/           # 沙箱执行
│   └── Dockerfile
├── web/                   # 前端应用
│   ├── src/
│   │   ├── App.tsx       # 主应用组件
│   │   ├── api/
│   │   │   └── ws.ts     # WebSocket 客户端
│   │   └── components/
│   │       ├── ProposedPlan.tsx    # 计划展示
│   │       ├── ExecutionLog.tsx    # 执行日志
│   │       └── FinalAnswer.tsx     # 最终答案
│   └── Dockerfile
└── docker-compose.yml     # Docker 编排
```

## 核心概念

### 1. Plan（计划）

计划是一个 JSON 结构，包含多个步骤：

```typescript
{
  intent: "给查理发消息",
  steps: [
    {
      id: "s1",
      tool: "contacts.apple",
      description: "查找查理",
      args: { query: "查理" },
      saveAs: "contact"  // 结果保存到 vars.contact
    },
    {
      id: "s2",
      tool: "imessage.send",
      description: "发送消息",
      args: {
        handle: "{{vars.contact.handle}}",  // 引用上一步结果
        message: "你好"
      },
      dependsOn: ["s1"]  // 依赖步骤
    }
  ],
  requiredPermissions: ["contacts.read", "platform.send"]
}
```

### 2. Tool（工具）

工具是系统可以执行的操作：

- **注册**: 通过 `registerTool()` 注册到全局注册表
- **执行**: 通过 `tool.execute(args, ctx)` 执行
- **权限**: 每个工具声明需要的权限
- **输出**: 返回结构化数据，保存到 `vars[saveAs]`

### 3. Variable Resolution（变量解析）

步骤之间通过 `{{vars.NAME}}` 和 `{{vars.NAME.field}}` 共享数据：

- `{{vars.contact}}` → 整个 contact 对象
- `{{vars.contact.handle}}` → contact 对象的 handle 字段
- 如果变量不存在或字段缺失，返回 `[missing: ...]` 或 `[error: ...]`

### 4. Execution Flow（执行流程）

1. **Plan Generation**: Planner (LLM) 生成计划
2. **User Approval**: 用户查看计划并批准权限
3. **Execution**: Executor 按顺序执行步骤
   - 解析变量引用
   - 查找工具
   - 执行工具（沙箱，超时保护）
   - 保存结果到 vars
4. **Reporting**: Reporter (LLM) 生成最终答案
5. **Styling** (可选): Styler (LLM) 根据 persona 重写风格

## 关键文件说明

### server/src/index.ts

**职责**: Express 服务器和 WebSocket 通信

**关键功能**:
- HTTP API: `/health` 健康检查
- WebSocket: 实时双向通信
- 消息处理: `agent.plan`, `agent.execute`, `agent.render`
- 静态文件服务: 生产环境 serve 前端

**WebSocket 消息格式**:
```typescript
// 客户端 → 服务器
{ id: string, method: "agent.plan", params: {...} }

// 服务器 → 客户端
{ type: "event", event: "agent.plan.complete", data: {...} }
```

### server/src/agent/plan.ts

**职责**: 计划生成（Planner）

**关键功能**:
- `createPlan()`: 调用 LLM 生成计划
- `normalizePlanDraft()`: 规范化 LLM 输出（处理各种 JSON 格式）
- `inferSaveAs()`: 自动推断 saveAs（如果模型忘记）
- `getToolCatalog()`: 生成工具目录（根据平台过滤）

**Planner 提示词结构**:
1. 角色定义（中文）
2. 工具目录（动态生成）
3. 重要规则（CRITICAL RULES）
4. 示例（few-shot）
5. 用户请求

### server/src/agent/execute.ts

**职责**: 计划执行（Executor）

**关键功能**:
- `executePlan()`: 执行计划的所有步骤
- `resolveVars()`: 解析变量引用（`{{vars.NAME}}`）
- 错误检测: 检查 `found === false` 或 `error` 字段
- 结果存储: 保存到 `vars[saveAs]`
- 事件发送: 通过 WebSocket 发送执行事件

**执行流程**:
```
for each step:
  1. 解析变量引用
  2. 查找工具
  3. 执行工具（沙箱，超时）
  4. 检查错误
  5. 保存结果
  6. 发送事件
```

### server/src/agent/render.ts

**职责**: 结果渲染（Reporter + Styler）

**关键功能**:
- `renderFinal()`: 两阶段渲染
  1. Reporter: 中性、事实性报告
  2. Styler (可选): 根据 persona 重写风格

**输入**:
- 用户原始请求
- 批准的计划
- 执行结果（ExecutionSummary）

**输出**: 最终用户可见的回答

### server/src/agent/tools/registry.ts

**职责**: 工具注册表

**关键功能**:
- `registerTool()`: 注册工具
- `getTool()`: 根据 ID 获取工具
- `getToolCatalog()`: 生成工具目录（用于 Planner）
- `getPermissionLabel()`: 权限中文标签

**工具定义**:
```typescript
{
  id: "contacts.apple",
  name: "Apple 通讯录",
  description: "从 macOS 通讯录中查找真实联系人",
  category: "data",
  permissions: ["contacts.read"],
  argsSchema: '{ "query": "联系人姓名" }',
  outputSchema: '{ "found": true, "handle": "iMessage地址" }',
  execute: async (args, ctx) => { ... }
}
```

### server/src/agent/tools/contacts.apple.ts

**职责**: Apple 通讯录工具

**实现**:
- 使用 JXA (JavaScript for Automation) 访问 macOS Contacts
- 搜索联系人（姓名匹配）
- 返回: `{ found, name, phone, email, handle }`
- 错误处理: 权限拒绝、未找到等

**权限要求**: macOS 通讯录访问权限

### server/src/agent/tools/imessage.send.ts

**职责**: iMessage 发送工具

**实现**:
- 使用 AppleScript 控制 Messages.app
- 通过临时 `.scpt` 文件执行（避免 shell 转义问题）
- 保存发送记录到 outbox（审计）

**权限要求**: macOS 辅助功能权限

### web/src/App.tsx

**职责**: 前端主应用

**关键功能**:
- 设置屏幕: AI 身份配置
- 主屏幕: 任务输入、计划展示、执行日志、结果展示
- WebSocket 连接: 实时通信
- 权限审批: 显示所需权限，用户批准
- 阶段管理: planning → executing → rendering

**状态管理**:
- `phase`: 当前阶段
- `plan`: 当前计划
- `logs`: 执行日志
- `finalMsg`: 最终答案
- `approvedPermissions`: 已批准的权限

### web/src/api/ws.ts

**职责**: WebSocket 客户端

**关键功能**:
- 自动重连
- 消息队列（连接前缓存消息）
- 事件回调处理

## 数据流

### 计划生成流程

```
User Input ("给查理发消息")
    ↓
WebSocket: agent.plan
    ↓
createPlan() → LLM Call (Planner)
    ↓
normalizePlanDraft() → Plan JSON
    ↓
WebSocket: agent.plan.complete
    ↓
Frontend: Display Plan + Permissions
```

### 执行流程

```
User Approval
    ↓
WebSocket: agent.execute
    ↓
executePlan()
    ↓
for each step:
  resolveVars() → 解析变量
  getTool() → 查找工具
  tool.execute() → 执行工具
  vars[saveAs] = result → 保存结果
  emit event → 发送事件
    ↓
WebSocket: agent.exec.finished
```

### 渲染流程

```
Execution Complete
    ↓
WebSocket: agent.render
    ↓
renderFinal()
    ↓
Reporter (LLM) → 中性报告
    ↓ (optional)
Styler (LLM) → 风格重写
    ↓
WebSocket: agent.rendered
    ↓
Frontend: Display Final Answer
```

## 错误处理

### 工具执行错误

工具可以返回错误而不是抛出异常：

```typescript
// contacts.apple 返回
{
  found: false,
  error: "无法访问 Apple 通讯录: 权限被拒绝"
}
```

执行器会：
1. 检测 `found === false` 或 `error` 字段
2. 标记步骤为 `status: "error"`
3. 仍然保存结果到 vars（供后续步骤检查）
4. 继续执行后续步骤（不中断）

### 变量解析错误

如果变量不存在或字段缺失：

```typescript
// vars.contact = { found: false, error: "..." }
// 解析 {{vars.contact.handle}}
// 返回: "[error: contact.handle - 无法访问 Apple 通讯录: ...]"
```

## 权限系统

### 权限类型

- `contacts.read`: 读取联系人
- `platform.send`: 发送消息
- `files.write`: 写入文件

### 权限流程

1. Planner 分析计划，收集所需权限
2. 前端显示权限列表
3. 用户批准权限
4. 执行时验证权限（当前仅显示，未强制）

## 部署

### 本地运行

- 优点: 可以访问 macOS 系统权限
- 缺点: 需要手动管理依赖

### Docker 部署

- 优点: 隔离、易于部署
- 缺点: 无法访问 macOS 系统权限（通讯录、iMessage）

### 云部署（Railway/Render）

- 优点: 稳定、公开访问
- 缺点: 无法访问本地系统资源

## 扩展指南

### 添加新工具

1. 在 `server/src/agent/tools/` 创建新文件
2. 实现 `ToolDefinition`
3. 在 `tools/index.ts` 导入并注册

示例：
```typescript
// server/src/agent/tools/my-tool.ts
import { registerTool } from "./registry.js";

registerTool({
  id: "my.tool",
  name: "我的工具",
  description: "工具描述",
  category: "data",
  permissions: [],
  argsSchema: '{ "arg": "参数" }',
  outputSchema: '{ "result": "结果" }',
  async execute(args, ctx) {
    // 实现逻辑
    return { result: "..." };
  }
});
```

### 修改 Planner 行为

编辑 `server/src/agent/plan.ts`:
- `createPlan()`: 修改提示词
- `normalizePlanDraft()`: 处理新的 JSON 格式
- `inferSaveAs()`: 添加新工具的 saveAs 推断

### 修改前端 UI

编辑 `web/src/components/`:
- `ProposedPlan.tsx`: 计划展示
- `ExecutionLog.tsx`: 执行日志
- `FinalAnswer.tsx`: 最终答案

## 调试技巧

### 查看执行日志

后端终端会显示：
- `[execute] Step s1 error check:` - 错误检测
- `[execute] Saved result to vars[contact]:` - 变量保存
- `[execute] Step s2 resolving vars:` - 变量解析

### 查看 WebSocket 消息

前端浏览器 Console (F12):
- `[ws] send` - 发送的消息
- `[ws] message` - 接收的消息

### 检查工具结果

查看 `server/src/outbox/` 目录：
- 工具执行结果（JSON 文件）
- 发送的消息记录

## 常见问题

### Q: 为什么变量解析返回 `[missing: ...]`?

A: 检查：
1. 上一步是否正确执行
2. `saveAs` 是否正确设置
3. 变量名是否匹配

### Q: 为什么工具执行失败但标记为成功?

A: 检查错误检测逻辑：
- `found === false` 应该被检测为错误
- 查看后端日志中的 `error check`

### Q: 如何添加新的 LLM 提供商?

A: 编辑 `server/src/agent/ollama.ts`:
- 添加新的 API 检测逻辑
- 添加请求转换逻辑

## 下一步开发建议

1. **权限强制执行**: 当前仅显示，未强制验证
2. **步骤依赖检查**: 当前按顺序执行，未检查 dependsOn
3. **并行执行**: 支持无依赖步骤并行执行
4. **重试机制**: 工具执行失败时自动重试
5. **结果验证**: 验证工具输出是否符合 outputSchema
