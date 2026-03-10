# 开发者指南

本指南帮助新开发者快速理解代码库并开始开发。

## 快速开始

### 1. 环境设置

```bash
# 克隆仓库
git clone <repository-url>
cd clawbot-image-demo

# 安装后端依赖
cd server
npm install

# 安装前端依赖
cd ../web
npm install

# 确保 Ollama 运行
ollama serve
ollama pull qwen2.5:1.5b
```

### 2. 启动开发服务器

**终端 1 - 后端**:
```bash
cd server
npm run dev
```

**终端 2 - 前端**:
```bash
cd web
npm run dev
```

访问: `http://localhost:5173`

## 代码结构详解

### 后端结构

```
server/src/
├── index.ts              # 服务器入口，WebSocket 路由
├── agent/
│   ├── plan.ts          # Planner: 生成执行计划
│   ├── execute.ts       # Executor: 执行计划
│   ├── render.ts        # Reporter + Styler: 生成最终答案
│   ├── ollama.ts        # LLM 调用封装
│   ├── persona.ts       # 风格定义
│   ├── tools/           # 工具系统
│   │   ├── registry.ts  # 工具注册表
│   │   ├── index.ts     # 工具导入
│   │   └── *.ts         # 具体工具实现
│   └── executeStore.ts  # 执行结果存储
├── sessionStore.ts      # 会话管理
└── planStore.ts         # 计划存储
```

### 前端结构

```
web/src/
├── App.tsx              # 主应用组件
├── api/
│   └── ws.ts           # WebSocket 客户端
└── components/
    ├── ProposedPlan.tsx    # 计划展示
    ├── ExecutionLog.tsx    # 执行日志
    └── FinalAnswer.tsx     # 最终答案
```

## 核心工作流程

### 1. 用户请求 → 计划生成

```
用户输入: "给查理发消息说你好"
    ↓
前端: WebSocket.send({ method: "agent.plan", params: {...} })
    ↓
后端: createPlan() → LLM 调用（Planner）
    ↓
返回: Plan JSON
    ↓
前端: 显示计划和权限
```

**关键代码**: `server/src/agent/plan.ts` 的 `createPlan()`

### 2. 用户批准 → 计划执行

```
用户点击"批准并执行"
    ↓
前端: WebSocket.send({ method: "agent.execute", params: {...} })
    ↓
后端: executePlan() → 遍历步骤
    ↓
for each step:
  - 解析变量: resolveVars()
  - 查找工具: getTool()
  - 执行工具: tool.execute()
  - 保存结果: vars[saveAs] = result
  - 发送事件: emit("tool.success")
    ↓
返回: ExecutionSummary
```

**关键代码**: `server/src/agent/execute.ts` 的 `executePlan()`

### 3. 执行完成 → 结果渲染

```
执行完成
    ↓
后端: renderFinal() → LLM 调用（Reporter）
    ↓
可选: LLM 调用（Styler）→ 风格重写
    ↓
返回: 最终答案
    ↓
前端: 显示答案
```

**关键代码**: `server/src/agent/render.ts` 的 `renderFinal()`

## 添加新功能

### 添加新工具

1. **创建工具文件**: `server/src/agent/tools/my-tool.ts`

```typescript
import { registerTool, type ToolContext } from "./registry.js";

registerTool({
  id: "my.tool",
  name: "我的工具",
  description: "工具描述（用于 Planner 提示词）",
  category: "data",  // content | platform | data | file
  permissions: [],    // ["contacts.read", "platform.send", "files.write"]
  argsSchema: '{ "arg1": "参数1说明", "arg2": "参数2说明" }',
  outputSchema: '{ "result": "结果说明" }',
  async execute(args: { arg1: string; arg2?: string }, ctx: ToolContext) {
    // 实现逻辑
    // ctx.outboxDir: 可以写入文件
    // ctx.vars: 可以访问其他步骤的结果
    
    return {
      result: "执行结果",
      // 其他字段...
    };
  }
});
```

2. **导入工具**: 在 `server/src/agent/tools/index.ts` 添加：

```typescript
import "./my-tool.js";
```

3. **测试**: 重启后端，工具会自动注册

### 修改 Planner 行为

编辑 `server/src/agent/plan.ts`:

1. **修改提示词**: 编辑 `createPlan()` 中的提示词模板
2. **添加示例**: 在 `IMPORTANT rules` 后添加 few-shot 示例
3. **修改验证**: 编辑 `normalizePlanDraft()` 处理新的 JSON 格式

### 修改前端 UI

编辑 `web/src/components/`:

1. **ProposedPlan.tsx**: 计划展示样式和逻辑
2. **ExecutionLog.tsx**: 执行日志显示
3. **FinalAnswer.tsx**: 最终答案展示

## 调试技巧

### 1. 查看后端日志

后端终端会显示：
- `[execute] Step s1 error check:` - 错误检测结果
- `[execute] Saved result to vars[contact]:` - 变量保存
- `[execute] Step s2 resolving vars:` - 变量解析

### 2. 查看前端日志

浏览器 Console (F12):
- `[ws] send` - 发送的 WebSocket 消息
- `[ws] message` - 接收的 WebSocket 消息

### 3. 检查工具结果

查看 `server/src/outbox/` 目录：
- 工具执行结果（JSON 文件）
- 发送的消息记录

### 4. 测试单个工具

```typescript
// 在 server/src/index.ts 中添加测试代码
import { getTool } from "./agent/tools/registry.js";

const tool = getTool("contacts.apple");
const result = await tool.execute({ query: "查理" }, { 
  outboxDir: "./src/outbox", 
  vars: {} 
});
console.log(result);
```

## 常见问题

### Q: 如何调试变量解析？

A: 在 `server/src/agent/execute.ts` 的 `resolveVars()` 中添加日志：

```typescript
console.log(`[resolveVars] Input:`, value);
console.log(`[resolveVars] Vars:`, vars);
console.log(`[resolveVars] Output:`, result);
```

### Q: 如何调试 Planner 输出？

A: 在 `server/src/agent/plan.ts` 的 `createPlan()` 中添加日志：

```typescript
console.log(`[createPlan] LLM Response:`, raw);
console.log(`[createPlan] Parsed:`, parsed);
console.log(`[createPlan] Normalized:`, normalized);
```

### Q: 如何测试工具执行？

A: 创建测试脚本 `test-tool.ts`:

```typescript
import { getTool } from "./agent/tools/registry.js";
import "./agent/tools/index.js";

const tool = getTool("contacts.apple");
const result = await tool.execute(
  { query: "测试" },
  { outboxDir: "./outbox", vars: {} }
);
console.log(JSON.stringify(result, null, 2));
```

运行: `tsx test-tool.ts`

### Q: 如何添加新的 LLM 提供商？

A: 编辑 `server/src/agent/ollama.ts`:

1. 添加 API 检测逻辑
2. 添加请求转换逻辑
3. 添加认证头（如果需要）

## 代码规范

### 命名约定

- **文件**: kebab-case (`my-tool.ts`)
- **函数**: camelCase (`executePlan`)
- **类型**: PascalCase (`ToolDefinition`)
- **常量**: UPPER_SNAKE_CASE (`SLOW_TIMEOUT`)

### 注释规范

- 所有公共函数必须有 JSDoc 注释
- 复杂逻辑必须有行内注释
- 文件头部必须有职责说明

### 错误处理

- 工具返回错误对象而不是抛出异常
- 使用 `found === false` 表示资源未找到
- 使用 `error` 字段提供错误信息

## 测试建议

### 单元测试

为每个工具编写单元测试：

```typescript
// server/src/agent/tools/__tests__/my-tool.test.ts
import { describe, it, expect } from "vitest";
import { getTool } from "../registry.js";

describe("my.tool", () => {
  it("should execute correctly", async () => {
    const tool = getTool("my.tool");
    const result = await tool.execute(
      { arg1: "test" },
      { outboxDir: "./test-outbox", vars: {} }
    );
    expect(result).toHaveProperty("result");
  });
});
```

### 集成测试

测试完整的执行流程：

```typescript
// server/src/agent/__tests__/execute.test.ts
import { executePlan } from "../execute.js";
import { createPlan } from "../plan.js";

describe("executePlan", () => {
  it("should execute a simple plan", async () => {
    const plan = await createPlan({
      sessionId: "test",
      prompt: "给查理发消息说你好",
      platform: "imessage"
    });
    
    const result = await executePlan({
      sessionId: "test",
      planId: plan.planId,
      approved: true,
      emit: () => {},
      outboxDir: "./test-outbox"
    });
    
    expect(result.executionSummary.status).toBe("ok");
  });
});
```

## 性能优化

### 1. 减少 LLM 调用

- Planner 使用小模型（1.5b）
- Reporter 使用中等模型（7b）
- Styler 可选（使用小模型）

### 2. 工具超时

- 慢速工具：5 分钟超时
- 快速工具：10 秒超时

### 3. 平台过滤

- 根据平台过滤工具目录，减少提示词大小

## 下一步学习

1. 阅读 `ARCHITECTURE.md` 了解整体架构
2. 阅读 `CODE_COMMENTS.md` 了解注释风格
3. 阅读具体工具实现了解工具开发模式
4. 阅读前端组件了解 UI 开发

## 获取帮助

- 查看 `TROUBLESHOOTING.md` 解决常见问题
- 查看 `ARCHITECTURE.md` 理解系统设计
- 查看代码注释了解实现细节
