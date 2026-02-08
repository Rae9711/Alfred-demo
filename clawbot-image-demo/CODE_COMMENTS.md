# 代码注释指南

本文档说明代码中各个部分的详细注释和说明。

## 文件注释结构

每个主要文件都包含：

1. **文件头注释**: 说明文件的职责、核心功能、设计原则
2. **函数注释**: 说明函数的作用、参数、返回值、示例
3. **关键逻辑注释**: 说明复杂逻辑的实现细节

## 关键文件注释说明

### server/src/agent/execute.ts

**文件职责**: 计划执行引擎

**详细注释包括**:
- 执行流程说明（6 个步骤）
- 变量解析机制（resolveVars）
- 错误检测逻辑
- 超时配置说明
- 事件发送机制

**关键函数**:
- `resolveVars()`: 变量解析，包含详细的格式说明和示例
- `executePlan()`: 主执行函数，包含完整的执行流程说明

### server/src/agent/plan.ts

**文件职责**: 计划生成（Planner）

**详细注释包括**:
- Planner 的单一职责原则
- 计划结构说明
- 处理流程（7 个步骤）
- 模型选择和配置
- 错误处理策略
- 示例输出

### server/src/agent/tools/registry.ts

**文件职责**: 工具注册表

**详细注释包括**:
- 核心职责（4 个方面）
- 工具定义结构
- 平台过滤机制
- 使用示例

### server/src/index.ts

**文件职责**: 服务器主入口

**详细注释包括**:
- 服务器架构
- 启动流程
- WebSocket 消息类型（完整列表）
- 执行流程（3 个阶段）
- 错误处理
- 环境变量说明

## 注释风格

### 函数注释格式

```typescript
/**
 * 函数简短描述
 * 
 * 详细说明（如果需要）
 * 
 * ## 功能说明
 * 
 * - 功能点 1
 * - 功能点 2
 * 
 * ## 参数说明
 * 
 * - `param1`: 参数 1 的说明
 * - `param2`: 参数 2 的说明
 * 
 * ## 返回值
 * 
 * 返回值的说明
 * 
 * ## 示例
 * 
 * ```typescript
 * const result = functionName(arg1, arg2);
 * ```
 * 
 * @param param1 - 参数 1
 * @param param2 - 参数 2
 * @returns 返回值说明
 */
```

### 复杂逻辑注释

```typescript
/**
 * 复杂逻辑说明
 * 
 * 为什么这样实现：
 * 1. 原因 1
 * 2. 原因 2
 * 
 * 实现细节：
 * - 步骤 1
 * - 步骤 2
 */
```

## 阅读代码的建议顺序

对于新开发者，建议按以下顺序阅读代码：

1. **ARCHITECTURE.md**: 了解整体架构
2. **server/src/index.ts**: 了解服务器入口和消息路由
3. **server/src/agent/plan.ts**: 了解计划生成
4. **server/src/agent/execute.ts**: 了解计划执行
5. **server/src/agent/tools/registry.ts**: 了解工具系统
6. **server/src/agent/tools/*.ts**: 了解具体工具实现
7. **web/src/App.tsx**: 了解前端主应用
8. **web/src/components/*.tsx**: 了解前端组件

## 关键概念说明

### 变量解析 (Variable Resolution)

步骤之间通过 `{{vars.NAME}}` 共享数据。这是纯字符串替换，不涉及 LLM。

### 错误检测 (Error Detection)

工具可以返回错误结果而不是抛出异常。执行器会检测 `found === false` 或 `error` 字段。

### 事件系统 (Event System)

所有操作都通过 WebSocket 事件通知前端，实现实时更新。

### 工具注册 (Tool Registration)

所有工具必须在启动时注册到全局注册表，Planner 和 Executor 都从这里查找工具。

## 扩展代码时的注意事项

1. **添加新工具**: 参考 `server/src/agent/tools/contacts.apple.ts`
2. **修改 Planner**: 编辑 `server/src/agent/plan.ts` 的提示词
3. **修改 Executor**: 编辑 `server/src/agent/execute.ts` 的执行逻辑
4. **添加前端组件**: 参考 `web/src/components/ProposedPlan.tsx`

## 调试技巧

1. **查看后端日志**: 所有关键操作都有 `console.log`
2. **查看 WebSocket 消息**: 前端 Console (F12) 显示所有消息
3. **检查工具结果**: 查看 `server/src/outbox/` 目录
