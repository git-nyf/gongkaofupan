import { z } from 'zod';
import { resolve } from 'node:path';

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(8787),
  DATA_DIR: z.string().min(1).default('./data'),
  DEEPSEEK_BASE_URL: z.string().url().default('https://api.deepseek.com'),
  DEEPSEEK_MODEL: z.literal('deepseek-v4-flash').default('deepseek-v4-flash'),
  DEEPSEEK_API_KEY: z.string().default(''),
});

export function readConfig(env: NodeJS.ProcessEnv = process.env) {
  const parsed = envSchema.parse(env);

  return {
    port: parsed.PORT,
    dataDir: resolve(parsed.DATA_DIR),
    deepseek: {
      baseUrl: parsed.DEEPSEEK_BASE_URL,
      model: parsed.DEEPSEEK_MODEL,
      apiKey: parsed.DEEPSEEK_API_KEY,
    },
  };
}
