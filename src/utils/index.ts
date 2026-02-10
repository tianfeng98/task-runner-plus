import { TimeoutError, isFunction } from "radashi";

type TimeoutInl = string | number | NodeJS.Timeout | undefined;
/**
 * 自行实现可取消的 timeout 函数
 * @param ms
 * @param error
 * @returns
 */
export const timeout = <TError extends Error>(
  /**
 /**
 * The number of milliseconds to wait before rejecting.
 */ ms: number,
  /**
   * An error message or a function that returns an error. By default,
   * a `TimeoutError` is thrown with the message "Operation timed
   * out".
   */
  error?: string | (() => TError),
): [Promise<TimeoutInl>, () => void] => {
  let inl: TimeoutInl = void 0;
  const clear = () => {
    if (inl) {
      clearTimeout(inl);
    }
  };
  const promise = new Promise<TimeoutInl>((_, reject) => {
    inl = globalThis.setTimeout(
      () => reject(isFunction(error) ? error() : new TimeoutError(error)),
      ms,
    );
    return inl;
  });
  return [promise, clear];
};

/**
 * 用于等待满足条件的结果，返回结果值
 * @param condition 条件函数，用于判断是否满足结果
 * @param result 结果函数，用于返回结果
 * @param param2 超时时间和延迟时间，默认值分别为 10 秒和 500 毫秒
 * @returns
 */

export const promiseFor = <T>(
  condition: () => boolean,
  result: () => T,
  {
    timeout = 10 * 1000,
    delay = 500,
  }: { timeout?: number; delay?: number } = {},
): Promise<T> => {
  return new Promise<T>((resolve, reject) => {
    const startTime = Date.now();
    const inl = setInterval(() => {
      if (condition()) {
        clearInterval(inl);
        resolve(result());
      } else if (Date.now() - startTime > timeout) {
        clearInterval(inl);
        reject(new Error("timeout"));
      }
    }, delay);
  });
};
