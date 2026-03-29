import { z } from 'zod';

const EnvSchema = z.object({
  APP_URL: z.string(),
  DATABASE_URL: z.string(),
  NUXT_SESSION_PASSWORD: z.string(),
  SUPABASE_URL: z.string(),
  SUPABASE_SERVICE_ROLE_KEY: z.string(),
  IMPORT_USER_PASSWORD: z.string(),
  EMAIL_PROVIDER: z.string(),
  RESEND_API_KEY: z.string(),
  EMAIL_FROM: z.string(),
  SMTP_HOST: z.string(),
  SMTP_PORT: z.string(),
  SMTP_USER: z.string(),
  SMTP_PASS: z.string(),
  SCOPE: z.string(),
  CLIENT_SECRET: z.string(),
  CLIENT_ID: z.string(),
  REDIRECT_URI: z.string(),
  LOGOUT_REDIRECT_URI: z.string(),
  USER_INFO_ENDPOINT: z.string(),
  AUTHORIZATION_ENDPOINT: z.string(),
  TOKEN_ENDPOINT: z.string(),
  END_SESSION_ENDPOINT: z.string(),
});

export type EnvSchema = z.infer<typeof EnvSchema>;

// eslint-disable-next-line node/no-process-env
export default EnvSchema.parse(process.env);
