/** Share only work that is still running; failures never remain cached. */
export function createSingleFlight<T>() {
  const running = new Map<string, Promise<T>>();
  return (key: string, work: () => Promise<T>): Promise<T> => {
    const existing = running.get(key);
    if (existing) return existing;
    const task = Promise.resolve().then(work).finally(() => {
      if (running.get(key) === task) running.delete(key);
    });
    running.set(key, task);
    return task;
  };
}
