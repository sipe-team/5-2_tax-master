import { motion } from "framer-motion";
import { useNavigate } from "react-router";

// 앱 진입 첫 화면 — 마스코트 + 가치 제안 + "절세 시작하기" CTA
export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="mx-auto flex min-h-svh max-w-[640px] flex-col px-5 pb-10 pt-6">
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <motion.div
          className="relative flex h-[220px] w-[220px] items-center justify-center"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* 흰 마스코트가 흰 배경에 묻히지 않도록 뒤에 컬러 원 배경을 깔아 대비를 준다 */}
          <span
            aria-hidden
            className="absolute inset-0 rounded-full"
            style={{
              background:
                "radial-gradient(circle at 50% 38%, #e8f0ff 0%, #d4e4ff 55%, #c2d8ff 100%)",
            }}
          />
          <motion.img
            src="/mascot.png"
            alt="절세비서"
            width={180}
            height={180}
            className="relative h-[180px] w-[180px] select-none drop-shadow-[0_8px_20px_rgba(0,100,255,0.18)]"
            draggable={false}
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 3, ease: "easeInOut", repeat: Infinity }}
          />
        </motion.div>

        <motion.h1
          className="mt-7 text-[24px] font-bold leading-9 tracking-[-0.02em] text-ink"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
        >
          나에게 맞는 절세 우선순위,
          <br />
          1분 만에 찾아드려요
        </motion.h1>

        <motion.p
          className="mt-3 text-[15px] font-medium leading-6 text-muted"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.16, ease: [0.22, 1, 0.36, 1] }}
        >
          연금저축·IRP·ISA부터 해외주식까지,
          <br />
          절세비서가 똑똑하게 추천해드려요.
        </motion.p>
      </div>

      <motion.button
        type="button"
        onClick={() => navigate("/start")}
        className="w-full rounded-xl bg-gold py-4 text-[16px] font-600 text-white transition active:scale-[0.99]"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.24, ease: [0.22, 1, 0.36, 1] }}
      >
        절세 시작하기
      </motion.button>
    </div>
  );
}
