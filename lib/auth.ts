import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';

import db from './db/index';

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
  }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: false,
  },
  user: {
    modelName: 'users',
    additionalFields: {
      institutionId: {
        type: 'string',
        required: true,
        unique: true,
        input: true,
      },
      status: {
        type: ['active', 'suspended', 'pending', 'deleted'],
        required: true,
        defaultValue: 'pending',
        input: false,
      },
      facultyId: {
        type: 'number',
        required: false,
        input: true,
      },
    },
  },
  session: {
    modelName: 'sessions',
  },
  account: {
    modelName: 'accounts',
  },
  verification: {
    modelName: 'verifications',
  },
});
