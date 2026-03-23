import { z } from 'zod';

const EnvSchema = z.object({
  APP_URL: z.string(),
  DATABASE_URL: z.string(),
  NUXT_SESSION_PASSWORD: z.string(),
  SUPABASE_URL: z.string(),
  SUPABASE_SERVICE_ROLE_KEY: z.string(),
  IMPORT_USER_PASSWORD: z.string(),
  EMAIL_PROVIDER: z.string(),
  SMTP_HOST: z.string(),
  SMTP_PORT: z.string(),
  SMTP_USER: z.string(),
  SMTP_PASS: z.string(),
  SMTP_FROM: z.string(),
});

export type EnvSchema = z.infer<typeof EnvSchema>;

// eslint-disable-next-line node/no-process-env
export default EnvSchema.parse(process.env);
