export const createRetry = (retryCount: number, initTimeoutIncrement: number) => {
  let remaining = retryCount;
  let delay = initTimeoutIncrement;
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const cancel = () => {
    timers.forEach(clearTimeout);
    timers.clear();
  };
  const clear = () => {
    cancel();
    remaining = retryCount;
    delay = initTimeoutIncrement;
  };
  const retriesLeft = () => remaining > 0;
  const retry = (fn: () => void) => {
    if (!retriesLeft()) return;
    remaining--;
    const timer = setTimeout(() => {
      timers.delete(timer);
      fn();
    }, delay);
    timers.add(timer);
    delay *= 2;
  };
  return {retry, clear, cancel, retriesLeft};
};
