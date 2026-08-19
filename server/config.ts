import { z } from 'zod';
import { resolve } from 'node:path';

const envSchema = z.object({
  HOST: z.string().min(1).default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65535).default(8787),
  DATA_DIR: z.string().min(1).default('./data'),
  DEEPSEEK_BASE_URL: z.string().url().default('https://api.deepseek.com'),
  DEEPSEEK_MODEL: z.literal('deepseek-v4-flash').default('deepseek-v4-flash'),
  DEEPSEEK_API_KEY: z.string().default(''),
  ANKI_OUTPUT_DIR: z.string().min(1).default('./output/anki'),
  CC_CONNECT_COMMAND: z.string().min(1).default('cc-connect'),
  CC_CONNECT_DATA_DIR: z.string().default(''),
  HUASHENG_MCP_URL: z.string().url().default('http://127.0.0.1:8000/sse'),
  ZHANG_GONG_SKILL_DIR: z.string().default(''),
  TAVILY_API_KEY: z.string().default(''),
});

export function readConfig(env: NodeJS.ProcessEnv = process.env) {
  const parsed = envSchema.parse(env);

  return {
    host: parsed.HOST,
    port: parsed.PORT,
    dataDir: resolve(parsed.DATA_DIR),
    deepseek: {
      baseUrl: parsed.DEEPSEEK_BASE_URL,
      model: parsed.DEEPSEEK_MODEL,
      apiKey: parsed.DEEPSEEK_API_KEY,
    },
    anki: {
      outputDirectory: resolve(parsed.ANKI_OUTPUT_DIR),
      ccConnectCommand: parsed.CC_CONNECT_COMMAND,
      ccConnectDataDirectory: parsed.CC_CONNECT_DATA_DIR.trim()
        ? resolve(parsed.CC_CONNECT_DATA_DIR)
        : undefined,
    },
    coach: {
      huashengMcpUrl: parsed.HUASHENG_MCP_URL,
      zhangGongSkillDirectory: parsed.ZHANG_GONG_SKILL_DIR.trim()
        ? resolve(parsed.ZHANG_GONG_SKILL_DIR)
        : undefined,
      tavilyApiKey: parsed.TAVILY_API_KEY,
    },
  };
}
