import { motion } from "framer-motion";
import { BackHeader } from "../../components/BackHeader";

// 펀넬 단계 컨테이너 — 상단 진행 바, 타이틀/서브타이틀, children, 하단 액션 바
export function StepShell({
  step,
  totalSteps,
  title,
  subtitle,
  children,
  onPrimary,
  primaryLabel,
  primaryDisabled,
  onSkip,
}: {
  step: number;
  totalSteps: number;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onPrimary: () => void;
  primaryLabel: string;
  primaryDisabled?: boolean;
  onSkip?: () => void;
}) {
  return (
    <>
      <BackHeader />
      <div className="mx-auto flex min-h-[calc(100svh-54px)] max-w-[640px] flex-col px-5 pb-28 pt-6">
        <div
          className="mb-6 flex gap-1.5"
          role="progressbar"
          aria-valuenow={step}
          aria-valuemin={1}
          aria-valuemax={totalSteps}
        >
          {Array.from({ length: totalSteps }, (_, i) => {
            const filled = i < step;
            const isNewlyFilled = i === step - 1;
            return (
              <span key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-line">
                <motion.span
                  className="block h-full origin-left rounded-full bg-gold"
                  initial={{ scaleX: isNewlyFilled ? 0 : filled ? 1 : 0 }}
                  animate={{ scaleX: filled ? 1 : 0 }}
                  transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                />
              </span>
            );
          })}
        </div>
        <h1 className="heading-md">{title}</h1>
        {subtitle && (
          <p className="mt-2 text-[14px] font-medium leading-5 text-muted">{subtitle}</p>
        )}
        <div className="mt-8 flex flex-col gap-6">{children}</div>

        <div className="fixed inset-x-0 bottom-0 border-t border-line bg-paper/95 backdrop-blur">
          <div className="mx-auto flex max-w-[640px] items-center gap-3 px-5 py-4">
            {onSkip && (
              <button className="px-3 py-3 text-[14px] text-muted" onClick={onSkip}>
                건너뛰기
              </button>
            )}
            <button
              className="flex-1 rounded-xl bg-gold py-3.5 text-[16px] font-600 text-white transition disabled:opacity-40"
              onClick={onPrimary}
              disabled={primaryDisabled}
            >
              {primaryLabel}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
