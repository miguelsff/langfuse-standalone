import path from "node:path";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().default("file:../data/standalone.db"),
  STANDALONE_DATA_DIR: z.string().default("./data/json"),
  STANDALONE_MEDIA_DIR: z.string().default("./data/media"),
  ENCRYPTION_KEY: z
    .string()
    .regex(/^[a-fA-F0-9]{64}$/, "must contain 64 hexadecimal characters"),
  STANDALONE_EVAL_CONCURRENCY: z.coerce
    .number()
    .int()
    .min(1)
    .max(10)
    .default(2),
  STANDALONE_HOST: z.string().default("127.0.0.1"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
});

type RuntimeEnvironment = {
  DATABASE_URL: string;
  JSON_DATA_DIR: string;
  MEDIA_DATA_DIR: string;
  STANDALONE_ENCRYPTION_KEY: string;
  EVAL_CONCURRENCY: number;
  HOSTNAME: string;
  PORT: number;
};

let cachedEnv: RuntimeEnvironment | undefined;

export const getEnv = () => {
  if (!cachedEnv) {
    const parsed = envSchema.parse(process.env);
    const standaloneRoot =
      process.env.STANDALONE_ROOT ?? process.cwd();
    cachedEnv = {
      ...parsed,
      JSON_DATA_DIR: path.resolve(
        /* turbopackIgnore: true */ standaloneRoot,
        parsed.STANDALONE_DATA_DIR,
      ),
      MEDIA_DATA_DIR: path.resolve(
        /* turbopackIgnore: true */ standaloneRoot,
        parsed.STANDALONE_MEDIA_DIR,
      ),
      STANDALONE_ENCRYPTION_KEY: parsed.ENCRYPTION_KEY,
      EVAL_CONCURRENCY: parsed.STANDALONE_EVAL_CONCURRENCY,
      HOSTNAME: parsed.STANDALONE_HOST,
    };
  }

  return cachedEnv;
};

export const resetEnvForTests = () => {
  cachedEnv = undefined;
};
