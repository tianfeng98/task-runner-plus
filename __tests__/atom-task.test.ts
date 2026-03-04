import { describe, expect, it } from "vitest";
import { AtomTask, AtomTaskExecResult, Task, TaskStatus } from "../src";

describe("AtomTask类测试", () => {
  describe("原子任务执行测试", () => {
    it("应该能够设置原子任务", () => {
      const task = new Task({});
      const atomTasks = [
        new AtomTask({ exec: async () => {} }),
        new AtomTask({ exec: async () => {} }),
      ];
      task.setAtomTasks(atomTasks);
      expect(Array.isArray(task.getTaskInfo().atomTaskInfoList)).toBe(true);
      expect(task.getTaskInfo().atomTaskInfoList.length).toBe(2);
    });

    it("应该能够成功执行原子任务", async () => {
      const task = new Task({});
      let execCount = 0;

      const atomTasks = [
        new AtomTask({
          exec: async () => {
            execCount++;
          },
        }),
      ];

      task.setAtomTasks(atomTasks);
      task.start();

      // 等待任务完成
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(execCount).toBe(1);
      expect(task.status).toBe(TaskStatus.Completed);
      expect(task.percent).toBe(100);
    });

    // it("应该能够处理原子任务失败", async () => {
    //   const task = new Task({});

    //   const atomTasks = [
    //     new AtomTask({
    //       exec: async () => {
    //         throw new Error("Atom task failed");
    //       },
    //       errorMsg: "Atom task failed",
    //     }, { retryTimes: 1, retryDelay: 100 }),
    //   ];

    //   task.setAtomTasks(atomTasks);
    //   task.start();

    //   // 等待任务失败，确保重试和finally块执行
    //   await new Promise((resolve) => setTimeout(resolve, 500));

    //   expect(task.status, TaskStatus.Failed);
    //   expect(task.error.message.includes("AtomTask").toBe(true);
    // });

    // ctx 测试
    it("应该能够在原子任务中访问和修改上下文", async () => {
      const task = new Task(
        { name: "Test Task Ctx" },
        { defaultCtxData: { value: 1 } },
      );

      const atomTasks = [
        new AtomTask<{ value: number }>({
          exec: async ({ ctx }) => {
            ctx.set("value", 42);
          },
        }),
      ];

      task.setAtomTasks(atomTasks);
      task.start();

      // 等待任务完成
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(task.getTaskInfo().state.value).toBe(42);
    });
  });

  describe("子任务重要级别（warning状态）测试", () => {
    it("应该能够处理原子任务返回warning状态，任务继续执行", async () => {
      const task = new Task({});
      let warningTaskExecuted = false;
      let completedTaskExecuted = false;

      const atomTasks = [
        new AtomTask({
          exec: async () => {
            warningTaskExecuted = true;
            return AtomTaskExecResult.Warning;
          },
          warningMsg: "Warning: This is a warning message",
          successMsg: "This should not be shown",
        }),
        new AtomTask({
          exec: async () => {
            completedTaskExecuted = true;
            return AtomTaskExecResult.Completed;
          },
          successMsg: "Task completed successfully",
        }),
      ];

      task.setAtomTasks(atomTasks);
      task.start();

      // 等待任务完成
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(warningTaskExecuted).toBe(true);
      expect(completedTaskExecuted).toBe(true);
      expect(task.status).toBe(TaskStatus.Completed);
      expect(task.percent).toBe(100);
      // 验证警告任务状态
      expect(atomTasks[0].getAtomTaskInfo().status).toBe("WARNING");
      expect(atomTasks[0].getAtomTaskInfo().warningMsg).toBe(
        "Warning: This is a warning message",
      );
      // 验证完成任务状态
      expect(atomTasks[1].getAtomTaskInfo().status).toBe("COMPLETED");
    });

    it("应该能够处理多个原子任务返回warning状态", async () => {
      const task = new Task({});
      let warningCount = 0;

      const atomTasks = [
        new AtomTask({
          exec: async () => {
            warningCount++;
            return AtomTaskExecResult.Warning;
          },
          warningMsg: "First warning",
        }),
        new AtomTask({
          exec: async () => {
            warningCount++;
            return AtomTaskExecResult.Warning;
          },
          warningMsg: "Second warning",
        }),
      ];

      task.setAtomTasks(atomTasks);
      task.start();

      // 等待任务完成
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(warningCount).toBe(2);
      expect(task.status).toBe(TaskStatus.Completed);
      expect(task.percent).toBe(100);
      // 验证所有警告任务状态
      expect(atomTasks[0].getAtomTaskInfo().status).toBe("WARNING");
      expect(atomTasks[1].getAtomTaskInfo().status).toBe("WARNING");
    });

    it("应该能够处理混合状态的原子任务（warning和completed）", async () => {
      const task = new Task({});
      let warningExecuted = false;
      let completedExecuted = false;

      const atomTasks = [
        new AtomTask({
          exec: async () => {
            warningExecuted = true;
            return AtomTaskExecResult.Warning;
          },
          warningMsg: "Task with warning",
        }),
        new AtomTask({
          exec: async () => {
            completedExecuted = true;
            AtomTaskExecResult.Completed;
          },
          successMsg: "Task completed",
        }),
      ];

      task.setAtomTasks(atomTasks);
      task.start();

      // 等待任务完成
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(warningExecuted).toBe(true);
      expect(completedExecuted).toBe(true);
      expect(task.status).toBe(TaskStatus.Completed);
      // 验证任务状态
      expect(atomTasks[0].getAtomTaskInfo().status).toBe("WARNING");
      expect(atomTasks[1].getAtomTaskInfo().status).toBe("COMPLETED");
    });

    it("当有原子任务返回failed状态时，任务应该失败，忽略warning状态", async () => {
      const task = new Task({});
      let warningExecuted = false;
      let failedExecuted = false;

      const atomTasks = [
        new AtomTask({
          exec: async () => {
            warningExecuted = true;
            return AtomTaskExecResult.Warning;
          },
          warningMsg: "Task with warning",
        }),
        new AtomTask({
          exec: async () => {
            failedExecuted = true;
            return AtomTaskExecResult.Failed;
          },
          errorMsg: "Task failed",
        }),
      ];

      task.setAtomTasks(atomTasks);
      task.start();

      // 等待任务完成并处理可能的Promise拒绝
      try {
        await task.waitForEnd();
      } catch {
        // 忽略预期的拒绝
      }

      expect(warningExecuted).toBe(true);
      expect(failedExecuted).toBe(true);
      expect(task.status).toBe(TaskStatus.Failed);
      // 验证任务状态
      expect(atomTasks[0].getAtomTaskInfo().status).toBe("WARNING");
      expect(atomTasks[1].getAtomTaskInfo().status).toBe("FAILED");
    });
  });

  describe("任务消息支持函数调用上下文测试", () => {
    it("应该能够处理processMsg为函数的情况", async () => {
      const task = new Task({});
      let taskExecuted = false;

      const atomTasks = [
        new AtomTask({
          exec: async ({ ctx }) => {
            taskExecuted = true;
            // 在上下文中设置值
            ctx.set("userId", 123);
            AtomTaskExecResult.Completed;
          },
          processMsg: (ctx) => {
            const userId = ctx.get("userId") || "unknown";
            return `Processing task for user ${userId}`;
          },
          successMsg: "Task completed",
        }),
      ];

      task.setAtomTasks(atomTasks);
      task.start();

      // 等待任务完成
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(taskExecuted).toBe(true);
      expect(task.status).toBe(TaskStatus.Completed);
    });

    it("应该能够处理successMsg为函数的情况", async () => {
      const task = new Task({});
      let taskExecuted = false;

      const atomTasks = [
        new AtomTask({
          exec: async ({ ctx }) => {
            taskExecuted = true;
            ctx.set("result", "success");
            AtomTaskExecResult.Completed;
          },
          successMsg: (ctx) => {
            const result = ctx.get("result");
            return `Task completed with result: ${result}`;
          },
        }),
      ];

      task.setAtomTasks(atomTasks);
      task.start();

      // 等待任务完成并处理可能的Promise拒绝
      try {
        await task.waitForEnd();
      } catch {
        // 忽略预期的拒绝
      }

      expect(taskExecuted).toBe(true);
      expect(task.status).toBe(TaskStatus.Completed);
      // 验证成功消息
      expect(typeof atomTasks[0].getAtomTaskInfo().successMsg).toBe("string");
    });

    it("应该能够处理errorMsg为函数的情况", async () => {
      const task = new Task({});
      let taskExecuted = false;

      const atomTasks = [
        new AtomTask({
          exec: async ({ ctx }) => {
            taskExecuted = true;
            ctx.set("errorCode", "500");
            return AtomTaskExecResult.Failed;
          },
          errorMsg: (ctx) => {
            const errorCode = ctx.get("errorCode");
            return `Task failed with error code: ${errorCode}`;
          },
        }),
      ];

      task.setAtomTasks(atomTasks);
      task.start();

      // 等待任务完成并处理可能的Promise拒绝
      try {
        await task.waitForEnd();
      } catch {
        // 忽略预期的拒绝
      }

      expect(taskExecuted).toBe(true);
      expect(task.status).toBe(TaskStatus.Failed);
      // 验证错误消息
      expect(typeof atomTasks[0].getAtomTaskInfo().errorMsg).toBe("string");
    });

    it("应该能够处理errorMsg为函数的情况（抛出异常）", async () => {
      const task = new Task({});
      let taskExecuted = false;
      const errorInfo = "Atom task failed";
      const atomTasks = [
        new AtomTask({
          exec: async () => {
            taskExecuted = true;
            throw new Error(errorInfo);
          },
          errorMsg: (_, error) => {
            return error.message;
          },
        }),
      ];

      task.setAtomTasks(atomTasks);
      task.start();

      // 等待任务完成并处理可能的Promise拒绝
      try {
        await task.waitForEnd();
      } catch {
        // 忽略预期的拒绝
      }

      expect(taskExecuted).toBe(true);
      expect(task.status).toBe(TaskStatus.Failed);
      // 验证错误消息
      expect(atomTasks[0].getAtomTaskInfo().errorMsg).toBe(errorInfo);
    });

    it("应该能够处理warningMsg为函数的情况", async () => {
      const task = new Task({});
      let taskExecuted = false;

      const atomTasks = [
        new AtomTask({
          exec: async ({ ctx }) => {
            taskExecuted = true;
            ctx.set("warningLevel", "low");
            return AtomTaskExecResult.Warning;
          },
          warningMsg: (ctx) => {
            const warningLevel = ctx.get("warningLevel");
            return `Task completed with ${warningLevel} level warning`;
          },
        }),
      ];

      task.setAtomTasks(atomTasks);
      task.start();

      // 等待任务完成并处理可能的Promise拒绝
      try {
        await task.waitForEnd();
      } catch {
        // 忽略预期的拒绝
      }

      expect(taskExecuted).toBe(true);
      expect(task.status).toBe(TaskStatus.Completed);
      // 验证警告消息
      expect(atomTasks[0].getAtomTaskInfo().status).toBe("WARNING");
      expect(typeof atomTasks[0].getAtomTaskInfo().warningMsg).toBe("string");
    });

    it("当消息为字符串时，应该直接返回字符串", async () => {
      const task = new Task({});
      let taskExecuted = false;

      const atomTasks = [
        new AtomTask({
          exec: async () => {
            taskExecuted = true;
            AtomTaskExecResult.Completed;
          },
          processMsg: "Processing task",
          successMsg: "Task completed successfully",
        }),
      ];

      task.setAtomTasks(atomTasks);
      task.start();

      // 等待任务完成
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(taskExecuted).toBe(true);
      expect(task.status).toBe(TaskStatus.Completed);
      // 验证消息
      expect(atomTasks[0].getAtomTaskInfo().processMsg).toBe("Processing task");
      expect(typeof atomTasks[0].getAtomTaskInfo().successMsg).toBe("string");
    });

    it("应该能够混合使用函数和字符串形式的消息", async () => {
      const task = new Task({});
      let taskExecuted = false;

      const atomTasks = [
        new AtomTask({
          exec: async ({ ctx }) => {
            taskExecuted = true;
            ctx.set("step", 1);
            return AtomTaskExecResult.Warning;
          },
          processMsg: "Processing task", // 字符串
          warningMsg: (ctx) => {
            // 函数
            const step = ctx.get("step");
            return `Warning at step ${step}`;
          },
          successMsg: "This should not be shown", // 字符串
        }),
      ];

      task.setAtomTasks(atomTasks);
      task.start();

      // 等待任务完成
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(taskExecuted).toBe(true);
      expect(task.status).toBe(TaskStatus.Completed);
      // 验证任务状态
      expect(atomTasks[0].getAtomTaskInfo().status, "WARNING");
      expect(atomTasks[0].getAtomTaskInfo().processMsg, "Processing task");
      expect(typeof atomTasks[0].getAtomTaskInfo().warningMsg, "string");
    });
  });

  describe("原子任务动态移除测试", () => {
    it("应该能够在任务处于Pending状态时动态移除原子任务", async () => {
      const task = new Task({});
      let task1Executed = false;
      let task2Executed = false;

      // 创建两个原子任务
      const atomTask1 = new AtomTask({
        exec: async () => {
          task1Executed = true;
          AtomTaskExecResult.Completed;
        },
        successMsg: "Task 1 completed",
      });

      const atomTask2 = new AtomTask({
        exec: async () => {
          task2Executed = true;
          AtomTaskExecResult.Completed;
        },
        successMsg: "Task 2 completed",
      });

      // 设置原子任务
      task.setAtomTasks([atomTask1, atomTask2]);

      // 在Pending状态下移除第二个原子任务
      await task.removeAtomTasks([atomTask2.id]);

      // 启动任务
      task.start();

      // 等待任务完成
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(task1Executed).toBe(true);
      expect(task2Executed).toBe(false); // 第二个任务应该被移除，不执行
      expect(task.status).toBe(TaskStatus.Completed);
    });

    it("应该能够在任务处于Running状态时动态移除原子任务", async () => {
      const task = new Task({});
      let task1Executed = false;
      let task2Executed = false;

      // 创建两个原子任务
      const atomTask1 = new AtomTask({
        exec: async () => {
          // 模拟耗时操作，以便有时间在Running状态下移除第二个任务
          await new Promise((resolve) => setTimeout(resolve, 100));
          task1Executed = true;
          return AtomTaskExecResult.Completed;
        },
        successMsg: "Task 1 completed",
      });

      const atomTask2 = new AtomTask({
        exec: async () => {
          task2Executed = true;
          return AtomTaskExecResult.Completed;
        },
        successMsg: "Task 2 completed",
      });

      // 设置原子任务
      task.setAtomTasks([atomTask1, atomTask2]);

      // 启动任务
      task.start();

      // 等待一段时间，确保任务进入Running状态
      await new Promise((resolve) => setTimeout(resolve, 50));

      // 在Running状态下移除第二个原子任务
      await task.removeAtomTasks([atomTask2.id]);

      // 等待任务完成
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(task1Executed).toBe(true);
      expect(task2Executed).toBe(false); // 第二个任务应该被移除，不执行
      expect(task.status).toBe(TaskStatus.Completed);
    });

    it("应该能够移除多个原子任务", async () => {
      const task = new Task({});
      let task1Executed = false;
      let task2Executed = false;
      let task3Executed = false;

      // 创建三个原子任务
      const atomTask1 = new AtomTask({
        exec: async () => {
          task1Executed = true;
          AtomTaskExecResult.Completed;
        },
        successMsg: "Task 1 completed",
      });

      const atomTask2 = new AtomTask({
        exec: async () => {
          task2Executed = true;
          AtomTaskExecResult.Completed;
        },
        successMsg: "Task 2 completed",
      });

      const atomTask3 = new AtomTask({
        exec: async () => {
          task3Executed = true;
          AtomTaskExecResult.Completed;
        },
        successMsg: "Task 3 completed",
      });

      // 设置原子任务
      task.setAtomTasks([atomTask1, atomTask2, atomTask3]);

      // 移除第二个和第三个原子任务
      await task.removeAtomTasks([atomTask2.id, atomTask3.id]);

      // 启动任务
      task.start();

      // 等待任务完成
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(task1Executed).toBe(true);
      expect(task2Executed).toBe(false); // 第二个任务应该被移除
      expect(task3Executed).toBe(false); // 第三个任务应该被移除
      expect(task.status).toBe(TaskStatus.Completed);
    });

    it("应该只能移除处于Pending状态的原子任务", async () => {
      const task = new Task({});
      let task1Executed = false;
      let task2Executed = false;

      // 创建两个原子任务
      const atomTask1 = new AtomTask({
        exec: async () => {
          // 模拟耗时操作
          await new Promise((resolve) => setTimeout(resolve, 150));
          task1Executed = true;
          AtomTaskExecResult.Completed;
        },
        successMsg: "Task 1 completed",
      });

      const atomTask2 = new AtomTask({
        exec: async () => {
          task2Executed = true;
          AtomTaskExecResult.Completed;
        },
        successMsg: "Task 2 completed",
      });

      // 设置原子任务
      task.setAtomTasks([atomTask1, atomTask2]);

      // 启动任务
      task.start();

      // 等待一段时间，确保第一个任务开始执行（状态变为Running）
      await new Promise((resolve) => setTimeout(resolve, 50));

      // 尝试移除两个任务，只有第二个任务（处于Pending状态）应该被移除
      await task.removeAtomTasks([atomTask1.id, atomTask2.id]);

      // 等待任务完成
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(task1Executed).toBe(true); // 第一个任务已经开始执行，应该继续完成
      expect(task2Executed).toBe(false); // 第二个任务应该被移除，不执行
      expect(task.status).toBe(TaskStatus.Completed);
    });

    it("在不支持的任务状态下移除原子任务应该抛出错误", async () => {
      const task = new Task({});

      // 创建原子任务
      const atomTask = new AtomTask({
        exec: async () => {
          AtomTaskExecResult.Completed;
        },
      });

      // 设置原子任务
      task.setAtomTasks([atomTask]);

      // 启动并完成任务
      task.start();

      // 等待任务完成
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(task.status).toBe(TaskStatus.Completed);

      // 尝试在Completed状态下移除原子任务，应该抛出错误
      await expect(task.removeAtomTasks([atomTask.id])).rejects.toThrow(
        `Task status ${task.status} cannot add atom tasks`,
      );
    });
  });
});
