import mitt, { type EventType } from "mitt";
import plimit, { type LimitFunction } from "p-limit";
import { uid } from "radashi";
import { promiseFor } from "../utils";
import {
  AtomTask,
  AtomTaskStatus,
  type AtomTaskInfo,
  type TaskCtx,
} from "./atom-task";

export enum TaskStatus {
  Pending = "PENDING",
  Running = "RUNNING",
  // 暂停中状态，暂停状态需要等待正在执行的原子任务完成
  Pausing = "Pausing",
  Paused = "PAUSED",
  Cancel = "CANCEL",
  Completed = "COMPLETED",
  Failed = "FAILED",
  Removed = "REMOVED",
}

export interface TaskError {
  name: string;
  message: string;
}

export interface TaskInfo<ExtInfo = any> {
  id: string;
  name?: string;
  /**
   * 任务描述
   */
  description?: string;
  createdAt: number;
  completedAt?: number;
  status: TaskStatus;
  percent: number;
  extInfo?: ExtInfo;
  /**
   * 任务执行过程中遇到的错误信息
   */
  error?: TaskError;
  /**
   * 任务执行过程信息
   */
  taskMsg?: string;
  atomTaskInfoList: AtomTaskInfo[];
}

export interface TaskEvent<ExtInfo = any> extends Record<EventType, any> {
  progress: { percent: number; taskInfo: TaskInfo<ExtInfo> };
  complete: { taskInfo: TaskInfo<ExtInfo> };
  remove: { taskInfo: TaskInfo<ExtInfo> };
  error: { taskInfo: TaskInfo<ExtInfo>; error: Error };
  start: { taskInfo: TaskInfo<ExtInfo> };
  pause: { taskInfo: TaskInfo<ExtInfo> };
  resume: { taskInfo: TaskInfo<ExtInfo> };
  cancel: { taskInfo: TaskInfo<ExtInfo> };
  restart: { taskInfo: TaskInfo<ExtInfo> };
}

export interface TaskOptions<Ctx extends Record<string, any> = any> {
  concurrency?: number;
  ctx?: Ctx;
}

export class Task<Ctx extends Record<string, any> = any, ExtInfo = any> {
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
  event = mitt<TaskEvent>();
  private ctx: TaskCtx<Ctx>;
  private atomTasks: AtomTask<Ctx>[] = [];
  private limit: LimitFunction;
  private promise: Promise<TaskInfo<ExtInfo>>;
  private resolve?: (value: TaskInfo<ExtInfo>) => void;
  private reject?: (reason?: any) => void;

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
    }: Partial<Omit<TaskInfo, "atomTaskInfoList">> = {},
    { concurrency = 1, ctx = {} as Ctx }: TaskOptions<Ctx> = {}
  ) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.status = status;
    this.percent = percent;
    this.createdAt = createdAt;
    this.completedAt = completedAt;
    this.extInfo = extInfo;
    this.error = error;
    this.ctx = { ...ctx, addAtomTasks: this.addAtomTasks.bind(this) };
    this.limit = plimit(concurrency);
    this.promise = new Promise<TaskInfo<ExtInfo>>((res, rej) => {
      this.resolve = res;
      this.reject = rej;
    });
  }

  private static TaskMap = new Map<string, Task>();

  static getTask(id: string) {
    return this.TaskMap.get(id);
  }

  public getCtx(): TaskCtx<Ctx> {
    return this.ctx;
  }

  public getInfo(): TaskInfo<ExtInfo> {
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
    };
  }

  public setAtomTasks(atomTasks: AtomTask<Ctx>[]) {
    if (!Array.isArray(atomTasks)) {
      throw new Error("atomTasks must be an array");
    }
    this.atomTasks = atomTasks;
  }

  public addAtomTasks(atomTasks: AtomTask<Ctx>[]) {
    switch (this.status) {
      case TaskStatus.Pending:
      case TaskStatus.Completed:
        this.atomTasks.push(...atomTasks);
        break;
      case TaskStatus.Running:
        this.pause().then(() => {
          this.atomTasks.push(...atomTasks);
          this.resume();
        });
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
    this.event.emit("progress", { percent, taskInfo: this.getInfo() });
  }

  public setTaskMsg(msg?: string) {
    this.taskMsg = msg;
  }

  public start() {
    if (this.status !== TaskStatus.Pending) {
      throw new Error("Task is not pending, cannot start");
    }
    this.status = TaskStatus.Running;
    this.event.emit("start", { taskInfo: this.getInfo() });
    this.runAtomTasks();
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
      }
    ).finally(() => {
      this.status = TaskStatus.Paused;
      this.event.emit("pause", { taskInfo: this.getInfo() });
    });
  }

  public resume() {
    if (this.status !== TaskStatus.Paused) {
      throw new Error("Task is not paused, cannot resume");
    }
    this.status = TaskStatus.Running;
    this.event.emit("resume", { taskInfo: this.getInfo() });
    this.runAtomTasks();
  }

  public cancel() {
    const validStatus: TaskStatus[] = [
      TaskStatus.Pending,
      TaskStatus.Running,
      TaskStatus.Paused,
    ];
    if (!validStatus.includes(this.status)) {
      throw new Error(
        `Task is not in a valid status to cancel: ${this.status}`
      );
    }
    this.limit.clearQueue();
    this.status = TaskStatus.Cancel;
    this.event.emit("cancel", { taskInfo: this.getInfo() });
    this.reject?.("cancel");
  }

  public restart() {
    const validStatus: TaskStatus[] = [TaskStatus.Failed, TaskStatus.Cancel];
    if (!validStatus.includes(this.status)) {
      throw new Error(
        `Task is not in a valid status to restart: ${this.status}`
      );
    }
    this.status = TaskStatus.Running;
    this.event.emit("restart", { taskInfo: this.getInfo() });
    this.runAtomTasks({ restart: true });
  }

  public failed(error: Error | string) {
    if (this.status !== TaskStatus.Running) {
      throw new Error("Task is not running, cannot failed");
    }
    this.status = TaskStatus.Failed;
    const errObj = typeof error === "string" ? new Error(error) : error;
    this.error = { name: errObj.name, message: errObj.message };
    this.event.emit("error", {
      error: errObj,
      taskInfo: this.getInfo(),
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
    this.event.emit("complete", { taskInfo: this.getInfo() });
    this.clear();
    this.resolve?.(this.getInfo());
  }

  public remove() {
    const validStatus: TaskStatus[] = [
      TaskStatus.Cancel,
      TaskStatus.Failed,
      TaskStatus.Completed,
    ];
    if (!validStatus.includes(this.status)) {
      throw new Error(
        `Task is not in a valid status to remove: ${this.status}`
      );
    }
    this.status = TaskStatus.Removed;
    Task.TaskMap.delete(this.id);
    this.event.emit("remove", { taskInfo: this.getInfo() });
    this.clear();
  }

  public waitForEnd() {
    return this.promise;
  }

  private clear() {
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

  private runAtomTasks({
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
            (task) => task.getAtomTaskInfo().status === AtomTaskStatus.Pending
          );
      const input = atomTasks.map((atomTask) =>
        this.limit(() =>
          atomTask
            .run(this.ctx)
            .then(({ status }) => {
              switch (status) {
                case AtomTaskStatus.Completed:
                  this.setTaskMsg(atomTask.getAtomTaskInfo().successMsg);
                  break;
                case AtomTaskStatus.Failed:
                  this.setTaskMsg(atomTask.getAtomTaskInfo().errorMsg);
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
                  task.getAtomTaskInfo().status === AtomTaskStatus.Completed
              ).length;
              this.setPercent((finishCount / atomTasksCount) * 100);
            })
        )
      );
      Promise.all(input).finally(() => {
        const failedTasks = atomTasks.filter(
          (task) => task.getAtomTaskInfo().status === AtomTaskStatus.Failed
        );
        if (this.status === TaskStatus.Running) {
          if (failedTasks.length === 0) {
            this.complete();
          } else {
            this.failed(
              failedTasks
                .map((task) => task.getAtomTaskInfo().errorMsg)
                .join(", ")
            );
          }
        }
      });
    }
  }
}
