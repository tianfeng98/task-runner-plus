import type { EventType } from "mitt";

export enum AtomTaskStatus {
  Pending = "PENDING",
  Running = "RUNNING",
  Warning = "WARNING",
  Completed = "COMPLETED",
  Failed = "FAILED",
}

export interface AtomTaskInfo {
  id: string;
  status: AtomTaskStatus;
  processMsg?: string;
  successMsg?: string;
  errorMsg?: string;
  warningMsg?: string;
}

export interface AtomTaskOptions {
  retryTimes?: number;
  retryDelay?: number;
  timeoutOption?: number;
}

export type AtomTaskExecResult =
  | AtomTaskStatus.Completed
  | AtomTaskStatus.Failed
  | AtomTaskStatus.Warning;

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

export interface Ctx extends Record<string, any> {
  [key: string]: any;
}

export interface TaskError {
  name: string;
  message: string;
}

export interface TaskInfo<T extends Ctx, ExtInfo = any> {
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
  state: T;
}

export interface TaskEvent<T extends Ctx, ExtInfo = any> extends Record<
  EventType,
  any
> {
  progress: { percent: number; taskInfo: TaskInfo<T, ExtInfo> };
  complete: { taskInfo: TaskInfo<T, ExtInfo> };
  remove: { taskInfo: TaskInfo<T, ExtInfo> };
  error: { taskInfo: TaskInfo<T, ExtInfo>; error: Error };
  start: { taskInfo: TaskInfo<T, ExtInfo> };
  pause: { taskInfo: TaskInfo<T, ExtInfo> };
  resume: { taskInfo: TaskInfo<T, ExtInfo> };
  cancel: { taskInfo: TaskInfo<T, ExtInfo> };
  restart: { taskInfo: TaskInfo<T, ExtInfo> };
}
