import { baseConfigSchema, loadEnvFiles, parseConfig, type BaseConfig } from "@aos/config";
import type { ZodTypeAny, z } from "zod";

import { ConfigurationException } from "../errors/index.js";
import type { IConfigurationProvider } from "../interfaces/i-configuration-provider.js";
import { NullSecretProvider, type ISecretProvider } from "../interfaces/i-secret-provider.js";

export interface ConfigurationServiceOptions<TSchema extends ZodTypeAny> {
  readonly schema?: TSchema;
  readonly secretProvider?: ISecretProvider;
  readonly envSource?: () => Record<string, string | undefined>;
  readonly loadDotEnvFiles?: boolean;
}

/**
 * The Kernel's typed Configuration Service: environment loading (via @aos/config), schema
 * validation (Zod, default @aos/config's baseConfigSchema, override-able), reload, programmatic
 * override layering, and a Secret Provider port (interface only — no Vault/AWS implementation).
 */
export class ConfigurationService<
  TSchema extends ZodTypeAny = typeof baseConfigSchema,
> implements IConfigurationProvider<z.infer<TSchema>> {
  private current: z.infer<TSchema> | undefined;
  private overrides: Partial<z.infer<TSchema>> = {};
  private readonly schema: TSchema;
  private readonly secretProvider: ISecretProvider;
  private readonly envSource: () => Record<string, string | undefined>;
  private readonly loadDotEnvFiles: boolean;

  constructor(options: ConfigurationServiceOptions<TSchema> = {}) {
    this.schema = options.schema ?? (baseConfigSchema as unknown as TSchema);
    this.secretProvider = options.secretProvider ?? new NullSecretProvider();
    this.envSource = options.envSource ?? (() => process.env);
    this.loadDotEnvFiles = options.loadDotEnvFiles ?? true;
  }

  async load(): Promise<z.infer<TSchema>> {
    if (this.loadDotEnvFiles) {
      loadEnvFiles();
    }
    const result = parseConfig(this.schema, this.envSource());
    if (!result.ok) {
      throw new ConfigurationException(result.error.message, { cause: result.error });
    }
    this.current = { ...(result.value as object), ...this.overrides } as z.infer<TSchema>;
    return this.current;
  }

  get(): z.infer<TSchema> {
    if (!this.current) {
      throw new ConfigurationException("Configuration has not been loaded yet — call load() first");
    }
    return this.current;
  }

  async reload(): Promise<z.infer<TSchema>> {
    return this.load();
  }

  override(partial: Partial<z.infer<TSchema>>): void {
    this.overrides = { ...this.overrides, ...partial };
    if (this.current) {
      this.current = { ...(this.current as object), ...partial } as z.infer<TSchema>;
    }
  }

  async resolveSecret(key: string): Promise<string | undefined> {
    return this.secretProvider.resolve(key);
  }

  get isLoaded(): boolean {
    return this.current !== undefined;
  }
}

export type { BaseConfig };
