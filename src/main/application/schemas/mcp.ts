import { z } from 'zod';

const stdioServerSchema = z
  .object({
    command: z.string().min(1),
    args: z.array(z.string()).optional(),
    env: z.record(z.string(), z.string()).optional(),
    type: z.literal('stdio').optional(),
  })
  .passthrough();

const httpServerSchema = z
  .object({
    type: z.literal('http'),
    url: z.string().url(),
    headers: z.record(z.string(), z.string()).optional(),
  })
  .passthrough();

const sseServerSchema = z
  .object({
    type: z.literal('sse'),
    url: z.string().url(),
    headers: z.record(z.string(), z.string()).optional(),
  })
  .passthrough();

// Order matters: stdio requires `command`, so an http/sse object (no command)
// falls through to the url-based variants.
export const mcpServerDefSchema = z.union([stdioServerSchema, httpServerSchema, sseServerSchema]);

export type McpServerDef = z.infer<typeof mcpServerDefSchema>;

export type McpTransport = 'stdio' | 'http' | 'sse';

export function transportOf(def: McpServerDef): McpTransport {
  const type = (def as { type?: unknown }).type;
  if (type === 'http' || type === 'sse') return type;
  return 'stdio';
}
