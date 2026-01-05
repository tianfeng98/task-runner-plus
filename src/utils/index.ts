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
  }: { timeout?: number; delay?: number } = {}
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
