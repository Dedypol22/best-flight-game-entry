// Deterministic screenshot-state parser; no wall-clock or random inputs are used.
export function readShot(search = window.location.search) {
  const params = new URLSearchParams(search);
  const name = params.get('shot');
  if (!['start', 'play', 'ring', 'land'].includes(name)) return null;
  const parsedSeed = Number.parseInt(params.get('seed') || '1', 10);
  return { name, seed: Number.isFinite(parsedSeed) ? parsedSeed >>> 0 : 1 };
}
