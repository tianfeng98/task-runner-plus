# task-runner-plus

[![NPM version](https://img.shields.io/npm/v/task-runner-plus.svg?style=flat)](https://npmjs.com/package/task-runner-plus)
[![NPM downloads](http://img.shields.io/npm/dm/task-runner-plus.svg?style=flat)](https://npmjs.com/package/task-runner-plus)

[中文文档](./README.md) | English

## Introduction

task-runner-plus is a lightweight task execution library for managing concurrent task execution, progress control, and error retry mechanisms. It helps you easily manage complex asynchronous task flows with real-time progress feedback and status management.

## Features

- ✅ **Concurrency Control**: Configure the number of concurrent task executions
- ✅ **Progress Management**: Real-time task execution progress updates
- ✅ **Status Management**: Complete task lifecycle management (pending, running, paused, completed, failed, cancelled, removed)
- ✅ **Error Handling**: Support for task failure retry mechanisms
- ✅ **Event Listening**: Rich event hooks for monitoring task status changes
- ✅ **Atomic Tasks**: Support breaking complex tasks into multiple atomic tasks
- ✅ **TypeScript Support**: Complete TypeScript type definitions
- ✅ **Dynamic Atomic Tasks**: Support dynamically adding and removing atomic tasks during task execution

## Installation

```bash
# Using npm
$ npm install task-runner-plus

# Using pnpm
$ pnpm add task-runner-plus

# Using yarn
$ yarn add task-runner-plus
```

## Usage Examples

### Basic Usage

```javascript
import { Task, TaskStatus } from "task-runner-plus";

// Create a task
const task = new Task({ name: "Test Task", description: "A simple test task" });

// Listen to task events
task.event.on("start", ({ taskInfo }) => {
  console.log("Task started:", taskInfo.name);
});

task.event.on("complete", ({ taskInfo }) => {
  console.log("Task completed:", taskInfo.name);
});

task.event.on("progress", ({ percent, taskInfo }) => {
  console.log("Task progress:", percent + "%");
});

// Update task progress
task.setProgress(50);

// Start the task
task.start();

// Complete the task
task.complete();
```

### Using Atomic Tasks

```javascript
import { Task, AtomTask } from "task-runner-plus";

// Create a task
const task = new Task({ name: "Atomic Task Example" });

// Set atomic tasks
task.setAtomTasks([
  new AtomTask({
    exec: async ({ exitRetry, signal }) => {
      console.log("Executing first atomic task");
      await new Promise((resolve) => setTimeout(resolve, 1000));
    },
    processMsg: "Executing first task...",
    successMsg: "First task completed",
  }),
  new AtomTask({
    exec: async ({ exitRetry, signal }) => {
      console.log("Executing second atomic task");
      await new Promise((resolve) => setTimeout(resolve, 1500));
    },
    processMsg: "Executing second task...",
    successMsg: "Second task completed",
  }),
]);

// Start the task
task.start();
```

### Configuring Concurrent Execution

```javascript
import { Task, AtomTask } from "task-runner-plus";

// Create a task with concurrency of 2
const task = new Task({}, { concurrency: 2 });

// Set multiple atomic tasks
const atomTasks = Array.from(
  { length: 5 },
  (_, index) =>
    new AtomTask({
      exec: async ({ signal }) => {
        console.log(`Executing atomic task ${index + 1}`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      },
      processMsg: `Executing task ${index + 1}...`,
      successMsg: `Task ${index + 1} completed`,
    }),
);

task.setAtomTasks(atomTasks);

// Start the task
task.start();
```

## API Documentation

### Task Class

#### Constructor

```typescript
new Task(params?: Partial<TaskInfo>, options?: TaskOptions)
```

**Parameters**:

- `params`: Task initialization parameters
  - `name?: string`: Task name
  - `description?: string`: Task description
  - `extInfo?: ExtInfo`: Extended information
- `options`: Task configuration
  - `concurrency?: number`: Number of concurrent executions, default is 1
  - `ctx?: Ctx`: Custom context object passed to atomic tasks

#### Methods

| Method                                     | Description          | Parameter                    | Return Value        |
| ------------------------------------------ | -------------------- | ---------------------------- | ------------------- |
| `getInfo()`                                | Get task info        | None                         | `TaskInfo`          |
| `getCtx()`                                 | Get task context     | None                         | `TaskCtx<Ctx>`      |
| `updateExtInfo(info: ExtInfo)`             | Update extended info | `info: ExtInfo`              | None                |
| `setProgress(percent: number)`             | Set task progress    | `percent: number`            | None                |
| `setTaskMsg(msg: string)`                  | Set task message     | `msg: string`                | None                |
| `setAtomTasks(atomTasks: AtomTask<Ctx>[])` | Set atomic tasks     | `atomTasks: AtomTask<Ctx>[]` | None                |
| `addAtomTasks(atomTasks: AtomTask<Ctx>[])` | Add atomic tasks     | `atomTasks: AtomTask<Ctx>[]` | None                |
| `start()`                                  | Start task           | None                         | None                |
| `pause()`                                  | Pause task           | None                         | `Promise<void>`     |
| `resume()`                                 | Resume task          | None                         | None                |
| `cancel()`                                 | Cancel task          | None                         | None                |
| `restart()`                                | Restart task         | None                         | None                |
| `failed(error: Error \| string)`           | Mark task failed     | `error: Error \| string`     | None                |
| `complete()`                               | Mark task complete   | None                         | None                |
| `remove()`                                 | Remove task          | None                         | None                |
| `waitForEnd()`                             | Wait for task end    | None                         | `Promise<TaskInfo>` |

#### Events

| Event      | Description                    | Callback Parameter                        |
| ---------- | ------------------------------ | ----------------------------------------- |
| `start`    | Triggered when task starts     | `{ taskInfo: TaskInfo }`                  |
| `pause`    | Triggered when task pauses     | `{ taskInfo: TaskInfo }`                  |
| `resume`   | Triggered when task resumes    | `{ taskInfo: TaskInfo }`                  |
| `cancel`   | Triggered when task cancels    | `{ taskInfo: TaskInfo }`                  |
| `complete` | Triggered when task completes  | `{ taskInfo: TaskInfo }`                  |
| `error`    | Triggered when task fails      | `{ taskInfo: TaskInfo, error: Error }`    |
| `restart`  | Triggered when task restarts   | `{ taskInfo: TaskInfo }`                  |
| `remove`   | Triggered when task is removed | `{ taskInfo: TaskInfo }`                  |
| `progress` | Triggered on progress update   | `{ percent: number, taskInfo: TaskInfo }` |

### Task Status

| Status      | Description                                             |
| ----------- | ------------------------------------------------------- |
| `Pending`   | Task is pending execution                               |
| `Running`   | Task is currently executing                             |
| `Pausing`   | Task is pausing (waiting for running tasks to complete) |
| `Paused`    | Task is paused                                          |
| `Completed` | Task completed successfully                             |
| `Failed`    | Task execution failed                                   |
| `Cancel`    | Task was cancelled                                      |
| `Removed`   | Task was removed                                        |

### Task Info

`TaskInfo` contains the following fields:

| Field              | Type             | Description                     |
| ------------------ | ---------------- | ------------------------------- |
| `id`               | `string`         | Unique task identifier          |
| `name`             | `string?`        | Task name                       |
| `description`      | `string?`        | Task description                |
| `createdAt`        | `number`         | Creation timestamp              |
| `completedAt`      | `number?`        | Completion timestamp            |
| `status`           | `TaskStatus`     | Task status                     |
| `percent`          | `number`         | Completion progress percentage  |
| `extInfo`          | `ExtInfo?`       | Extended information            |
| `error`            | `TaskError?`     | Error information               |
| `taskMsg`          | `string?`        | Task execution message          |
| `atomTaskInfoList` | `AtomTaskInfo[]` | Atomic task execution info list |

### Error Handling

```typescript
interface TaskError {
  name: string; // Error name
  message: string; // Error message
}
```

### Task Context

You can pass a custom context object through the `ctx` option and access it via `this` in atomic tasks:

```typescript
import { Task, AtomTask } from "task-runner-plus";

const task = new Task(
  {},
  {
    ctx: {
      userId: 123,
      fetchData: async (url: string) => {
        // Custom method
      },
    },
  },
);

task.setAtomTasks([
  new AtomTask<{ userId: number; fetchData: (url: string) => Promise<any> }>(
    async function () {
      // Access context via this
      const userId = this.userId;
      const data = await this.fetchData(`/api/users/${userId}`);
      console.log("Fetched data:", data);
    },
    {
      processMsg: "Fetching user data...",
      successMsg: "User data fetched successfully",
    },
  ),
]);

task.start();
```

### AtomTask Class

Atomic tasks are the execution units of a Task, used to split complex tasks into manageable subtasks. Each atomic task can independently configure retry, timeout, and other options.

#### AtomTask Constructor

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

**Parameter Details**:

- `config.exec`: Atomic task execution function
- `config.processMsg`: Message displayed during task execution
- `config.successMsg`: Message displayed on successful completion
- `config.errorMsg`: Error message displayed on failure
- `options.retryTimes`: Number of retries, default 3
- `options.retryDelay`: Retry delay in milliseconds, default 1000
- `options.timeoutOption`: Timeout in milliseconds, default 60000

#### Atomic Task Execution Function

```typescript
type AtomTaskExec<Ctx> = (input: {
  exitRetry: (err: any) => void;
  signal: AbortSignal;
  ctx: Ctx;
  execCount: number;
}) => Promise<any> | void;
```

**Parameter Details**:

- `exitRetry`: Call this function to exit the retry loop
- `signal`: AbortSignal for canceling the task
- `ctx`: Task context object
- `execCount`: Current execution count

#### Atomic Task Status

| Status      | Description                              |
| ----------- | ---------------------------------------- |
| `PENDING`   | Waiting to execute                       |
| `RUNNING`   | Currently executing                      |
| `COMPLETED` | Execution completed                      |
| `FAILED`    | Execution failed                         |
| `WARNING`   | Warning status, task continues execution |

#### Atomic Task Info

`AtomTaskInfo` contains the following fields:

| Field        | Type    | Description                       |
| ------------ | ------- | --------------------------------- |
| `status`     | Enum    | Current status of the atomic task |
| `processMsg` | string? | Message during execution          |
| `successMsg` | string? | Message on successful completion  |
| `errorMsg`   | string? | Error message on failure          |

#### Atomic Task Methods

| Method              | Description          | Parameter           | Return Value            |
| ------------------- | -------------------- | ------------------- | ----------------------- |
| `getAtomTaskInfo()` | Get atomic task info | None                | `AtomTaskInfo`          |
| `run(ctx)`          | Execute atomic task  | `ctx: TaskCtx<Ctx>` | `Promise<AtomTaskInfo>` |

### Task Message Function Context

Task messages support function form, can access execution context:

```typescript
import { Task, AtomTask } from "task-runner-plus";

const task = new Task({ name: "Message Function Example" });

// Set atomic tasks with function-form messages
task.setAtomTasks([
  new AtomTask({
    exec: async ({ ctx }) => {
      // Store data in context
      ctx.set("userId", 123);
      ctx.set("userName", "John Doe");
      await new Promise((r) => setTimeout(r, 1000));
    },
    // Function-form processMsg, can access ctx
    processMsg: (ctx) => {
      const userId = ctx.get("userId") || "unknown";
      return `Processing task for user ${userId}...`;
    },
    // Function-form successMsg, can access ctx
    successMsg: (ctx) => {
      const userName = ctx.get("userName") || "unknown";
      return `Task processed successfully for user ${userName}`;
    },
  }),
]);

// Start the task
task.start();
```

### Dynamic Atomic Tasks

#### Dynamically Adding Atomic Tasks

Support for dynamically adding new atomic tasks during task execution:

```typescript
import { Task, AtomTask } from "task-runner-plus";

const task = new Task({ name: "Dynamic Task Example" });

// Initial task
task.setAtomTasks([
  new AtomTask({
    exec: async ({ signal }) => {
      console.log("Executing first task");
      await new Promise((r) => setTimeout(r, 1000));
    },
    processMsg: "Executing first task...",
    successMsg: "First task completed",
  }),
]);

// Listen to completion event, dynamically add new task
task.event.on("complete", () => {
  task.addAtomTasks([
    new AtomTask({
      exec: async ({ signal }) => {
        console.log("Executing second task");
        await new Promise((r) => setTimeout(r, 1000));
      },
      processMsg: "Executing second task...",
      successMsg: "Second task completed",
    }),
  ]);
});

task.start();
```

#### Dynamically Removing Atomic Tasks

Support for dynamically removing atomic tasks during task execution:

```typescript
import { Task, AtomTask } from "task-runner-plus";

const task = new Task({ name: "Dynamic Remove Task Example" });

// Create atomic tasks
const atomTask1 = new AtomTask({
  exec: async ({ signal }) => {
    console.log("Executing first task");
    await new Promise((r) => setTimeout(r, 2000)); // Simulate time-consuming operation
  },
  processMsg: "Executing first task...",
  successMsg: "First task completed",
});

const atomTask2 = new AtomTask({
  exec: async ({ signal }) => {
    console.log("Executing second task");
    await new Promise((r) => setTimeout(r, 1000));
  },
  processMsg: "Executing second task...",
  successMsg: "Second task completed",
});

// Set atomic tasks
task.setAtomTasks([atomTask1, atomTask2]);

// Start the task
task.start();

// Remove the second task after some time
setTimeout(async () => {
  console.log("Removing second task");
  await task.removeAtomTasks([atomTask2.id]);
}, 500);

// Wait for task completion
await task.waitForEnd();
// Only the first task will complete execution, the second task will be removed
```

### promiseFor

A utility function that waits for a condition to be satisfied before returning the result:

```typescript
function promiseFor<T>(
  condition: () => boolean,
  result: () => T,
  options?: { timeout?: number; delay?: number },
): Promise<T>;
```

**Parameter Details**:

- `condition`: Condition function, returns true when condition is met
- `result`: Result function, returns the final result
- `options.timeout`: Timeout in milliseconds, default 10000
- `options.delay`: Check interval in milliseconds, default 500

**Return Value**: Returns the result when the condition is met, throws an error on timeout

**Example**:

```typescript
import { promiseFor } from "task-runner-plus";

// Wait for element to appear in DOM
const element = await promiseFor(
  () => document.querySelector("#my-element") !== null,
  () => document.querySelector("#my-element"),
  { timeout: 5000, delay: 100 },
);

// Wait for async data to load
const data = await promiseFor(
  () => store.isLoaded,
  () => store.data,
  { timeout: 10000 },
);
```

## Development

### Install Dependencies

```bash
pnpm install
```

### Development Mode

```bash
pnpm run dev
```

### Build

```bash
pnpm run build
```

### Run Tests

```bash
pnpm run test
```

## License

MIT

## Contributing

Issues and Pull Requests are welcome!

## Related Links

- [GitHub Repository](https://github.com/tianfeng98/task-runner-plus)
- [NPM Package](https://www.npmjs.com/package/task-runner-plus)
- [Issues](https://github.com/tianfeng98/task-runner-plus/issues)
