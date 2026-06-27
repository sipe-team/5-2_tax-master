import { useId } from "react";
import { motion } from "framer-motion";

// 토스 스타일 분절형 토글 — 활성 옵션 흰색 pill이 layoutId로 부드럽게 슬라이드
export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  const layoutId = `segmented-${useId()}`;
  return (
    <div className="flex w-full items-start gap-2 self-stretch rounded-xl bg-gray100 p-1">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`relative flex flex-1 items-center justify-center gap-2.5 rounded-lg px-3 py-2 text-center text-[14px] leading-5 tracking-[-0.35px] transition-colors ${
              active ? "font-semibold text-gray900" : "font-medium text-locked"
            }`}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-lg bg-surface shadow-[0_1px_6px_0_rgba(0,0,0,0.08)]"
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
              />
            )}
            <span className="relative z-10">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
