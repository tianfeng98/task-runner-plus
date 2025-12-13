import mitt, { type EventType } from "mitt";
import plimit, { type LimitFunction } from "p-limit";
import { get, set, uid } from "radashi";
import {
  AtomTask,
  AtomTaskStatus,
  type AtomTaskExec,
  type AtomTaskOptions,
} from "./atom-task";

export enum TaskStatus {
  Pending = "PENDING",
  Running = "RUNNING",
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
  description?: string;
  createdAt: number;
  completedAt?: number;
  status: TaskStatus;
  percent: number;
  extInfo?: ExtInfo;
  error?: TaskError;
}

export interface TaskEvent<ExtInfo = any> extends Record<EventType, any> {
  percent: { percent: number; taskInfo: TaskInfo<ExtInfo> };
  complete: { taskInfo: TaskInfo<ExtInfo> };
  remove: { taskInfo: TaskInfo<ExtInfo> };
  error: { taskInfo: TaskInfo<ExtInfo>; error: Error };
  start: { taskInfo: TaskInfo<ExtInfo> };
  pause: { taskInfo: TaskInfo<ExtInfo> };
  continue: { taskInfo: TaskInfo<ExtInfo> };
  cancel: { taskInfo: TaskInfo<ExtInfo> };
  restart: { taskInfo: TaskInfo<ExtInfo> };
}

export interface TaskOptions {
  concurrency?: number;
}

export class Task<ExtInfo = any> implements TaskInfo {
  id: string = uid(24);
  name?: string;
  description?: string;
  createdAt = Date.now();
  completedAt?: number;
  status = TaskStatus.Pending;
  percent = 0;
  extInfo?: ExtInfo;
  error?: TaskError;
  private event = mitt<TaskEvent>();
  private atomTasks?: AtomTask[];
  private limit: LimitFunction;

  constructor(
    params: Partial<TaskInfo>,
    { concurrency = 1 }: TaskOptions = {}
  ) {
    this.limit = plimit(concurrency);
    for (const key in params) {
      const value = get(params, key);
      if (value) {
        set(this, key, value);
      }
    }
  }

  private static TaskMap = new Map<string, Task>();

  static getTask(id: string) {
    return this.TaskMap.get(id);
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
    };
  }

  public setAtomTasks(
    atomTaskConfig: [exec: AtomTaskExec, options?: AtomTaskOptions][]
  ) {
    this.atomTasks = atomTaskConfig.map(
      ([exec, options], index) =>
        new AtomTask({ exec, errorMsg: `AtomTask ${index} failed` }, options)
    );
  }

  public updateExtInfo(info: ExtInfo) {
    this.extInfo = info;
  }

  public setPercent(percent: number) {
    this.percent = percent;
    this.event.emit("percent", { percent, taskInfo: this.getInfo() });
  }

  public start() {
    if (this.status !== TaskStatus.Pending) {
      throw new Error("Task is not pending, cannot start");
    }
    this.status = TaskStatus.Running;
    this.event.emit("start", { taskInfo: this.getInfo() });
    this.runAtomTasks();
  }

  public pause() {
    if (this.status !== TaskStatus.Running) {
      throw new Error("Task is not running, cannot pause");
    }
    this.limit.clearQueue();
    this.status = TaskStatus.Paused;
    this.event.emit("pause", { taskInfo: this.getInfo() });
  }

  public continue() {
    if (this.status !== TaskStatus.Paused) {
      throw new Error("Task is not paused, cannot continue");
    }
    this.status = TaskStatus.Running;
    this.event.emit("continue", { taskInfo: this.getInfo() });
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
    this.runAtomTasks();
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

  private runAtomTasks() {
    const atomTasks = this.atomTasks;
    if (Array.isArray(atomTasks)) {
      const allTasks = atomTasks.length;
      Promise.all(
        atomTasks
          .filter((task) => task.getStatus() === AtomTaskStatus.Pending)
          .map((atomTask) => {
            this.limit(() =>
              atomTask.run().finally(() => {
                const finishCount = atomTasks.filter(
                  (task) => task.getStatus() === AtomTaskStatus.Completed
                ).length;
                this.percent += (finishCount / allTasks) * 100;
              })
            );
          })
      ).finally(() => {
        const failedTasks = atomTasks.filter(
          (task) => task.getStatus() === AtomTaskStatus.Failed
        );
        if (failedTasks.length === 0) {
          this.complete();
        } else {
          this.failed(failedTasks.map((task) => task.getErrorMsg()).join(", "));
        }
      });
    }
  }
}
