import pLimit, { type LimitFunction } from "p-limit";
import { retry, timeout } from "radashi";
import { type TaskInfo, Task } from "./task";

export type TaskExec = (params: {
  exit: (err: any) => void;
  signal: AbortSignal;
  setPercent: (percent: number) => void;
}) => Promise<any>;

export interface TaskExecutorOptions {
  concurrency?: number;
  retryTimes?: number;
  retryDelay?: number;
  timeoutOption?: number;
}

const defaultOptions: Required<TaskExecutorOptions> = {
  concurrency: 1,
  retryTimes: 3,
  retryDelay: 1000,
  timeoutOption: 60 * 1000,
};

export class TaskExecutor {
  private limit: LimitFunction;
  private options: Required<TaskExecutorOptions>;

  constructor(options: TaskExecutorOptions = {}) {
    this.options = {
      ...defaultOptions,
      ...options,
    };
    this.limit = pLimit(this.options.concurrency);
  }

  private createTask(exec: TaskExec, taskInfo: Partial<TaskInfo>) {
    const retryCancel = new AbortController();
    const { retryDelay, retryTimes, timeoutOption } = this.options;
    const task = new Task(taskInfo);
    return async () => {
      try {
        const result = retry(
          { times: retryTimes, delay: retryDelay, signal: retryCancel.signal },
          (exit) => {
            const cancel = new AbortController();
            return Promise.race([
              exec({
                exit,
                signal: cancel.signal,
                setPercent: task.setPercent,
              }),
              timeout(timeoutOption, () => {
                cancel.abort();
                return new Error("timeout");
              }),
            ]);
          }
        );
        task.complete();
        return result;
      } catch (err) {
        task.failed(err as Error);
      }
    };
  }

  addTask(exec: TaskExec, taskInfo: Partial<TaskInfo>) {
    this.limit(this.createTask(exec, taskInfo));
  }

  addTaskList(taskList: [TaskExec, Partial<TaskInfo>][]) {
    taskList.map(([exec, taskInfo]) =>
      this.limit(this.createTask(exec, taskInfo))
    );
  }

  startTask(taskId: string) {
    Task.getTask(taskId)?.start();
  }

  pauseTask(taskId: string) {
    Task.getTask(taskId)?.pause();
  }

  cancenTask(taskId: string) {
    Task.getTask(taskId)?.cancel();
  }

  restartTask(taskId: string) {
    Task.getTask(taskId)?.restart();
  }

  removeTask(taskId: string) {
    Task.getTask(taskId)?.remove();
  }

  continueTask(taskId: string) {
    Task.getTask(taskId)?.continue();
  }
}
