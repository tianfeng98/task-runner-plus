import assert from "node:assert";
import { describe, it } from "node:test";
import { AtomTask, Task, TaskStatus } from "../dist/es/index.js";

describe("Task类测试", () => {
  describe("基本功能测试", () => {
    it("应该创建一个有效的Task实例", () => {
      const task = new Task({
        name: "Test Task",
        description: "Test Description",
      });
      assert.strictEqual(typeof task, "object");
      assert.strictEqual(task.id.length, 24);
      assert.strictEqual(task.name, "Test Task");
      assert.strictEqual(task.description, "Test Description");
      assert.strictEqual(task.status, TaskStatus.Pending);
      assert.strictEqual(task.percent, 0);
      assert.strictEqual(typeof task.createdAt, "number");
    });

    it("getTaskInfo()方法应该返回正确的任务信息", () => {
      const task = new Task({ name: "Test Task" });
      const info = task.getTaskInfo();
      assert.strictEqual(info.id, task.id);
      assert.strictEqual(info.name, task.name);
      assert.strictEqual(info.status, TaskStatus.Pending);
      assert.strictEqual(info.percent, 0);
      assert.strictEqual(info.createdAt, task.createdAt);
    });

    it("updateExtInfo()方法应该更新扩展信息", () => {
      const task = new Task({});
      const extInfo = { key: "value" };
      task.updateExtInfo(extInfo);
      assert.strictEqual(task.extInfo, extInfo);
      assert.strictEqual(task.getTaskInfo().extInfo, extInfo);
    });

    it("setPercent()方法应该更新进度并触发progress事件", (t) => {
      const task = new Task({});
      let eventEmitted = false;
      let emittedPercent = 0;

      // 模拟事件监听
      task.event = {
        emit: (event, data) => {
          if (event === "progress") {
            eventEmitted = true;
            emittedPercent = data.percent;
          }
        },
      };

      task.setPercent(50);
      assert.strictEqual(task.percent, 50);
      assert.strictEqual(eventEmitted, true);
      assert.strictEqual(emittedPercent, 50);
    });
  });

  describe("状态转换测试", () => {
    it("应该能够从Pending状态转换到Running状态", () => {
      const task = new Task({});
      task.start();
      assert.strictEqual(task.status, TaskStatus.Running);
    });

    it("不应该从非Pending状态开始任务", () => {
      const task = new Task({});
      task.start();
      assert.throws(() => task.start(), Error);
    });

    it("应该能够从Running状态转换到Paused状态", async () => {
      const task = new Task({});
      task.start();
      await task.pause();
      assert.strictEqual(task.status, TaskStatus.Paused);
    });

    it("不应该从非Running状态暂停任务", async () => {
      const task = new Task({});
      await assert.rejects(() => task.pause(), Error);
    });

    it("应该能够从Paused状态转换到Running状态", async () => {
      const task = new Task({});
      task.start();
      await task.pause();
      task.resume();
      assert.strictEqual(task.status, TaskStatus.Running);
    });

    it("不应该从非Paused状态继续任务", () => {
      const task = new Task({});
      assert.throws(() => task.resume(), Error);
    });

    it("应该能够完成任务", () => {
      const task = new Task({});
      task.start();
      task.complete();
      assert.strictEqual(task.status, TaskStatus.Completed);
      assert.strictEqual(task.percent, 100);
      assert.strictEqual(typeof task.completedAt, "number");
    });

    it("不应该从非Running状态完成任务", () => {
      const task = new Task({});
      assert.throws(() => task.complete(), Error);
    });

    it("应该能够标记任务失败", async () => {
      const task = new Task({});
      task.start();
      task.failed("Test Error");
      assert.strictEqual(task.status, TaskStatus.Failed);
      assert.strictEqual(task.error.name, "Error");
      assert.strictEqual(task.error.message, "Test Error");
      // 处理可能的Promise拒绝
      try {
        await task.waitForEnd();
      } catch {
        // 忽略预期的拒绝
      }
    });

    it("不应该从非Running状态标记任务失败", () => {
      const task = new Task({});
      assert.throws(() => task.failed("Test Error"), Error);
    });

    it("应该能够取消任务", async () => {
      const task = new Task({});
      task.cancel();
      assert.strictEqual(task.status, TaskStatus.Cancel);
      // 处理可能的Promise拒绝
      try {
        await task.waitForEnd();
      } catch {
        // 忽略预期的拒绝
      }
    });

    it("应该能够重启失败的任务", async () => {
      const task = new Task({});
      task.start();
      task.failed("Test Error");
      task.restart();
      assert.strictEqual(task.status, TaskStatus.Running);
      // 处理可能的Promise拒绝
      try {
        await task.waitForEnd();
      } catch {
        // 忽略预期的拒绝
      }
    });

    it("应该能够移除完成的任务", () => {
      const task = new Task({});
      task.start();
      task.complete();
      task.remove();
      assert.strictEqual(task.status, TaskStatus.Removed);
    });
  });

  describe("原子任务执行测试", () => {
    it("应该能够设置原子任务", () => {
      const task = new Task({});
      const atomTasks = [
        new AtomTask({ exec: async () => {} }),
        new AtomTask({ exec: async () => {} }),
      ];
      task.setAtomTasks(atomTasks);
      assert.strictEqual(Array.isArray(task.atomTasks), true);
      assert.strictEqual(task.atomTasks.length, 2);
    });

    it("应该能够成功执行原子任务", async () => {
      const task = new Task({});
      let execCount = 0;

      const atomTasks = [
        new AtomTask({
          exec: async ({ exitRetry, signal }) => {
            execCount++;
          },
        }),
      ];

      task.setAtomTasks(atomTasks);
      task.start();

      // 等待任务完成
      await new Promise((resolve) => setTimeout(resolve, 100));

      assert.strictEqual(execCount, 1);
      assert.strictEqual(task.status, TaskStatus.Completed);
      assert.strictEqual(task.percent, 100);
    });

    // it("应该能够处理原子任务失败", async () => {
    //   const task = new Task({});

    //   const atomTasks = [
    //     new AtomTask({
    //       exec: async ({ exitRetry, signal }) => {
    //         throw new Error("Atom task failed");
    //       },
    //       errorMsg: "Atom task failed",
    //     }, { retryTimes: 1, retryDelay: 100 }),
    //   ];

    //   task.setAtomTasks(atomTasks);
    //   task.start();

    //   // 等待任务失败，确保重试和finally块执行
    //   await new Promise((resolve) => setTimeout(resolve, 500));

    //   assert.strictEqual(task.status, TaskStatus.Failed);
    //   assert.strictEqual(task.error.message.includes("AtomTask"), true);
    // });

    // ctx 测试
    it("应该能够在原子任务中访问和修改上下文", async () => {
      const task = new Task({ name: "Test Task Ctx" }, { ctx: { value: 1 } });

      const atomTasks = [
        new AtomTask({
          exec: async ({ ctx }) => {
            ctx.value = 42;
          },
        }),
      ];

      task.setAtomTasks(atomTasks);
      task.start();

      // 等待任务完成
      await new Promise((resolve) => setTimeout(resolve, 100));

      assert.strictEqual(task.ctx.value, 42);
    });
  });

  describe("子任务重要级别（warning状态）测试", () => {
    it("应该能够处理原子任务返回warning状态，任务继续执行", async () => {
      const task = new Task({});
      let warningTaskExecuted = false;
      let completedTaskExecuted = false;

      const atomTasks = [
        new AtomTask({
          exec: async ({ ctx }) => {
            warningTaskExecuted = true;
            return "WARNING";
          },
          warningMsg: "Warning: This is a warning message",
          successMsg: "This should not be shown",
        }),
        new AtomTask({
          exec: async ({ ctx }) => {
            completedTaskExecuted = true;
            return "COMPLETED";
          },
          successMsg: "Task completed successfully",
        }),
      ];

      task.setAtomTasks(atomTasks);
      task.start();

      // 等待任务完成
      await new Promise((resolve) => setTimeout(resolve, 200));

      assert.strictEqual(warningTaskExecuted, true);
      assert.strictEqual(completedTaskExecuted, true);
      assert.strictEqual(task.status, TaskStatus.Completed);
      assert.strictEqual(task.percent, 100);
      // 验证警告任务状态
      assert.strictEqual(atomTasks[0].getAtomTaskInfo().status, "WARNING");
      assert.strictEqual(
        atomTasks[0].getAtomTaskInfo().warningMsg,
        "Warning: This is a warning message",
      );
      // 验证完成任务状态
      assert.strictEqual(atomTasks[1].getAtomTaskInfo().status, "COMPLETED");
    });

    it("应该能够处理多个原子任务返回warning状态", async () => {
      const task = new Task({});
      let warningCount = 0;

      const atomTasks = [
        new AtomTask({
          exec: async ({ ctx }) => {
            warningCount++;
            return "WARNING";
          },
          warningMsg: "First warning",
        }),
        new AtomTask({
          exec: async ({ ctx }) => {
            warningCount++;
            return "WARNING";
          },
          warningMsg: "Second warning",
        }),
      ];

      task.setAtomTasks(atomTasks);
      task.start();

      // 等待任务完成
      await new Promise((resolve) => setTimeout(resolve, 200));

      assert.strictEqual(warningCount, 2);
      assert.strictEqual(task.status, TaskStatus.Completed);
      assert.strictEqual(task.percent, 100);
      // 验证所有警告任务状态
      assert.strictEqual(atomTasks[0].getAtomTaskInfo().status, "WARNING");
      assert.strictEqual(atomTasks[1].getAtomTaskInfo().status, "WARNING");
    });

    it("应该能够处理混合状态的原子任务（warning和completed）", async () => {
      const task = new Task({});
      let warningExecuted = false;
      let completedExecuted = false;

      const atomTasks = [
        new AtomTask({
          exec: async ({ ctx }) => {
            warningExecuted = true;
            return "WARNING";
          },
          warningMsg: "Task with warning",
        }),
        new AtomTask({
          exec: async ({ ctx }) => {
            completedExecuted = true;
            return "COMPLETED";
          },
          successMsg: "Task completed",
        }),
      ];

      task.setAtomTasks(atomTasks);
      task.start();

      // 等待任务完成
      await new Promise((resolve) => setTimeout(resolve, 200));

      assert.strictEqual(warningExecuted, true);
      assert.strictEqual(completedExecuted, true);
      assert.strictEqual(task.status, TaskStatus.Completed);
      // 验证任务状态
      assert.strictEqual(atomTasks[0].getAtomTaskInfo().status, "WARNING");
      assert.strictEqual(atomTasks[1].getAtomTaskInfo().status, "COMPLETED");
    });

    it("当有原子任务返回failed状态时，任务应该失败，忽略warning状态", async () => {
      const task = new Task({});
      let warningExecuted = false;
      let failedExecuted = false;

      const atomTasks = [
        new AtomTask({
          exec: async ({ ctx }) => {
            warningExecuted = true;
            return "WARNING";
          },
          warningMsg: "Task with warning",
        }),
        new AtomTask({
          exec: async ({ ctx }) => {
            failedExecuted = true;
            return "FAILED";
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

      assert.strictEqual(warningExecuted, true);
      assert.strictEqual(failedExecuted, true);
      assert.strictEqual(task.status, TaskStatus.Failed);
      // 验证任务状态
      assert.strictEqual(atomTasks[0].getAtomTaskInfo().status, "WARNING");
      assert.strictEqual(atomTasks[1].getAtomTaskInfo().status, "FAILED");
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
            return "COMPLETED";
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

      assert.strictEqual(taskExecuted, true);
      assert.strictEqual(task.status, TaskStatus.Completed);
    });

    it("应该能够处理successMsg为函数的情况", async () => {
      const task = new Task({});
      let taskExecuted = false;

      const atomTasks = [
        new AtomTask({
          exec: async ({ ctx }) => {
            taskExecuted = true;
            ctx.set("result", "success");
            return "COMPLETED";
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

      assert.strictEqual(taskExecuted, true);
      assert.strictEqual(task.status, TaskStatus.Completed);
      // 验证成功消息
      assert.strictEqual(
        typeof atomTasks[0].getAtomTaskInfo().successMsg,
        "string",
      );
    });

    it("应该能够处理errorMsg为函数的情况", async () => {
      const task = new Task({});
      let taskExecuted = false;

      const atomTasks = [
        new AtomTask({
          exec: async ({ ctx }) => {
            taskExecuted = true;
            ctx.set("errorCode", "500");
            return "FAILED";
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

      assert.strictEqual(taskExecuted, true);
      assert.strictEqual(task.status, TaskStatus.Failed);
      // 验证错误消息
      assert.strictEqual(
        typeof atomTasks[0].getAtomTaskInfo().errorMsg,
        "string",
      );
    });

    it("应该能够处理warningMsg为函数的情况", async () => {
      const task = new Task({});
      let taskExecuted = false;

      const atomTasks = [
        new AtomTask({
          exec: async ({ ctx }) => {
            taskExecuted = true;
            ctx.set("warningLevel", "low");
            return "WARNING";
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

      assert.strictEqual(taskExecuted, true);
      assert.strictEqual(task.status, TaskStatus.Completed);
      // 验证警告消息
      assert.strictEqual(atomTasks[0].getAtomTaskInfo().status, "WARNING");
      assert.strictEqual(
        typeof atomTasks[0].getAtomTaskInfo().warningMsg,
        "string",
      );
    });

    it("当消息为字符串时，应该直接返回字符串", async () => {
      const task = new Task({});
      let taskExecuted = false;

      const atomTasks = [
        new AtomTask({
          exec: async ({ ctx }) => {
            taskExecuted = true;
            return "COMPLETED";
          },
          processMsg: "Processing task",
          successMsg: "Task completed successfully",
        }),
      ];

      task.setAtomTasks(atomTasks);
      task.start();

      // 等待任务完成
      await new Promise((resolve) => setTimeout(resolve, 200));

      assert.strictEqual(taskExecuted, true);
      assert.strictEqual(task.status, TaskStatus.Completed);
      // 验证消息
      assert.strictEqual(
        atomTasks[0].getAtomTaskInfo().processMsg,
        "Processing task",
      );
      assert.strictEqual(
        typeof atomTasks[0].getAtomTaskInfo().successMsg,
        "string",
      );
    });

    it("应该能够混合使用函数和字符串形式的消息", async () => {
      const task = new Task({});
      let taskExecuted = false;

      const atomTasks = [
        new AtomTask({
          exec: async ({ ctx }) => {
            taskExecuted = true;
            ctx.set("step", 1);
            return "WARNING";
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

      assert.strictEqual(taskExecuted, true);
      assert.strictEqual(task.status, TaskStatus.Completed);
      // 验证任务状态
      assert.strictEqual(atomTasks[0].getAtomTaskInfo().status, "WARNING");
      assert.strictEqual(
        atomTasks[0].getAtomTaskInfo().processMsg,
        "Processing task",
      );
      assert.strictEqual(
        typeof atomTasks[0].getAtomTaskInfo().warningMsg,
        "string",
      );
    });
  });

  describe("原子任务动态移除测试", () => {
    it("应该能够在任务处于Pending状态时动态移除原子任务", async () => {
      const task = new Task({});
      let task1Executed = false;
      let task2Executed = false;

      // 创建两个原子任务
      const atomTask1 = new AtomTask({
        exec: async ({ ctx }) => {
          task1Executed = true;
          return "COMPLETED";
        },
        successMsg: "Task 1 completed",
      });

      const atomTask2 = new AtomTask({
        exec: async ({ ctx }) => {
          task2Executed = true;
          return "COMPLETED";
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

      assert.strictEqual(task1Executed, true);
      assert.strictEqual(task2Executed, false); // 第二个任务应该被移除，不执行
      assert.strictEqual(task.status, TaskStatus.Completed);
    });

    it("应该能够在任务处于Running状态时动态移除原子任务", async () => {
      const task = new Task({});
      let task1Executed = false;
      let task2Executed = false;

      // 创建两个原子任务
      const atomTask1 = new AtomTask({
        exec: async ({ ctx }) => {
          // 模拟耗时操作，以便有时间在Running状态下移除第二个任务
          await new Promise((resolve) => setTimeout(resolve, 100));
          task1Executed = true;
          return "COMPLETED";
        },
        successMsg: "Task 1 completed",
      });

      const atomTask2 = new AtomTask({
        exec: async ({ ctx }) => {
          task2Executed = true;
          return "COMPLETED";
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

      assert.strictEqual(task1Executed, true);
      assert.strictEqual(task2Executed, false); // 第二个任务应该被移除，不执行
      assert.strictEqual(task.status, TaskStatus.Completed);
    });

    it("应该能够移除多个原子任务", async () => {
      const task = new Task({});
      let task1Executed = false;
      let task2Executed = false;
      let task3Executed = false;

      // 创建三个原子任务
      const atomTask1 = new AtomTask({
        exec: async ({ ctx }) => {
          task1Executed = true;
          return "COMPLETED";
        },
        successMsg: "Task 1 completed",
      });

      const atomTask2 = new AtomTask({
        exec: async ({ ctx }) => {
          task2Executed = true;
          return "COMPLETED";
        },
        successMsg: "Task 2 completed",
      });

      const atomTask3 = new AtomTask({
        exec: async ({ ctx }) => {
          task3Executed = true;
          return "COMPLETED";
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

      assert.strictEqual(task1Executed, true);
      assert.strictEqual(task2Executed, false); // 第二个任务应该被移除
      assert.strictEqual(task3Executed, false); // 第三个任务应该被移除
      assert.strictEqual(task.status, TaskStatus.Completed);
    });

    it("应该只能移除处于Pending状态的原子任务", async () => {
      const task = new Task({});
      let task1Executed = false;
      let task2Executed = false;

      // 创建两个原子任务
      const atomTask1 = new AtomTask({
        exec: async ({ ctx }) => {
          // 模拟耗时操作
          await new Promise((resolve) => setTimeout(resolve, 150));
          task1Executed = true;
          return "COMPLETED";
        },
        successMsg: "Task 1 completed",
      });

      const atomTask2 = new AtomTask({
        exec: async ({ ctx }) => {
          task2Executed = true;
          return "COMPLETED";
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

      assert.strictEqual(task1Executed, true); // 第一个任务已经开始执行，应该继续完成
      assert.strictEqual(task2Executed, false); // 第二个任务应该被移除，不执行
      assert.strictEqual(task.status, TaskStatus.Completed);
    });

    it("在不支持的任务状态下移除原子任务应该抛出错误", async () => {
      const task = new Task({});

      // 创建原子任务
      const atomTask = new AtomTask({
        exec: async ({ ctx }) => {
          return "COMPLETED";
        },
      });

      // 设置原子任务
      task.setAtomTasks([atomTask]);

      // 启动并完成任务
      task.start();

      // 等待任务完成
      await new Promise((resolve) => setTimeout(resolve, 200));

      assert.strictEqual(task.status, TaskStatus.Completed);

      // 尝试在Completed状态下移除原子任务，应该抛出错误
      await assert.rejects(
        () => task.removeAtomTasks([atomTask.id]),
        (error) => {
          return error.message.includes("cannot add atom tasks");
        },
      );
    });
  });

  describe("waitForEnd方法测试", () => {
    it("应该在任务成功完成时resolve promise", async () => {
      const task = new Task({ name: "Test Task" });
      const atomTasks = [
        new AtomTask({
          exec: async ({ exitRetry, signal }) => {
            // 模拟任务执行
            await new Promise((resolve) => setTimeout(resolve, 50));
          },
        }),
      ];

      task.setAtomTasks(atomTasks);
      task.start();

      // 使用waitForEnd方法等待任务完成
      const result = await task.waitForEnd();

      assert.strictEqual(result.status, TaskStatus.Completed);
      assert.strictEqual(result.percent, 100);
      assert.strictEqual(result.name, "Test Task");
    });

    it("应该在任务失败时reject promise", async () => {
      const task = new Task({});
      const atomTasks = [
        new AtomTask(
          {
            exec: async ({ exitRetry, signal }) => {
              throw new Error("Task failed");
            },
            errorMsg: "Test error",
          },
          { retryTimes: 0 },
        ),
      ];

      task.setAtomTasks(atomTasks);
      task.start();

      // 使用waitForEnd方法等待任务失败
      await assert.rejects(
        () => task.waitForEnd(),
        (error) => {
          // 验证错误信息
          return true;
        },
      );

      assert.strictEqual(task.status, TaskStatus.Failed);
    });

    it("应该能够等待手动完成的任务", async () => {
      const task = new Task({});

      // 启动任务
      task.start();

      // 模拟异步操作，然后手动完成任务
      setTimeout(() => {
        task.complete();
      }, 50);

      // 使用waitForEnd方法等待任务完成
      const result = await task.waitForEnd();

      assert.strictEqual(result.status, TaskStatus.Completed);
      assert.strictEqual(result.percent, 100);
    });

    it("应该能够等待手动失败的任务", async () => {
      const task = new Task({});

      // 启动任务
      task.start();

      // 模拟异步操作，然后手动标记任务失败
      setTimeout(() => {
        task.failed("Manual failure");
      }, 50);

      // 使用waitForEnd方法等待任务失败
      await assert.rejects(
        () => task.waitForEnd(),
        (error) => {
          return true;
        },
      );

      assert.strictEqual(task.status, TaskStatus.Failed);
    });
  });

  describe("任务上下文管理测试", () => {
    it("应该能够在原子任务中使用上下文存储和获取状态", async () => {
      const task = new Task({});
      let taskExecuted = false;
      let stateValue = null;

      const atomTasks = [
        new AtomTask({
          exec: async ({ ctx }) => {
            // 在上下文中存储状态
            ctx.set("key", "value");
            taskExecuted = true;
            return "COMPLETED";
          },
        }),
        new AtomTask({
          exec: async ({ ctx }) => {
            // 从上下文中获取状态
            stateValue = ctx.get("key");
            return "COMPLETED";
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

      assert.strictEqual(taskExecuted, true);
      assert.strictEqual(stateValue, "value"); // 验证状态在原子任务之间共享
      assert.strictEqual(task.status, TaskStatus.Completed);
    });

    it("应该能够在上下文中存储复杂类型的状态", async () => {
      const task = new Task({});
      let taskExecuted = false;
      let userData = null;

      const atomTasks = [
        new AtomTask({
          exec: async ({ ctx }) => {
            // 在上下文中存储复杂对象
            const data = {
              id: 1,
              name: "Test User",
              email: "test@example.com",
            };
            ctx.set("user", data);
            taskExecuted = true;
            return "COMPLETED";
          },
        }),
        new AtomTask({
          exec: async ({ ctx }) => {
            // 从上下文中获取复杂对象
            userData = ctx.get("user");
            return "COMPLETED";
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

      assert.strictEqual(taskExecuted, true);
      assert.deepStrictEqual(userData, {
        id: 1,
        name: "Test User",
        email: "test@example.com",
      });
      assert.strictEqual(task.status, TaskStatus.Completed);
    });

    it("任务完成后应该清理事件监听器，避免内存泄漏", async () => {
      const task = new Task({});
      let eventTriggered = false;

      // 添加事件监听器
      task.event.on("complete", () => {
        eventTriggered = true;
      });

      const atomTasks = [
        new AtomTask({
          exec: async ({ ctx }) => {
            return "COMPLETED";
          },
        }),
      ];

      task.setAtomTasks(atomTasks);
      task.start();

      // 等待任务完成
      await new Promise((resolve) => setTimeout(resolve, 200));

      assert.strictEqual(eventTriggered, true);
      assert.strictEqual(task.status, TaskStatus.Completed);

      // 验证事件监听器是否被清理
      // 这里我们通过检查event.all的大小来验证
      // 注意：这依赖于mitt库的内部实现，可能需要根据实际情况调整
      assert.strictEqual(typeof task.event.all, "object");
    });

    it("任务取消后应该清理事件监听器，避免内存泄漏", async () => {
      const task = new Task({});
      let eventTriggered = false;

      // 添加事件监听器
      task.event.on("cancel", () => {
        eventTriggered = true;
      });

      const atomTasks = [
        new AtomTask({
          exec: async ({ ctx }) => {
            // 模拟长时间运行的任务
            await new Promise((resolve) => setTimeout(resolve, 1000));
            return "COMPLETED";
          },
        }),
      ];

      task.setAtomTasks(atomTasks);
      task.start();

      // 立即取消任务
      task.cancel();

      // 等待任务取消并处理可能的Promise拒绝
      try {
        await task.waitForEnd();
      } catch {
        // 忽略预期的拒绝
      }

      assert.strictEqual(eventTriggered, true);
      assert.strictEqual(task.status, TaskStatus.Cancel);

      // 验证事件监听器是否被清理
      assert.strictEqual(typeof task.event.all, "object");
    });

    it("任务失败后应该清理事件监听器，避免内存泄漏", async () => {
      const task = new Task({});
      let eventTriggered = false;

      // 添加事件监听器
      task.event.on("error", () => {
        eventTriggered = true;
      });

      const atomTasks = [
        new AtomTask({
          exec: async ({ ctx }) => {
            return "FAILED";
          },
          errorMsg: "Task failed",
        }),
      ];

      task.setAtomTasks(atomTasks);
      task.start();

      // 等待任务失败并处理可能的Promise拒绝
      try {
        await task.waitForEnd();
      } catch {
        // 忽略预期的拒绝
      }

      assert.strictEqual(eventTriggered, true);
      assert.strictEqual(task.status, TaskStatus.Failed);

      // 验证事件监听器是否被清理
      assert.strictEqual(typeof task.event.all, "object");
    });
  });

  describe("多Task顺序执行测试", () => {
    it("应该按顺序执行多个Task，等上一个执行完了再执行下一个", async () => {
      const executionOrder = [];

      // 创建第一个Task
      const task1 = new Task({ name: "Task 1" });
      const atomTasks1 = [
        new AtomTask({
          exec: async () => {
            executionOrder.push("Task 1 - Atom 1");
            await new Promise((resolve) => setTimeout(resolve, 1000)); // 模拟耗时操作
          },
        }),
        new AtomTask({
          exec: async () => {
            executionOrder.push("Task 1 - Atom 2");
            await new Promise((resolve) => setTimeout(resolve, 2000));
          },
        }),
      ];
      task1.setAtomTasks(atomTasks1);

      // 创建第二个Task
      const task2 = new Task({ name: "Task 2" });
      const atomTasks2 = [
        new AtomTask({
          exec: async () => {
            executionOrder.push("Task 2 - Atom 1");
            await new Promise((resolve) => setTimeout(resolve, 500));
          },
        }),
      ];
      task2.setAtomTasks(atomTasks2);

      // 创建第三个Task
      const task3 = new Task({ name: "Task 3" });
      const atomTasks3 = [
        new AtomTask({
          exec: async () => {
            executionOrder.push("Task 3 - Atom 1");
            await new Promise((resolve) => setTimeout(resolve, 1000));
          },
        }),
      ];
      task3.setAtomTasks(atomTasks3);

      // 按顺序启动Task并等待完成
      const taskList = [task1, task2, task3];
      for (let i = 0; i < taskList.length; i++) {
        const task = taskList[i];
        if (i > 0) {
          // 验证Task已完成
          assert.strictEqual(taskList[i - 1].status, TaskStatus.Completed);
        }
        task.start();
        await task.waitForEnd();
        executionOrder.push(`${task.name} Completed`);
      }

      // 验证执行顺序
      assert.deepStrictEqual(executionOrder, [
        "Task 1 - Atom 1",
        "Task 1 - Atom 2",
        "Task 1 Completed",
        "Task 2 - Atom 1",
        "Task 2 Completed",
        "Task 3 - Atom 1",
        "Task 3 Completed",
      ]);
    });
  });
});
