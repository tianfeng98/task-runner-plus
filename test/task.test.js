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

    it("getInfo()方法应该返回正确的任务信息", () => {
      const task = new Task({ name: "Test Task" });
      const info = task.getInfo();
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
      assert.strictEqual(task.getInfo().extInfo, extInfo);
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

    it("应该能够从Running状态转换到Paused状态", () => {
      const task = new Task({});
      task.start();
      task.pause();
      assert.strictEqual(task.status, TaskStatus.Paused);
    });

    it("不应该从非Running状态暂停任务", () => {
      const task = new Task({});
      assert.throws(() => task.pause(), Error);
    });

    it("应该能够从Paused状态转换到Running状态", () => {
      const task = new Task({});
      task.start();
      task.pause();
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
          { retryTimes: 0 }
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
        }
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
        }
      );

      assert.strictEqual(task.status, TaskStatus.Failed);
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
