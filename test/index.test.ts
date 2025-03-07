import TaskRunner from '../src/scheduler';

describe('TaskRunner', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('任务按优先级执行', async () => {
    const results: number[] = [];
    const runner = new TaskRunner({ concurrency: 1 });

    runner.add(() => results.push(1), 1);
    runner.add(() => results.push(3), 3);
    runner.add(() => results.push(2), 2);

    await jest.advanceTimersByTimeAsync(0);
    expect(results).toEqual([3, 2, 1]);
  });

  test('正确控制并发数', async () => {
    const mockTask = jest.fn();
    const runner = new TaskRunner({ concurrency: 2 });

    runner.add(() => new Promise((r) => setTimeout(r, 10)));
    runner.add(() => new Promise((r) => setTimeout(r, 10)));
    runner.add(mockTask);

    await jest.advanceTimersByTimeAsync(0);
    expect(mockTask).not.toHaveBeenCalled();
  });

  test('失败任务重试机制', async () => {
    let attempts = 0;
    const runner = new TaskRunner({
      concurrency: 1,
      retryCount: 2,
      retryDelay: 100,
    });

    runner.add(() => {
      attempts++;
      throw new Error();
    });

    await jest.advanceTimersByTimeAsync(0);
    expect(attempts).toBe(1);

    await jest.advanceTimersByTimeAsync(100);
    expect(attempts).toBe(2);

    await jest.advanceTimersByTimeAsync(100);
    expect(attempts).toBe(3);
  });

  test('暂停/恢复功能', async () => {
    const mockTask = jest.fn();
    const runner = new TaskRunner({ concurrency: 1 });

    runner.suspend();
    runner.add(mockTask);
    await jest.advanceTimersByTimeAsync(0);
    expect(mockTask).not.toHaveBeenCalled();

    runner.resume();
    await jest.advanceTimersByTimeAsync(0);
    expect(mockTask).toHaveBeenCalled();
  });

  test('完成回调触发', async () => {
    const callback = jest.fn();
    const runner = new TaskRunner({
      concurrency: 2,
      onAllComplete: callback,
    });

    runner.add(() => Promise.resolve());
    runner.add(() => Promise.resolve());
    await jest.advanceTimersByTimeAsync(0);

    expect(callback).toHaveBeenCalled();
  });
});
