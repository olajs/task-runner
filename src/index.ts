type Task<T = any> = () => T | Promise<T>;

/**
 * 任务调度器配置
 */
interface TaskRunnerOptions {
  /** 最大并发任务数 */
  concurrency: number;
  /** 失败重试次数 (默认 0) */
  retryCount?: number;
  /** 重试间隔时间（毫秒）(默认 0) */
  retryDelay?: number;
  /** 任务开始回调 */
  onTaskStart?: (task: Task) => void;
  /** 任务成功回调 */
  onTaskSuccess?: (task: Task) => void;
  /** 任务失败回调 */
  onTaskFailure?: (task: Task, error: any) => void;
  /** 全部任务完成回调 */
  onAllComplete?: () => void;
}

/**
 * 优先队列实现（最大堆）
 */
class PriorityQueue<T> {
  private heap: T[] = [];
  private compare: (a: T, b: T) => number;

  constructor(compareFn: (a: T, b: T) => number) {
    this.compare = compareFn;
  }

  get size() {
    return this.heap.length;
  }

  push(item: T) {
    this.heap.push(item);
    this.bubbleUp(this.heap.length - 1);
  }

  pop(): T | undefined {
    if (this.size === 0) return;
    this.swap(0, this.heap.length - 1);
    const item = this.heap.pop();
    this.bubbleDown(0);
    return item;
  }

  private bubbleUp(index: number) {
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.compare(this.heap[index], this.heap[parent]) <= 0) break;
      this.swap(index, parent);
      index = parent;
    }
  }

  private bubbleDown(index: number) {
    while (true) {
      const left = 2 * index + 1;
      const right = 2 * index + 2;
      let max = index;

      if (left < this.heap.length && this.compare(this.heap[left], this.heap[max]) > 0) {
        max = left;
      }

      if (right < this.heap.length && this.compare(this.heap[right], this.heap[max]) > 0) {
        max = right;
      }

      if (max === index) break;
      this.swap(index, max);
      index = max;
    }
  }

  private swap(i: number, j: number) {
    [this.heap[i], this.heap[j]] = [this.heap[j], this.heap[i]];
  }
}

interface QueuedTask {
  task: Task;
  priority: number;
  retries: number;
  seq: number; // 新增序列号
}

/**
 * 高性能任务调度器
 */
export class TaskRunner {
  private queue: PriorityQueue<QueuedTask>;
  private activeTasks = 0;
  private pendingCount = 0;
  private waitingReTry = 0;
  private isSuspended = false;
  private isScheduled = false;
  private nextSeq = 0; // 序列号生成器

  constructor(private options: TaskRunnerOptions) {
    if (options.concurrency <= 0) {
      throw new Error('Concurrency must be greater than 0');
    }
    // 使用优先队列优化排序性能，比较函数只需要比较优先级
    this.queue = new PriorityQueue<QueuedTask>((a, b) => {
      // 优先级比较（降序）
      const priorityDiff = a.priority - b.priority;
      if (priorityDiff !== 0) return priorityDiff;
      // 相同优先级时比较序列号（升序）
      return b.seq - a.seq;
    });
  }

  /**
   * 添加任务到队列
   * @param task 要执行的任务
   * @param priority 优先级（数值越大优先级越高）
   * @param retries 重试了几次
   */
  add(task: Task, priority = 0, retries = 0): void {
    this.queue.push({
      task,
      priority,
      retries,
      seq: this.nextSeq++, // 分配递增序列号
    });
    this.pendingCount++;

    // 仅在需要立即调度时触发微任务
    if (!this.isScheduled) {
      this.isScheduled = true;
      Promise.resolve().then(() => {
        this.isScheduled = false;
        this.schedule();
      });
    }
  }

  /** 暂停任务调度（不影响进行中的任务） */
  suspend(): void {
    this.isSuspended = true;
  }

  /** 恢复任务调度 */
  resume(): void {
    if (!this.isSuspended) return;
    this.isSuspended = false;
    this.schedule();
  }

  /** 核心调度方法 */
  private schedule(): void {
    while (this.canExecute()) {
      this.executeTask();
    }
  }

  private canExecute(): boolean {
    return (
      !this.isSuspended && // 只有非暂停状态
      this.activeTasks < this.options.concurrency &&
      this.queue.size > 0
    );
  }

  /** 执行单个任务 */
  private async executeTask(): Promise<void> {
    const taskInfo = this.queue.pop()!;
    this.activeTasks++;
    this.pendingCount--;
    this.options.onTaskStart?.(taskInfo.task);

    try {
      await taskInfo.task();
      this.options.onTaskSuccess?.(taskInfo.task);
    } catch (error) {
      if (taskInfo.retries < (this.options.retryCount ?? 0)) {
        this.retryTask(taskInfo);
      } else {
        this.options.onTaskFailure?.(taskInfo.task, error);
      }
    } finally {
      this.activeTasks--;
      this.checkCompletion();
      this.schedule();
    }
  }

  /** 重试任务 */
  private retryTask(taskInfo: { task: Task; priority: number; retries: number }): void {
    this.waitingReTry++;
    setTimeout(() => {
      this.add(taskInfo.task, taskInfo.priority, taskInfo.retries + 1);
      this.waitingReTry--;
    }, this.options.retryDelay ?? 0);
  }

  /** 检查所有任务是否完成 */
  private checkCompletion(): void {
    if (this.activeTasks === 0 && this.pendingCount === 0 && this.waitingReTry === 0) {
      this.options.onAllComplete?.();
    }
  }
}

export default TaskRunner;
