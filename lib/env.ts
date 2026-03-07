import { z } from 'zod';

const EnvSchema = z.object({
  DATABASE_URL: z.string(),
  NUXT_SESSION_PASSWORD: z.string(),
  SUPABASE_URL: z.string(),
  SUPABASE_SERVICE_ROLE_KEY: z.string(),
});

export type EnvSchema = z.infer<typeof EnvSchema>;

// eslint-disable-next-line node/no-process-env
export default EnvSchema.parse(process.env);
