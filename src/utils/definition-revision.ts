// Only accept a release label when the loaded definition matches the shipped content.
export async function getDefinitionRevision(
  definition: object,
  revisions: Readonly<Record<string, string>>,
): Promise<string | undefined> {
  const data = new TextEncoder().encode(JSON.stringify(definition));
  const hash = await crypto.subtle.digest('SHA-256', data);
  const digest = Array.from(new Uint8Array(hash), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
  return revisions[digest];
}
