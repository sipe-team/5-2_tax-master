import { AnimatePresence, motion } from "framer-motion";

// 체크박스/토글에 따라 펼쳐지는 영역을 부드럽게 height + opacity 트랜지션
// 부모가 flex gap-6 (24px) 이므로 exit/initial 시 marginTop: -24 로 gap을 함께 접어 snap 제거
export function Collapse({ open, children }: { open: boolean; children: React.ReactNode }) {
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          key="collapse"
          initial={{ height: 0, opacity: 0, marginTop: -24 }}
          animate={{ height: "auto", opacity: 1, marginTop: 0 }}
          exit={{ height: 0, opacity: 0, marginTop: -24 }}
          transition={{
            height: { type: "spring", stiffness: 220, damping: 30, mass: 0.8 },
            marginTop: { type: "spring", stiffness: 220, damping: 30, mass: 0.8 },
            opacity: { duration: 0.18, ease: "easeInOut" },
          }}
          style={{ overflow: "hidden" }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
