export const todayISO = () => new Date().toISOString().slice(0, 10);
export const won = (n: number) => `${Math.round(n / 10_000).toLocaleString()}만`;
export const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
