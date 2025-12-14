# task-runner-plus

[![NPM version](https://img.shields.io/npm/v/task-runner-plus.svg?style=flat)](https://npmjs.com/package/task-runner-plus)
[![NPM downloads](http://img.shields.io/npm/dm/task-runner-plus.svg?style=flat)](https://npmjs.com/package/task-runner-plus)

## 项目简介

task-runner-plus 是一个轻量级的任务执行器库，用于实现任务的并发执行、进度控制、错误重试等功能。它可以帮助你轻松管理复杂的异步任务流程，提供实时的进度反馈和状态管理。

## 功能特点

- ✅ **并发控制**：支持配置任务的并发执行数量
- ✅ **进度管理**：实时更新任务执行进度
- ✅ **状态管理**：完整的任务生命周期管理（pending, running, paused, completed, failed, cancelled, removed）
- ✅ **错误处理**：支持任务失败重试机制
- ✅ **事件监听**：提供丰富的事件钩子，方便监听任务状态变化
- ✅ **原子任务**：支持将复杂任务拆分为多个原子任务执行
- ✅ **TypeScript 支持**：完整的 TypeScript 类型定义

## 安装

```bash
# 使用 npm
$ npm install task-runner-plus

# 使用 pnpm
$ pnpm add task-runner-plus

# 使用 yarn
$ yarn add task-runner-plus
```

## 使用示例

### 基本使用

```javascript
import { Task, TaskStatus } from "task-runner-plus";

// 创建任务
const task = new Task({ name: "Test Task", description: "A simple test task" });

// 监听任务事件
task.event.on("start", ({ taskInfo }) => {
  console.log("任务开始:", taskInfo.name);
});

task.event.on("complete", ({ taskInfo }) => {
  console.log("任务完成:", taskInfo.name);
});

task.event.on("percent", ({ percent, taskInfo }) => {
  console.log("任务进度:", percent + "%");
});

// 更新任务进度
task.setPercent(50);

// 开始任务
task.start();

// 完成任务
task.complete();
```

### 使用原子任务

```javascript
import { Task } from "task-runner-plus";

// 创建任务
const task = new Task({ name: "Atomic Task Example" });

// 设置原子任务
const atomTasks = [
  [
    async ({ exitRetry, signal }) => {
      // 第一个原子任务
      console.log("执行第一个原子任务");
      await new Promise((resolve) => setTimeout(resolve, 1000));
    },
  ],
  [
    async ({ exitRetry, signal }) => {
      // 第二个原子任务
      console.log("执行第二个原子任务");
      await new Promise((resolve) => setTimeout(resolve, 1500));
    },
  ],
];

task.setAtomTasks(atomTasks);

// 开始任务
task.start();
```

### 配置并发执行

```javascript
import { Task } from "task-runner-plus";

// 创建任务，设置并发度为2
const task = new Task({}, { concurrency: 2 });

// 设置多个原子任务
const atomTasks = Array.from({ length: 5 }, (_, index) => [
  async ({ exitRetry, signal }) => {
    console.log(`执行原子任务 ${index + 1}`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  },
]);

task.setAtomTasks(atomTasks);

// 开始任务
task.start();
```

## API 文档

### Task 类

#### 构造函数

```typescript
new Task(params?: Partial<TaskInfo>, options?: TaskOptions)
```

**参数**：

- `params`：任务初始化参数
  - `name?: string`：任务名称
  - `description?: string`：任务描述
  - `extInfo?: ExtInfo`：扩展信息
- `options`：任务配置
  - `concurrency?: number`：并发执行数量，默认为 1

#### 方法

| 方法名                                                                            | 描述         | 参数                                                                | 返回值     |
| --------------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------------- | ---------- |
| `getInfo()`                                                                       | 获取任务信息 | 无                                                                  | `TaskInfo` |
| `updateExtInfo(info: ExtInfo)`                                                    | 更新扩展信息 | `info: ExtInfo`                                                     | 无         |
| `setPercent(percent: number)`                                                     | 设置任务进度 | `percent: number`                                                   | 无         |
| `setAtomTasks(atomTaskConfig: [exec: AtomTaskExec, options?: AtomTaskOptions][])` | 设置原子任务 | `atomTaskConfig: [exec: AtomTaskExec, options?: AtomTaskOptions][]` | 无         |
| `start()`                                                                         | 开始任务     | 无                                                                  | 无         |
| `pause()`                                                                         | 暂停任务     | 无                                                                  | 无         |
| `continue()`                                                                      | 继续任务     | 无                                                                  | 无         |
| `cancel()`                                                                        | 取消任务     | 无                                                                  | 无         |
| `restart()`                                                                       | 重启任务     | 无                                                                  | 无         |
| `failed(error: Error \| string)`                                                  | 标记任务失败 | `error: Error \| string`                                            | 无         |
| `complete()`                                                                      | 标记任务完成 | 无                                                                  | 无         |
| `remove()`                                                                        | 移除任务     | 无                                                                  | 无         |

#### 事件

| 事件名     | 描述               | 回调参数                                  |
| ---------- | ------------------ | ----------------------------------------- |
| `start`    | 任务开始时触发     | `{ taskInfo: TaskInfo }`                  |
| `pause`    | 任务暂停时触发     | `{ taskInfo: TaskInfo }`                  |
| `continue` | 任务继续时触发     | `{ taskInfo: TaskInfo }`                  |
| `cancel`   | 任务取消时触发     | `{ taskInfo: TaskInfo }`                  |
| `complete` | 任务完成时触发     | `{ taskInfo: TaskInfo }`                  |
| `error`    | 任务失败时触发     | `{ taskInfo: TaskInfo, error: Error }`    |
| `restart`  | 任务重启时触发     | `{ taskInfo: TaskInfo }`                  |
| `remove`   | 任务移除时触发     | `{ taskInfo: TaskInfo }`                  |
| `percent`  | 任务进度更新时触发 | `{ percent: number, taskInfo: TaskInfo }` |

### 任务状态

| 状态名      | 描述         |
| ----------- | ------------ |
| `Pending`   | 任务待执行   |
| `Running`   | 任务正在执行 |
| `Paused`    | 任务已暂停   |
| `Completed` | 任务已完成   |
| `Failed`    | 任务执行失败 |
| `Cancel`    | 任务已取消   |
| `Removed`   | 任务已移除   |

## 开发

### 安装依赖

```bash
$ pnpm install
```

### 开发模式

```bash
$ pnpm run dev
```

### 构建

```bash
$ pnpm run build
```

### 运行测试

```bash
$ pnpm run test
```

## 许可证

MIT

## 贡献

欢迎提交 Issue 和 Pull Request！

## 相关链接

- [GitHub 仓库](https://github.com/tianfeng98/task-runner-plus)
- [NPM 包](https://www.npmjs.com/package/task-runner-plus)
- [Issues](https://github.com/tianfeng98/task-runner-plus/issues)
