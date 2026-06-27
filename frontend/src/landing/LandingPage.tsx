import { useMemo } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router";
import { recommend, buildCliffChart, projectGap } from "../engine";
import type { UserProfile } from "../rules/schema";
import { ruleSet } from "../rules/products";
import { CliffSection } from "../result/CliffSection";
import { GapSection } from "../result/GapSection";

// 랜딩 티저용 대표 샘플 — 실제 추천이 아닌 '예시' 수치 (직장인 연봉 5,000만)
const SAMPLE: UserProfile = {
  age: 30,
  incomeType: "earned",
  income: 50_000_000,
  monthlyInvestable: 500_000,
  horizonYears: 3,
  asOf: "2026-06-27",
};

function TeaserCaption() {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <span className="rounded-full border border-line px-2 py-0.5 text-[11px] font-600 text-muted">
        예시
      </span>
      <span className="text-[13px] text-muted">직장인 연봉 5,000만 · 월 50만 · 3년 기준</span>
    </div>
  );
}

// 앱 진입 첫 화면 — 마스코트 + 가치 제안 + 예시 인사이트 (전체 화면 스냅 스크롤) + 플로팅 CTA
export default function LandingPage() {
  const navigate = useNavigate();

  const { cliff, gapProj } = useMemo(() => {
    const rec = recommend(SAMPLE, ruleSet);
    return {
      cliff: buildCliffChart(ruleSet, SAMPLE.incomeType),
      gapProj: projectGap(rec, SAMPLE.monthlyInvestable, SAMPLE.horizonYears, ruleSet),
    };
  }, []);

  return (
    <>
      <div className="h-svh snap-y snap-mandatory overflow-y-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {/* 1면: 히어로 */}
        <section className="mx-auto flex min-h-svh max-w-[640px] snap-start flex-col items-center justify-center px-5 pb-28 text-center">
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

          <motion.p
            className="mt-10 text-[12px] text-locked"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.5 }}
          >
            아래로 넘겨 예시 인사이트 보기 ↓
          </motion.p>
        </section>

        {/* 2면: 연봉 절벽 */}
        {cliff && cliff.markers.length > 0 && (
          <section className="mx-auto flex min-h-svh max-w-[640px] snap-start flex-col justify-center px-5 pb-28 pt-10">
            <TeaserCaption />
            <CliffSection cliff={cliff} currentIncome={SAMPLE.income} asOfLabel={ruleSet.asOfLabel} />
          </section>
        )}

        {/* 3면: N년 후 격차 */}
        {gapProj.finalGap > 0 && (
          <section className="mx-auto flex min-h-svh max-w-[640px] snap-start flex-col justify-center px-5 pb-28 pt-10">
            <TeaserCaption />
            <GapSection proj={gapProj} />
          </section>
        )}
      </div>

      {/* 플로팅 CTA — 모든 면 위에 고정 */}
      <div className="fixed inset-x-0 bottom-0 z-20">
        <div className="mx-auto max-w-[640px] bg-gradient-to-t from-paper via-paper/90 to-transparent px-5 pb-6 pt-12">
          <button
            type="button"
            onClick={() => navigate("/start")}
            className="w-full rounded-xl bg-gold py-4 text-[16px] font-600 text-white shadow-lg shadow-gold/20 transition active:scale-[0.99]"
          >
            절세 시작하기
          </button>
          <p className="mt-2 text-center text-[12px] text-muted">개인정보를 저장하지 않아요</p>
        </div>
      </div>
    </>
  );
}
