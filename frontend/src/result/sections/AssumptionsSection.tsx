import { AnimatePresence, motion } from "framer-motion";
import type { Badge } from "../../engine";
import { Badges } from "../components/Badges";
import { Reveal } from "../components/Reveal";

// "가정·제외" 펼침 섹션 — 접힘 상태가 기본, 클릭 시 height/opacity 트랜지션으로 배지 등장
// `open` 상태는 부모 보유 (PDF 저장 시 일괄 펼침 제어를 위해)
export function AssumptionsSection({
  items,
  open,
  onToggle,
}: {
  items: Badge[];
  open: boolean;
  onToggle: () => void;
}) {
  if (items.length === 0) return null;
  return (
    <Reveal>
      <section className="mb-7">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex cursor-pointer items-center gap-1 text-[16px] font-semibold leading-7 tracking-[-0.3px] text-gray800 outline-none transition-colors hover:text-gold focus-visible:text-gold"
        >
          가정 · 제외 <span className="text-locked tnum">{items.length}</span>
          <svg
            className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
            viewBox="0 0 20 20"
            fill="none"
            aria-hidden
          >
            <path
              d="M6 8l4 4 4-4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden px-1"
            >
              <Badges items={items} />
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </Reveal>
  );
}
