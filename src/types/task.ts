import type { Emitter } from "mitt";
import type { LimitFunction } from "p-limit";
import type {
  AtomTaskExecResult,
  AtomTaskInfo,
  AtomTaskOptions,
  AtomTaskStatus,
  Ctx,
  TaskError,
  TaskEvent,
  TaskInfo,
  TaskStatus,
} from "./common";

export abstract class AbstractTaskCtx<T extends Ctx> {
  abstract addAtomTasks?: (atomTasks: AbstractAtomTask<T>[]) => Promise<void>;

  abstract removeAtomTasks?: (taskIds: string[]) => Promise<void>;

  abstract set<Value extends T[keyof T]>(key: keyof T, value: Value): void;

  abstract get<K extends keyof T>(key: K): T[K] | undefined;

  abstract getAllData(): T;

  protected abstract bindTask(task: AbstractTask<T>): void;
}

export abstract class AbstractAtomTask<T extends Ctx> {
  abstract id: string;
  abstract status: AtomTaskStatus;
  protected abstract ctx?: AbstractTaskCtx<T>;
  /**
   * 错误消息或错误消息渲染函数
   */
  protected abstract errorMsg?: AtomTaskMessage<T>;
  /**
   * 处理消息或处理消息渲染函数
   */
  protected abstract processMsg?: AtomTaskMessage<T>;
  /**
   * 警告消息或警告消息渲染函数
   */
  protected abstract warningMsg?: AtomTaskMessage<T>;
  /**
   * 成功消息或成功消息渲染函数
   */
  protected abstract successMsg?: AtomTaskMessage<T>;
  protected abstract retryCancel: AbortController;
  protected abstract exec: AtomTaskExec<T>;
  protected abstract options: Required<AtomTaskOptions>;

  public abstract getAtomTaskInfo(): AtomTaskInfo;

  public abstract run(ctx: AbstractTaskCtx<T>): Promise<AtomTaskInfo>;

  protected abstract renderMessage(message?: AtomTaskMessage<T>): string;
}

export interface TaskCtxInit<T extends Ctx> {
  addAtomTasks?: (atomTasks: AbstractAtomTask<T>[]) => Promise<void>;
  removeAtomTasks?: (taskIds: string[]) => Promise<void>;
  defaultData?: T;
}

export type AtomTaskExec<T extends Ctx> = (input: {
  exitRetry: (err: any) => void;
  signal: AbortSignal;
  ctx: AbstractTaskCtx<T>;
  execCount: number;
}) => Promise<AtomTaskExecResult | void> | AtomTaskExecResult | void;

export type AtomTaskMessage<T extends Ctx> =
  | ((ctx: AbstractTaskCtx<T>) => string)
  | string;

export interface TaskOptions<T extends Ctx> {
  concurrency?: number;
  /**
   * 初始化任务上下文数据
   */
  defaultCtxData?: T;
  /**
   * 共享任务上下文，若启用此属性，则defaultCtxData失效
   */
  sharedCtx?: AbstractTaskCtx<T>;
}

export abstract class AbstractTask<T extends Ctx, ExtInfo = any> {
  abstract id: string;
  abstract name?: string;
  abstract description?: string;
  abstract createdAt: number;
  abstract completedAt?: number;
  abstract status: TaskStatus;
  abstract percent: number;
  abstract extInfo?: ExtInfo;
  abstract error?: TaskError;
  abstract taskMsg?: string;
  abstract event: Emitter<TaskEvent<T, ExtInfo>>;
  protected abstract readonly ctx: AbstractTaskCtx<T>;
  protected abstract atomTasks: AbstractAtomTask<T>[];
  protected abstract limit: LimitFunction;

  // 使用promise
  protected abstract promise: Promise<TaskInfo<T, ExtInfo>>;
  protected abstract resolve?: (value: TaskInfo<T, ExtInfo>) => void;
  protected abstract reject?: (reason?: any) => void;

  public abstract getTaskInfo(): TaskInfo<T, ExtInfo>;

  public abstract setAtomTasks(atomTasks: AbstractAtomTask<T>[]): void;

  public abstract addAtomTasks(atomTasks: AbstractAtomTask<T>[]): Promise<void>;

  /**
   * 删除原子任务，仅支持删除pending状态的原子任务
   * @param taskIds 原子任务id列表
   */
  public abstract removeAtomTasks(taskIds: string[]): Promise<void>;

  public abstract updateExtInfo(info: ExtInfo): void;

  public abstract setPercent(percent: number): void;

  public abstract setTaskMsg(msg?: string): void;

  public abstract start(): Promise<void[]>;

  public abstract pause(): Promise<boolean>;

  public abstract resume(): Promise<void[]>;

  public abstract cancel(): void;
  public abstract restart(): Promise<void[]>;

  public abstract failed(error: Error | string): void;

  public abstract complete(): void;

  public abstract remove(): void;

  public waitForEnd() {
    return this.promise;
  }

  protected abstract clear(): void;

  protected abstract runAtomTasks(params: {
    restart?: boolean;
  }): Promise<void[]>;
}

export interface AtomTaskInit<T extends Ctx> {
  exec: AtomTaskExec<T>;
  id?: string;
  errorMsg?: AtomTaskMessage<T>;
  processMsg?: AtomTaskMessage<T>;
  warningMsg?: AtomTaskMessage<T>;
  successMsg?: AtomTaskMessage<T>;
}
