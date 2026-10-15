const MIN = 3;
const MAX = 500;

export function checkRequest(text: string): { ok: boolean; message?: string } {
  const n = text.trim().length;
  if (n < MIN)
    return { ok: false, message: `Request must be at least ${MIN} characters` };
  if (n > MAX)
    return { ok: false, message: `Request must be at most ${MAX} characters` };
  return { ok: true };
}

const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

export function isPreset(text: string, presets: readonly string[]): boolean {
  const t = norm(text);
  return presets.some((p) => norm(p) === t);
}
