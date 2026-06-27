export const todayISO = () => new Date().toISOString().slice(0, 10);
export const won = (n: number) => `${Math.round(n / 10_000).toLocaleString()}만`;
export const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

// 원 → 만원 단위로 반올림 변환. 화면 표시·시뮬레이션 입력 디폴트에 사용.
export const wonToMan = (n: number) => Math.round(n / 10_000);
