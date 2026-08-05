/** Port for the Kernel's typed configuration service. */
export interface IConfigurationProvider<T = Record<string, unknown>> {
  load(): Promise<T>;
  get(): T;
  reload(): Promise<T>;
  override(partial: Partial<T>): void;
}
