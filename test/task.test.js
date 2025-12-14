import assert from "node:assert";
import { describe, it } from "node:test";
import { Task, TaskStatus } from "../dist/es/index.js";

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

    it("setPercent()方法应该更新进度并触发percent事件", (t) => {
      const task = new Task({});
      let eventEmitted = false;
      let emittedPercent = 0;

      // 模拟事件监听
      task.event = {
        emit: (event, data) => {
          if (event === "percent") {
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

    it("应该能够标记任务失败", () => {
      const task = new Task({});
      task.start();
      task.failed(new Error("Test Error"));
      assert.strictEqual(task.status, TaskStatus.Failed);
      assert.strictEqual(task.error.name, "Error");
      assert.strictEqual(task.error.message, "Test Error");
    });

    it("不应该从非Running状态标记任务失败", () => {
      const task = new Task({});
      assert.throws(() => task.failed(new Error("Test Error")), Error);
    });

    it("应该能够取消任务", () => {
      const task = new Task({});
      task.cancel();
      assert.strictEqual(task.status, TaskStatus.Cancel);
    });

    it("应该能够重启失败的任务", () => {
      const task = new Task({});
      task.start();
      task.failed(new Error("Test Error"));
      task.restart();
      assert.strictEqual(task.status, TaskStatus.Running);
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
      const atomTasks = [[async () => {}], [async () => {}]];
      task.setAtomTasks(atomTasks);
      assert.strictEqual(Array.isArray(task.atomTasks), true);
      assert.strictEqual(task.atomTasks.length, 2);
    });

    it("应该能够成功执行原子任务", async () => {
      const task = new Task({});
      let execCount = 0;

      const atomTasks = [
        [
          async ({ exitRetry, signal }) => {
            execCount++;
          },
        ],
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
    //     [
    //       async ({ exitRetry, signal }) => {
    //         throw new Error("Atom task failed");
    //       },
    //       { retryTimes: 1, retryDelay: 100 }, // 设置较小的重试次数和延迟
    //     ],
    //   ];

    //   task.setAtomTasks(atomTasks);
    //   task.start();

    //   // 等待任务失败，确保重试和finally块执行
    //   await new Promise((resolve) => setTimeout(resolve, 500));

    //   assert.strictEqual(task.status, TaskStatus.Failed);
    //   assert.strictEqual(task.error.message.includes("AtomTask"), true);
    // });
  });
});
