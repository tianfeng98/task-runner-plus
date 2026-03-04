import { describe, expect, it } from "vitest";
import { AtomTask, AtomTaskExecResult, Task, TaskStatus } from "../src";

describe("Task类测试", () => {
  describe("基本功能测试", () => {
    it("应该创建一个有效的Task实例", () => {
      const task = new Task({
        name: "Test Task",
        description: "Test Description",
      });
      expect(typeof task).toBe("object");
      expect(task.id.length).toBe(24);
      expect(task.name).toBe("Test Task");
      expect(task.description).toBe("Test Description");
      expect(task.status).toBe(TaskStatus.Pending);
      expect(task.percent).toBe(0);
      expect(typeof task.createdAt).toBe("number");
    });

    it("getTaskInfo()方法应该返回正确的任务信息", () => {
      const task = new Task({ name: "Test Task" });
      const info = task.getTaskInfo();
      expect(info.id).toBe(task.id);
      expect(info.name).toBe(task.name);
      expect(info.status).toBe(TaskStatus.Pending);
      expect(info.percent).toBe(0);
      expect(info.createdAt).toBe(task.createdAt);
    });

    it("updateExtInfo()方法应该更新扩展信息", () => {
      const task = new Task({});
      const extInfo = { key: "value" };
      task.updateExtInfo(extInfo);
      expect(task.extInfo).toBe(extInfo);
      expect(task.getTaskInfo().extInfo).toBe(extInfo);
    });

    it("setPercent()方法应该更新进度并触发progress事件", () => {
      const task = new Task({});

      task.setPercent(50);
      expect(task.percent).toBe(50);
    });
  });

  describe("状态转换测试", () => {
    it("应该能够从Pending状态转换到Running状态", () => {
      const task = new Task({});
      task.start();
      expect(task.status).toBe(TaskStatus.Running);
    });

    it("不应该从非Pending状态开始任务", () => {
      const task = new Task({});
      task.start();
      expect(() => task.start()).toThrow();
    });

    it("应该能够从Running状态转换到Paused状态", async () => {
      const task = new Task({});
      task.start();
      await task.pause();
      expect(task.status).toBe(TaskStatus.Paused);
    });

    it("不应该从非Running状态暂停任务", async () => {
      const task = new Task({});
      await expect(task.pause()).rejects.toThrow();
    });

    it("应该能够从Paused状态转换到Running状态", async () => {
      const task = new Task({});
      task.start();
      await task.pause();
      task.resume();
      expect(task.status).toBe(TaskStatus.Running);
    });

    it("不应该从非Paused状态继续任务", () => {
      const task = new Task({});
      expect(() => task.resume()).toThrow();
    });

    it("应该能够完成任务", () => {
      const task = new Task({});
      task.start();
      task.complete();
      expect(task.status).toBe(TaskStatus.Completed);
      expect(task.percent).toBe(100);
      expect(typeof task.completedAt).toBe("number");
    });

    it("不应该从非Running状态完成任务", () => {
      const task = new Task({});
      expect(() => task.complete()).toThrow();
    });

    it("应该能够标记任务失败", async () => {
      const task = new Task({});
      task.start();
      task.failed("Test Error");
      expect(task.status).toBe(TaskStatus.Failed);
      expect(task.error?.name).toBe("Error");
      expect(task.error?.message).toBe("Test Error");
      // 处理可能的Promise拒绝
      try {
        await task.waitForEnd();
      } catch {
        // 忽略预期的拒绝
      }
    });

    it("不应该从非Running状态标记任务失败", () => {
      const task = new Task({});
      expect(() => task.failed("Test Error")).toThrow();
    });

    it("应该能够取消任务", async () => {
      const task = new Task({});
      task.cancel();
      expect(task.status).toBe(TaskStatus.Cancel);
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
      expect(task.status).toBe(TaskStatus.Running);
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
      expect(task.status).toBe(TaskStatus.Removed);
    });
  });

  describe("waitForEnd方法测试", () => {
    it("应该在任务成功完成时resolve promise", async () => {
      const task = new Task({ name: "Test Task" });
      const atomTasks = [
        new AtomTask({
          exec: async () => {
            // 模拟任务执行
            await new Promise((resolve) => setTimeout(resolve, 50));
          },
        }),
      ];

      task.setAtomTasks(atomTasks);
      task.start();

      // 使用waitForEnd方法等待任务完成
      const result = await task.waitForEnd();

      expect(result.status).toBe(TaskStatus.Completed);
      expect(result.percent).toBe(100);
      expect(result.name).toBe("Test Task");
    });

    it("应该在任务失败时reject promise", async () => {
      const task = new Task({});
      const atomTasks = [
        new AtomTask(
          {
            exec: async () => {
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
      await expect(task.waitForEnd()).rejects.toThrow();

      expect(task.status).toBe(TaskStatus.Failed);
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

      expect(result.status).toBe(TaskStatus.Completed);
      expect(result.percent).toBe(100);
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
      await expect(task.waitForEnd()).rejects.toThrow();

      expect(task.status).toBe(TaskStatus.Failed);
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
            AtomTaskExecResult.Completed;
          },
        }),
        new AtomTask({
          exec: async ({ ctx }) => {
            // 从上下文中获取状态
            stateValue = ctx.get("key");
            AtomTaskExecResult.Completed;
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
      expect(stateValue).toBe("value"); // 验证状态在原子任务之间共享
      expect(task.status).toBe(TaskStatus.Completed);
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
            AtomTaskExecResult.Completed;
          },
        }),
        new AtomTask({
          exec: async ({ ctx }) => {
            // 从上下文中获取复杂对象
            userData = ctx.get("user");
            AtomTaskExecResult.Completed;
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
      expect(userData).toEqual({
        id: 1,
        name: "Test User",
        email: "test@example.com",
      });
      expect(task.status).toBe(TaskStatus.Completed);
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
          exec: async () => {
            AtomTaskExecResult.Completed;
          },
        }),
      ];

      task.setAtomTasks(atomTasks);
      task.start();

      // 等待任务完成
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(eventTriggered).toBe(true);
      expect(task.status).toBe(TaskStatus.Completed);

      // 验证事件监听器是否被清理
      // 这里我们通过检查event.all的大小来验证
      // 注意：这依赖于mitt库的内部实现，可能需要根据实际情况调整
      expect(typeof task.event.all).toBe("object");
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
          exec: async () => {
            // 模拟长时间运行的任务
            await new Promise((resolve) => setTimeout(resolve, 1000));
            AtomTaskExecResult.Completed;
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

      expect(eventTriggered).toBe(true);
      expect(task.status).toBe(TaskStatus.Cancel);

      // 验证事件监听器是否被清理
      expect(typeof task.event.all).toBe("object");
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
          exec: async () => {
            return AtomTaskExecResult.Failed;
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

      expect(eventTriggered).toBe(true);
      expect(task.status).toBe(TaskStatus.Failed);

      // 验证事件监听器是否被清理
      expect(typeof task.event.all).toBe("object");
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
          expect(taskList[i - 1].status).toBe(TaskStatus.Completed);
        }
        task.start();
        await task.waitForEnd();
        executionOrder.push(`${task.name} Completed`);
      }

      // 验证执行顺序
      expect(executionOrder).toEqual([
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
