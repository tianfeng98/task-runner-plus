/**
 * 注意：
 * AtomTask是无序的，可以并行执行，虽然设置task时指定concurrency=1可以顺序执行，但其在设计上并不强调无序性，因此上下文中不会在下一个AtomTask中提供上一个AtomTask的状态。
 */
import { isFunction, retry, uid } from "radashi";
import {
  AbstractAtomTask,
  AbstractTaskCtx,
  AtomTaskStatus,
  type AtomTaskExec,
  type AtomTaskInfo,
  type AtomTaskInit,
  type AtomTaskMessage,
  type AtomTaskOptions,
  type Ctx,
} from "../types";
import { timeout } from "../utils";

const defaultOptions: Required<AtomTaskOptions> = {
  retryTimes: 3,
  retryDelay: 1000,
  timeoutOption: 60 * 1000,
};

export class AtomTask<T extends Ctx> extends AbstractAtomTask<T> {
  id: string;
  status = AtomTaskStatus.Pending;
  protected ctx?: AbstractTaskCtx<T> = void 0;
  /**
   * 错误消息或错误消息渲染函数
   */
  protected errorMsg?: AtomTaskMessage<T>;
  /**
   * 处理消息或处理消息渲染函数
   */
  protected processMsg?: AtomTaskMessage<T>;
  /**
   * 警告消息或警告消息渲染函数
   */
  protected warningMsg?: AtomTaskMessage<T>;
  /**
   * 成功消息或成功消息渲染函数
   */
  protected successMsg?: AtomTaskMessage<T>;
  protected retryCancel = new AbortController();
  protected exec: AtomTaskExec<T>;
  protected options: Required<AtomTaskOptions>;
  constructor(
    {
      exec,
      id = uid(32),
      errorMsg,
      processMsg,
      warningMsg,
      successMsg,
    }: AtomTaskInit<T>,
    options?: AtomTaskOptions,
  ) {
    super();
    this.exec = exec;
    this.id = id;
    this.errorMsg = errorMsg;
    this.processMsg = processMsg;
    this.warningMsg = warningMsg;
    this.successMsg = successMsg;
    this.options = { ...defaultOptions, ...options };
  }

  public getAtomTaskInfo(): AtomTaskInfo {
    return {
      id: this.id,
      status: this.status,
      processMsg: this.renderMessage(this.processMsg),
      successMsg: this.renderMessage(this.successMsg),
      errorMsg: this.renderMessage(this.errorMsg),
      warningMsg: this.renderMessage(this.warningMsg),
    };
  }

  public async run(ctx: AbstractTaskCtx<T>) {
    const { retryDelay, retryTimes, timeoutOption } = this.options;
    this.status = AtomTaskStatus.Running;
    /**
     * 记录执行次数
     */
    let execCount = 0;
    this.ctx = ctx;
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
          const [timeoutPromise, timeoutClear] = timeout(timeoutOption, () => {
            cancel.abort();
            return new Error("timeout");
          });
          const asyncExec = async () =>
            this.exec({
              exitRetry: exit,
              signal: cancel.signal,
              ctx,
              execCount,
            });
          return Promise.race([
            asyncExec()
              .then((result) => {
                switch (result) {
                  case AtomTaskStatus.Completed:
                    this.status = AtomTaskStatus.Completed;
                    break;
                  case AtomTaskStatus.Warning:
                    this.status = AtomTaskStatus.Warning;
                    break;
                  case AtomTaskStatus.Failed:
                    this.status = AtomTaskStatus.Failed;
                    break;
                }
              })
              .finally(timeoutClear),
            timeoutPromise,
          ]);
        },
      );
      if (this.status === AtomTaskStatus.Running) {
        this.status = AtomTaskStatus.Completed;
      }
    } catch (error) {
      this.status = AtomTaskStatus.Failed;
    }
    return this.getAtomTaskInfo();
  }

  protected renderMessage(message?: AtomTaskMessage<T>) {
    if (isFunction(message) && !!this.ctx) {
      return message(this.ctx);
    }
    if (typeof message === "string") {
      return message;
    }
    return "";
  }
}
