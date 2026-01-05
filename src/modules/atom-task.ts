import { retry, timeout } from "radashi";

export enum AtomTaskStatus {
  Pending = "PENDING",
  Running = "RUNNING",
  Completed = "COMPLETED",
  Failed = "FAILED",
}

export type AtomTaskExec<T extends Record<string, any>> = (input: {
  exitRetry: (err: any) => void;
  signal: AbortSignal;
  ctx: T;
  execCount: number;
}) => Promise<any> | void;

export interface AtomTaskInfo {
  status: AtomTaskStatus;
  processMsg?: string;
  successMsg?: string;
  errorMsg?: string;
}

export interface AtomTaskOptions {
  retryTimes?: number;
  retryDelay?: number;
  timeoutOption?: number;
}

const defaultOptions: Required<AtomTaskOptions> = {
  retryTimes: 3,
  retryDelay: 1000,
  timeoutOption: 60 * 1000,
};

export interface EmbeddedCtx<Ctx extends Record<string, any>>
  extends Record<string, any> {
  addAtomTasks: (atomTasks: AtomTask<Ctx>[]) => void;
}

export type TaskCtx<Ctx extends Record<string, any>> = EmbeddedCtx<Ctx> & Ctx;

export class AtomTask<Ctx extends Record<string, any>> {
  private status = AtomTaskStatus.Pending;
  private errorMsg?: string;
  private processMsg?: string;
  private successMsg?: string;
  private retryCancel = new AbortController();
  private exec: AtomTaskExec<TaskCtx<Ctx>>;
  private options: Required<AtomTaskOptions>;
  constructor(
    {
      exec,
      errorMsg,
      processMsg,
      successMsg,
    }: { exec: AtomTaskExec<TaskCtx<Ctx>> } & Pick<
      AtomTaskInfo,
      "errorMsg" | "processMsg" | "successMsg"
    >,
    options?: AtomTaskOptions
  ) {
    this.exec = exec;
    this.errorMsg = errorMsg;
    this.processMsg = processMsg;
    this.successMsg = successMsg;
    this.options = { ...defaultOptions, ...options };
  }

  public getAtomTaskInfo(): AtomTaskInfo {
    return {
      status: this.status,
      processMsg: this.processMsg,
      successMsg: this.successMsg,
      errorMsg: this.errorMsg,
    };
  }

  public async run(ctx: TaskCtx<Ctx>) {
    const { retryDelay, retryTimes, timeoutOption } = this.options;
    this.status = AtomTaskStatus.Running;
    let execCount = 0;
    try {
      await retry(
        {
          times: retryTimes,
          delay: retryDelay,
          signal: this.retryCancel.signal,
        },
        (exit) => {
          execCount += 1;
          const cancel = new AbortController();
          return Promise.race([
            this.exec({
              exitRetry: exit,
              signal: cancel.signal,
              ctx,
              execCount,
            }),
            timeout(timeoutOption, () => {
              cancel.abort();
              return new Error("timeout");
            }),
          ]);
        }
      );
      this.status = AtomTaskStatus.Completed;
    } catch (error) {
      this.status = AtomTaskStatus.Failed;
    }
    return this.getAtomTaskInfo();
  }
}
