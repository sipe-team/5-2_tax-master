import { useState } from "react";

// 공용 숫자 입력 — Toss 박스 스타일
// 사양: w-full · padding 20px · gap 14px · border-radius 8px · bg #FFF
// 에러: border 1px #FF5761 (error 토큰)
export function NumberField({
  label,
  value,
  onChange,
  suffix,
  placeholder,
  error,
}: {
  label: string;
  value: number | undefined;
  onChange: (n: number) => void;
  suffix: string;
  placeholder?: string;
  error?: boolean;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (value ? String(value) : "");
  return (
    <label className="flex w-full flex-col gap-1.5">
      <span className="text-[14px] font-semibold text-gray800">{label}</span>
      <span
        className={`flex w-full items-center gap-3.5 rounded-lg border bg-surface p-5 transition-colors ${
          error ? "border-error" : "border-line focus-within:border-gold"
        }`}
      >
        <input
          type="text"
          inputMode="numeric"
          className="min-w-0 flex-1 bg-transparent font-sans text-base font-medium leading-none tracking-[-0.3px] tnum text-gray900 outline-none placeholder:text-locked"
          value={shown}
          placeholder={placeholder}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => {
            const c = e.target.value.replace(/[^\d]/g, "").replace(/^0+(?=\d)/, "");
            setDraft(c);
            onChange(c === "" ? 0 : Number(c));
          }}
          onBlur={() => setDraft(null)}
        />
        <span className="whitespace-nowrap text-xs text-muted">{suffix}</span>
      </span>
    </label>
  );
}
