import { retry, timeout } from "radashi";

export enum AtomTaskStatus {
  Pending = "PENDING",
  Running = "RUNNING",
  Completed = "COMPLETED",
  Failed = "FAILED",
}

export type AtomTaskExec = (input: {
  exitRetry: (err: any) => void;
  signal: AbortSignal;
}) => Promise<any> | void;

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

export class AtomTask {
  private status = AtomTaskStatus.Pending;
  private retryCancel = new AbortController();
  private exec: AtomTaskExec;
  private options: Required<AtomTaskOptions>;
  private errorMsg?: string;
  constructor(
    { exec, errorMsg }: { exec: AtomTaskExec; errorMsg?: string },
    options?: AtomTaskOptions
  ) {
    this.exec = exec;
    this.errorMsg = errorMsg;
    this.options = { ...defaultOptions, ...options };
  }

  public getStatus() {
    return this.status;
  }

  public getErrorMsg() {
    return this.errorMsg;
  }

  public async run() {
    const { retryDelay, retryTimes, timeoutOption } = this.options;
    this.status = AtomTaskStatus.Running;
    try {
      await retry(
        {
          times: retryTimes,
          delay: retryDelay,
          signal: this.retryCancel.signal,
        },
        (exit) => {
          const cancel = new AbortController();
          return Promise.race([
            this.exec({
              exitRetry: exit,
              signal: cancel.signal,
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
    return {
      success: this.status === AtomTaskStatus.Completed,
      errorMsg: this.errorMsg,
    };
  }
}
