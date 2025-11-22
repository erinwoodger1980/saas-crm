// Legacy utils retained minimally for type hints – Prisma removed.
// If client-side code imports serialize/buildDataPayload, keep lightweight equivalents.
export function serialize(raw: any) {
  return raw;
}
export function buildDataPayload(input: Record<string, unknown>) {
  return input;
}
