# task-runner-plus

[![NPM version](https://img.shields.io/npm/v/task-runner-plus.svg?style=flat)](https://npmjs.com/package/task-runner-plus)
[![NPM downloads](http://img.shields.io/npm/dm/task-runner-plus.svg?style=flat)](https://npmjs.com/package/task-runner-plus)

[English](./README.en.md) | 中文文档

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

task.event.on("progress", ({ percent, taskInfo }) => {
  console.log("任务进度:", percent + "%");
});

// 更新任务进度
task.setProgress(50);

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

| 方法名                                     | 描述           | 参数                         | 返回值              |
| ------------------------------------------ | -------------- | ---------------------------- | ------------------- |
| `getInfo()`                                | 获取任务信息   | 无                           | `TaskInfo`          |
| `getCtx()`                                 | 获取任务上下文 | 无                           | `TaskCtx<Ctx>`      |
| `updateExtInfo(info: ExtInfo)`             | 更新扩展信息   | `info: ExtInfo`              | 无                  |
| `setProgress(percent: number)`             | 设置任务进度   | `percent: number`            | 无                  |
| `setTaskMsg(msg: string)`                  | 设置任务信息   | `msg: string`                | 无                  |
| `setAtomTasks(atomTasks: AtomTask<Ctx>[])` | 设置原子任务   | `atomTasks: AtomTask<Ctx>[]` | 无                  |
| `addAtomTasks(atomTasks: AtomTask<Ctx>[])` | 添加原子任务   | `atomTasks: AtomTask<Ctx>[]` | 无                  |
| `start()`                                  | 开始任务       | 无                           | 无                  |
| `pause()`                                  | 暂停任务       | 无                           | `Promise<void>`     |
| `resume()`                                 | 继续任务       | 无                           | 无                  |
| `cancel()`                                 | 取消任务       | 无                           | 无                  |
| `restart()`                                | 重启任务       | 无                           | 无                  |
| `failed(error: Error \| string)`           | 标记任务失败   | `error: Error \| string`     | 无                  |
| `complete()`                               | 标记任务完成   | 无                           | 无                  |
| `remove()`                                 | 移除任务       | 无                           | 无                  |
| `waitForEnd()`                             | 等待任务结束   | 无                           | `Promise<TaskInfo>` |

#### 事件

| 事件名     | 描述               | 回调参数                                  |
| ---------- | ------------------ | ----------------------------------------- |
| `start`    | 任务开始时触发     | `{ taskInfo: TaskInfo }`                  |
| `pause`    | 任务暂停时触发     | `{ taskInfo: TaskInfo }`                  |
| `resume`   | 任务继续时触发     | `{ taskInfo: TaskInfo }`                  |
| `cancel`   | 任务取消时触发     | `{ taskInfo: TaskInfo }`                  |
| `complete` | 任务完成时触发     | `{ taskInfo: TaskInfo }`                  |
| `error`    | 任务失败时触发     | `{ taskInfo: TaskInfo, error: Error }`    |
| `restart`  | 任务重启时触发     | `{ taskInfo: TaskInfo }`                  |
| `remove`   | 任务移除时触发     | `{ taskInfo: TaskInfo }`                  |
| `progress` | 任务进度更新时触发 | `{ percent: number, taskInfo: TaskInfo }` |

### 任务状态

| 状态名      | 描述                           |
| ----------- | ------------------------------ |
| `Pending`   | 任务待执行                     |
| `Running`   | 任务正在执行                   |
| `Pausing`   | 任务暂停中（等待执行中的完成） |
| `Paused`    | 任务已暂停                     |
| `Completed` | 任务已完成                     |
| `Failed`    | 任务执行失败                   |
| `Cancel`    | 任务已取消                     |
| `Removed`   | 任务已移除                     |

### 任务信息

`TaskInfo` 包含以下字段：

| 字段名             | 类型             | 描述                 |
| ------------------ | ---------------- | -------------------- |
| `id`               | `string`         | 任务唯一标识         |
| `name`             | `string?`        | 任务名称             |
| `description`      | `string?`        | 任务描述             |
| `createdAt`        | `number`         | 创建时间戳           |
| `completedAt`      | `number?`        | 完成时间戳           |
| `status`           | `TaskStatus`     | 任务状态             |
| `percent`          | `number`         | 完成进度百分比       |
| `extInfo`          | `ExtInfo?`       | 扩展信息             |
| `error`            | `TaskError?`     | 错误信息             |
| `taskMsg`          | `string?`        | 任务执行过程信息     |
| `atomTaskInfoList` | `AtomTaskInfo[]` | 原子任务执行信息列表 |

### 错误处理

```typescript
interface TaskError {
  name: string; // 错误名称
  message: string; // 错误消息
}
```

### 任务上下文

通过 `ctx` 选项可以传递自定义上下文对象，在原子任务中通过 `this` 访问：

```typescript
import { Task, AtomTask } from "task-runner-plus";

const task = new Task(
  {},
  {
    ctx: {
      userId: 123,
      fetchData: async (url: string) => {
        // 自定义方法
      },
    },
  }
);

task.setAtomTasks([
  new AtomTask<{ userId: number; fetchData: (url: string) => Promise<any> }>(
    async function () {
      // 在原子任务中通过 this 访问上下文
      const userId = this.userId;
      const data = await this.fetchData(`/api/users/${userId}`);
      console.log("获取数据:", data);
    },
    {
      processMsg: "正在获取用户数据...",
      successMsg: "用户数据获取成功",
    }
  ),
]);

task.start();
```

### AtomTask 类

原子任务是 Task 的执行单元，用于将复杂任务拆分为多个可管理的子任务。每个原子任务可以独立配置重试、超时等选项。

#### 构造函数

```typescript
new AtomTask<Ctx>(
  config: {
    exec: AtomTaskExec<Ctx>;
    processMsg?: string;
    successMsg?: string;
    errorMsg?: string;
  },
  options?: AtomTaskOptions
)
```

**参数说明**：

- `config.exec`：原子任务执行函数
- `config.processMsg`：任务执行过程中的提示信息
- `config.successMsg`：任务成功完成后的提示信息
- `config.errorMsg`：任务失败时的错误提示信息
- `options.retryTimes`：重试次数，默认 3
- `options.retryDelay`：重试延迟（毫秒），默认 1000
- `options.timeoutOption`：超时时间（毫秒），默认 60000

#### 原子任务执行函数

```typescript
type AtomTaskExec<Ctx> = (input: {
  exitRetry: (err: any) => void;
  signal: AbortSignal;
  ctx: Ctx;
  execCount: number;
}) => Promise<any> | void;
```

**参数说明**：

- `exitRetry`：调用此函数退出重试循环
- `signal`：AbortSignal，用于取消任务
- `ctx`：任务上下文对象
- `execCount`：当前执行次数

#### 原子任务状态

| 状态名      | 描述     |
| ----------- | -------- |
| `PENDING`   | 等待执行 |
| `RUNNING`   | 正在执行 |
| `COMPLETED` | 执行完成 |
| `FAILED`    | 执行失败 |

#### 原子任务信息

`AtomTaskInfo` 包含以下字段：

| 字段名       | 类型     | 描述                 |
| ------------ | -------- | -------------------- |
| `status`     | 状态枚举 | 原子任务当前状态     |
| `processMsg` | string?  | 执行过程中的提示信息 |
| `successMsg` | string?  | 成功完成后的提示信息 |
| `errorMsg`   | string?  | 失败时的错误提示信息 |

#### 方法

| 方法名              | 描述             | 参数                | 返回值                  |
| ------------------- | ---------------- | ------------------- | ----------------------- |
| `getAtomTaskInfo()` | 获取原子任务信息 | 无                  | `AtomTaskInfo`          |
| `run(ctx)`          | 执行原子任务     | `ctx: TaskCtx<Ctx>` | `Promise<AtomTaskInfo>` |

### 动态添加原子任务

支持在任务执行过程中动态添加新的原子任务：

```typescript
import { Task, AtomTask } from "task-runner-plus";

const task = new Task({ name: "动态任务示例" });

// 初始任务
task.setAtomTasks([
  new AtomTask({
    exec: async ({ signal }) => {
      console.log("执行第一个任务");
      await new Promise((r) => setTimeout(r, 1000));
    },
    processMsg: "正在执行第一个任务...",
    successMsg: "第一个任务完成",
  }),
]);

// 监听任务完成事件，动态添加新任务
task.event.on("complete", () => {
  task.addAtomTasks([
    new AtomTask({
      exec: async ({ signal }) => {
        console.log("执行第二个任务");
        await new Promise((r) => setTimeout(r, 1000));
      },
      processMsg: "正在执行第二个任务...",
      successMsg: "第二个任务完成",
    }),
  ]);
});

task.start();
```

### promiseFor

等待条件满足后返回结果的工具函数：

```typescript
function promiseFor<T>(
  condition: () => boolean,
  result: () => T,
  options?: { timeout?: number; delay?: number }
): Promise<T>;
```

**参数说明**：

- `condition`：条件函数，返回 true 时满足条件
- `result`：结果函数，返回最终结果
- `options.timeout`：超时时间（毫秒），默认 10000
- `options.delay`：检查间隔（毫秒），默认 500

**返回值**：满足条件时返回结果，超时时抛出错误

**示例**：

```typescript
import { promiseFor } from "task-runner-plus";

// 等待元素出现在 DOM 中
const element = await promiseFor(
  () => document.querySelector("#my-element") !== null,
  () => document.querySelector("#my-element"),
  { timeout: 5000, delay: 100 }
);

// 等待异步数据加载完成
const data = await promiseFor(
  () => store.isLoaded,
  () => store.data,
  { timeout: 10000 }
);
```

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
