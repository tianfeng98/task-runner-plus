import mitt from "mitt";
import plimit, { type LimitFunction } from "p-limit";
import { uid, withResolvers } from "radashi";
import {
  AbstractAtomTask,
  AbstractTask,
  AbstractTaskCtx,
  AtomTaskStatus,
  TaskStatus,
  type Ctx,
  type TaskError,
  type TaskEvent,
  type TaskInfo,
  type TaskOptions,
} from "../types";
import { promiseFor } from "../utils";
import { TaskCtx } from "./ctx";

// 创建只允许通过 set 方法修改的代理
function createReadOnlyCtxProxy<T extends Record<string, any>>(
  sourceCtx: AbstractTaskCtx<T>,
): AbstractTaskCtx<T> {
  return new Proxy(sourceCtx, {
    set(_, prop, __) {
      // 禁止直接赋值
      console.warn(
        `Direct assignment to ctx.${String(prop)} is not allowed. Use ctx.set() instead.`,
      );
      return false;
    },
    get(target, prop) {
      // 允许访问所有方法和属性
      const value = Reflect.get(target, prop);
      // 如果是函数，绑定正确的 this
      if (typeof value === "function") {
        return value.bind(target);
      }
      return value;
    },
  });
}

export class Task<T extends Ctx, ExtInfo = any> extends AbstractTask<
  T,
  ExtInfo
> {
  id: string;
  name?: string;
  description?: string;
  createdAt: number;
  completedAt?: number;
  status: TaskStatus;
  percent: number;
  extInfo?: ExtInfo;
  error?: TaskError;
  taskMsg?: string;
  event = mitt<TaskEvent<T, ExtInfo>>();
  protected readonly ctx: AbstractTaskCtx<T>;
  protected atomTasks: AbstractAtomTask<T>[] = [];
  protected limit: LimitFunction;

  // 使用promise
  protected promise: Promise<TaskInfo<T, ExtInfo>>;
  protected resolve?: (value: TaskInfo<T, ExtInfo>) => void;
  protected reject?: (reason?: any) => void;

  constructor(
    {
      id = uid(24),
      name,
      description,
      createdAt = Date.now(),
      completedAt,
      status = TaskStatus.Pending,
      percent = 0,
      extInfo,
      error,
    }: Partial<Omit<TaskInfo<T, ExtInfo>, "atomTaskInfoList">> = {},
    { concurrency = 1, defaultCtxData, sharedCtx }: TaskOptions<T> = {},
  ) {
    super();
    this.id = id;
    this.name = name;
    this.description = description;
    this.status = status;
    this.percent = percent;
    this.createdAt = createdAt;
    this.completedAt = completedAt;
    this.extInfo = extInfo;
    this.error = error;
    if (sharedCtx) {
      this.ctx = createReadOnlyCtxProxy(sharedCtx);
    } else {
      this.ctx = new TaskCtx({
        addAtomTasks: this.addAtomTasks.bind(this),
        removeAtomTasks: this.removeAtomTasks.bind(this),
        defaultData: defaultCtxData,
      });
    }
    this.limit = plimit(concurrency);
    const { promise, resolve, reject } = withResolvers<TaskInfo<T, ExtInfo>>();
    this.promise = promise;
    this.resolve = resolve;
    this.reject = reject;
  }

  private static TaskMap = new Map<string, Task<any, any>>();

  static getTask<T extends Ctx, ExtInfo = any>(id: string) {
    return this.TaskMap.get(id) as Task<T, ExtInfo>;
  }

  public getTaskInfo(): TaskInfo<T, ExtInfo> {
    const {
      id,
      name,
      status,
      percent,
      createdAt,
      completedAt,
      extInfo,
      error,
      taskMsg,
      atomTasks,
      ctx,
    } = this;

    return {
      id,
      name,
      status,
      percent,
      createdAt,
      completedAt,
      extInfo,
      error,
      taskMsg,
      atomTaskInfoList: atomTasks.map((d) => d.getAtomTaskInfo()),
      state: ctx.getAllData(),
    };
  }

  public setAtomTasks(atomTasks: AbstractAtomTask<T>[]) {
    if (!Array.isArray(atomTasks)) {
      throw new Error("atomTasks must be an array");
    }
    this.atomTasks = atomTasks;
  }

  public async addAtomTasks(atomTasks: AbstractAtomTask<T>[]) {
    switch (this.status) {
      case TaskStatus.Pending:
        this.atomTasks.push(...atomTasks);
        break;
      case TaskStatus.Running:
        if (await this.pause()) {
          this.atomTasks.push(...atomTasks);
          this.resume();
        }
        break;
      default:
        throw new Error(`Task status ${this.status} cannot add atom tasks`);
    }
  }

  /**
   * 删除原子任务，仅支持删除pending状态的原子任务
   * @param taskIds 原子任务id列表
   */
  public async removeAtomTasks(taskIds: string[]) {
    const filterAtomTasks = this.atomTasks.filter((d) => {
      // 如果任务ID不在要移除的列表中，保留它
      if (!taskIds.includes(d.id)) {
        return true;
      }
      // 如果任务ID在要移除的列表中，但状态不是Pending，也保留它
      if (d.status !== AtomTaskStatus.Pending) {
        return true;
      }
      // 其他情况（任务ID在要移除的列表中且状态是Pending），移除它
      return false;
    });
    switch (this.status) {
      case TaskStatus.Pending:
        this.setAtomTasks(filterAtomTasks);
        break;
      case TaskStatus.Running:
        if (await this.pause()) {
          this.setAtomTasks(filterAtomTasks);
          this.resume();
        }
        break;
      default:
        throw new Error(`Task status ${this.status} cannot add atom tasks`);
    }
  }

  public updateExtInfo(info: ExtInfo) {
    this.extInfo = info;
  }

  public setPercent(percent: number) {
    this.percent = percent;
    this.event.emit("progress", { percent, taskInfo: this.getTaskInfo() });
  }

  public setTaskMsg(msg?: string) {
    this.taskMsg = msg;
  }

  public start() {
    if (this.status !== TaskStatus.Pending) {
      throw new Error("Task is not pending, cannot start");
    }
    this.status = TaskStatus.Running;
    this.event.emit("start", { taskInfo: this.getTaskInfo() });
    return this.runAtomTasks();
  }

  public async pause() {
    if (this.status !== TaskStatus.Running) {
      throw new Error("Task is not running, cannot pause");
    }
    this.status = TaskStatus.Pausing;
    this.limit.clearQueue();
    return promiseFor(
      () => this.limit.activeCount < 1,
      () => true,
      {
        timeout: 60 * 1000,
      },
    ).finally(() => {
      this.status = TaskStatus.Paused;
      this.event.emit("pause", { taskInfo: this.getTaskInfo() });
    });
  }

  public resume() {
    if (this.status !== TaskStatus.Paused) {
      throw new Error("Task is not paused, cannot resume");
    }
    this.status = TaskStatus.Running;
    this.event.emit("resume", { taskInfo: this.getTaskInfo() });
    return this.runAtomTasks();
  }

  public cancel() {
    const validStatus: TaskStatus[] = [
      TaskStatus.Pending,
      TaskStatus.Running,
      TaskStatus.Paused,
    ];
    if (!validStatus.includes(this.status)) {
      throw new Error(
        `Task is not in a valid status to cancel: ${this.status}`,
      );
    }
    this.limit.clearQueue();
    this.status = TaskStatus.Cancel;
    this.event.emit("cancel", { taskInfo: this.getTaskInfo() });
    this.reject?.("cancel");
  }

  public restart() {
    const validStatus: TaskStatus[] = [TaskStatus.Failed, TaskStatus.Cancel];
    if (!validStatus.includes(this.status)) {
      throw new Error(
        `Task is not in a valid status to restart: ${this.status}`,
      );
    }
    this.status = TaskStatus.Running;
    this.event.emit("restart", { taskInfo: this.getTaskInfo() });
    return this.runAtomTasks({ restart: true });
  }

  public failed(error: Error | string) {
    if (this.status !== TaskStatus.Running) {
      throw new Error("Task is not running, cannot failed");
    }
    this.status = TaskStatus.Failed;
    const errObj = typeof error === "string" ? new Error(error) : error;
    this.error = { name: errObj.name, message: errObj.message };
    this.taskMsg = errObj.message;
    this.event.emit("error", {
      error: errObj,
      taskInfo: this.getTaskInfo(),
    });
    this.clear();
    this.reject?.("error");
  }

  public complete() {
    if (this.status !== TaskStatus.Running) {
      throw new Error("Task is not running, cannot complete");
    }
    this.percent = 100;
    this.status = TaskStatus.Completed;
    this.completedAt = Date.now();
    this.event.emit("complete", { taskInfo: this.getTaskInfo() });
    this.clear();
    this.resolve?.(this.getTaskInfo());
  }

  public remove() {
    const validStatus: TaskStatus[] = [
      TaskStatus.Cancel,
      TaskStatus.Failed,
      TaskStatus.Completed,
    ];
    if (!validStatus.includes(this.status)) {
      throw new Error(
        `Task is not in a valid status to remove: ${this.status}`,
      );
    }
    this.status = TaskStatus.Removed;
    Task.TaskMap.delete(this.id);
    this.event.emit("remove", { taskInfo: this.getTaskInfo() });
    this.clear();
  }

  public waitForEnd() {
    return this.promise;
  }

  protected clear() {
    if (this.limit.activeCount > 0 || this.limit.pendingCount > 0) {
      this.limit.clearQueue();
    }
    /**
     * 先执行事件触发和监听，再清除
     */
    globalThis.setTimeout(() => {
      this.event.all.clear();
    }, 1000);
  }

  protected async runAtomTasks({
    restart = false,
  }: {
    restart?: boolean;
  } = {}) {
    const atomTasksCount = this.atomTasks.length;
    if (atomTasksCount > 0) {
      this.setTaskMsg(this.atomTasks.at(0)?.getAtomTaskInfo().processMsg);
      const atomTasks = restart
        ? this.atomTasks
        : this.atomTasks.filter(
            (task) => task.getAtomTaskInfo().status === AtomTaskStatus.Pending,
          );
      const input = atomTasks.map((atomTask) =>
        this.limit(() =>
          atomTask
            .run(this.ctx)
            .then(({ status, errorMsg, successMsg }) => {
              switch (status) {
                case AtomTaskStatus.Completed:
                  this.setTaskMsg(successMsg);
                  break;
                case AtomTaskStatus.Failed:
                  this.setTaskMsg(errorMsg);
                  this.failed({
                    name: "AtomTask failed",
                    message: errorMsg ?? "Failed",
                  });
                  break;
                default:
                  break;
              }
            })
            .finally(() => {
              /**
               * @TODO 动态增加任务时，会导致任务进度计算错误
               */
              const finishCount = atomTasks.filter(
                (task) =>
                  task.getAtomTaskInfo().status === AtomTaskStatus.Completed,
              ).length;
              this.setPercent((finishCount / atomTasksCount) * 100);
            }),
        ),
      );
      return Promise.all(input).finally(() => {
        const failedTasks = atomTasks.filter(
          (task) => task.getAtomTaskInfo().status === AtomTaskStatus.Failed,
        );
        if (this.status === TaskStatus.Running) {
          if (failedTasks.length === 0) {
            this.complete();
          } else {
            this.failed(
              failedTasks
                .map((task) => task.getAtomTaskInfo().errorMsg)
                .join(", "),
            );
          }
        }
      });
    }
    return [];
  }
}
