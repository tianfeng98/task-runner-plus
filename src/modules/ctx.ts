import {
  AbstractAtomTask,
  AbstractTask,
  AbstractTaskCtx,
  type Ctx,
  type TaskCtxInit,
} from "../types";

export class TaskCtx<T extends Ctx> extends AbstractTaskCtx<T> {
  private state: Map<any, any>;
  /**
   * 添加原子任务到任务队列
   * @param atomTasks 原子任务数组
   * @returns Promise<void>
   */
  addAtomTasks?: (atomTasks: AbstractAtomTask<T>[]) => Promise<void>;

  /**
   * 从任务队列中移除原子任务
   * 仅支持移除状态为 Pending 的原子任务
   * @param taskIds 原子任务ID数组
   * @returns Promise<void>
   */
  removeAtomTasks?: (taskIds: string[]) => Promise<void>;

  constructor({ addAtomTasks, removeAtomTasks, defaultData }: TaskCtxInit<T>) {
    super();
    this.addAtomTasks = addAtomTasks;
    this.removeAtomTasks = removeAtomTasks;
    this.state = new Map(defaultData ? Object.entries(defaultData) : void 0);
  }

  set<Value extends T[keyof T]>(key: keyof T, value: Value) {
    return this.state.set(key, value);
  }

  get<K extends keyof T>(key: K): T[K] | undefined {
    return this.state.get(key);
  }

  getAllData(): T {
    return Object.fromEntries(this.state);
  }

  /**
   * 绑定任务到上下文，将任务的子任务操作功能注入到ctx对象中
   * @param task 任务对象
   * @throws Error 如果task对象缺少必要的子任务操作方法
   */
  bindTask(task: AbstractTask<T>) {
    // 验证task对象是否具有必要的方法
    if (typeof task.addAtomTasks !== "function") {
      throw new Error("Task object must have addAtomTasks method");
    }

    if (typeof task.removeAtomTasks !== "function") {
      throw new Error("Task object must have removeAtomTasks method");
    }

    // 绑定方法到ctx对象，确保this指向正确
    this.addAtomTasks = task.addAtomTasks.bind(task);
    this.removeAtomTasks = task.removeAtomTasks.bind(task);
  }
}
