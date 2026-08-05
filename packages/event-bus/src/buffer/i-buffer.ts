export interface IBuffer<T> {
  enqueue(item: T): void;
  dequeue(): T | undefined;
  peek(): T | undefined;
  readonly size: number;
  clear(): void;
}
