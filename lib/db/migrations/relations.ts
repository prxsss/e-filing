import { relations } from 'drizzle-orm/relations';

import { attachments, request, requestTemplateValues } from './schema';

export const attachmentsRelations = relations(attachments, ({ one }) => ({
  request: one(request, {
    fields: [attachments.requestId],
    references: [request.id],
  }),
}));

export const requestRelations = relations(request, ({ many }) => ({
  attachments: many(attachments),
  requestTemplateValues: many(requestTemplateValues),
}));

export const requestTemplateValuesRelations = relations(requestTemplateValues, ({ one }) => ({
  request: one(request, {
    fields: [requestTemplateValues.requestId],
    references: [request.id],
  }),
}));
