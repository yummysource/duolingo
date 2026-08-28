import { z } from 'zod';

export const DiagnosticCheckSchema = z.object({
  name: z.string(),
  status: z.enum(['pass', 'warn', 'fail']),
  code: z.string(),
  message: z.string(),
});

export const DoctorResultSchema = z.object({
  schema_version: z.literal('1'),
  status: z.enum(['healthy', 'degraded', 'failed']),
  credential_source: z.enum(['environment', 'keychain']).nullable(),
  language: z.string().nullable(),
  checks: z.array(DiagnosticCheckSchema),
});

export type DoctorResult = z.infer<typeof DoctorResultSchema>;

export const CanaryStateSchema = z.object({
  language_xp: z.number(),
  streak: z.number(),
  calendar_entries: z.number().int().nonnegative(),
  course_id: z.string(),
  hearts: z.number(),
  gems: z.number(),
  lingots: z.number(),
});

export const CanaryResultSchema = z.object({
  schema_version: z.literal('1'),
  status: z.enum(['pass', 'changed']),
  language: z.string(),
  checked_at: z.string().datetime(),
  vocabulary_probe_count: z.number().int().nonnegative(),
  changed_fields: z.array(z.string()),
  before: CanaryStateSchema,
  after: CanaryStateSchema,
});

export type CanaryResult = z.infer<typeof CanaryResultSchema>;
