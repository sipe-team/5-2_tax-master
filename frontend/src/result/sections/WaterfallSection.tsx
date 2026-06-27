import { motion, type Variants } from "framer-motion";

import type { ActionCard, Allocation } from "../../engine";
import { totalFirstYearBenefit, totalMonthlyAmount } from "../../engine";
import { won } from "../../lib/format";
import { Reveal } from "../components/Reveal";
import { Vessel } from "../components/Vessel";

// 워터폴 1, 2, 3 ... 순차 등장 (스크롤 무관, 마운트 시 cascade)
const waterfallContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.2 } },
};

const TOP_N = 5;

// "매달 적립 우선순위" 섹션 — 예산 요약 + Vessel 리스트(상위 N) + 더보기 + 잔여 안내
// `expanded` 상태는 부모가 보유 (PDF 저장 시 모두 펼침을 일괄 제어해야 함)
export function WaterfallSection({
  waterfall,
  actionByProduct,
  leftoverMonthly,
  expanded,
  onExpand,
}: {
  waterfall: Allocation[];
  actionByProduct: Map<string, ActionCard>;
  leftoverMonthly: number;
  expanded: boolean;
  onExpand: () => void;
}) {
  const shown = expanded ? waterfall : waterfall.slice(0, TOP_N);
  const hidden = waterfall.length - shown.length;
  const allocatedMonthly = totalMonthlyAmount(waterfall);
  const budgetMonthly = allocatedMonthly + leftoverMonthly;
  const totalFirstYear = totalFirstYearBenefit(waterfall);

  return (
    <Reveal>
      <section className="mb-7">
        <h2 className="mb-3 heading-md">
          매달 적립 우선순위
        </h2>
        {waterfall.length === 0 ? (
          <p className="text-[16px] font-medium leading-7 tracking-[-0.3px] text-muted">
            조건에 맞는 절세 계좌가 없어요.
          </p>
        ) : (
          <>
            <div className="mb-5 rounded-xl bg-surface/60 p-4 ring-1 ring-line">
              <p className="text-[16px] font-medium leading-7 tracking-[-0.3px] text-gray800">
                매달 모을 수 있는{" "}
                <span className="tnum font-semibold">{won(budgetMonthly)}원</span> 중{" "}
                <span className="tnum font-semibold">{won(allocatedMonthly)}원</span>을 아래
                순서대로 절세 계좌에 나눠 담아요.
              </p>
              {totalFirstYear > 0 && (
                <p className="mt-1.5 text-[16px] font-medium leading-7 tracking-[-0.3px] text-gray800">
                  이대로 채우면 첫 해에 약{" "}
                  <span className="tnum font-semibold text-gold">{won(totalFirstYear)}원</span>을
                  아낄 수 있어요.
                </p>
              )}
              <p className="mt-2 text-[12px] font-medium leading-relaxed tracking-[-0.3px] text-muted">
                각 계좌의 <span className="text-gold">첫 해 절세</span> 금액을 더한 값이에요.
                1번부터 채우는 게 가장 효율이 높아요.
              </p>
            </div>
            <motion.ol
              className="relative"
              variants={waterfallContainer}
              initial="hidden"
              animate="show"
            >
              <div
                className="absolute bottom-3 left-4 top-3 w-px -translate-x-1/2 bg-line"
                aria-hidden
              />
              {shown.map((a, i) => (
                <Vessel
                  key={a.productId}
                  a={a}
                  rank={i + 1}
                  action={actionByProduct.get(a.productId)}
                />
              ))}
            </motion.ol>
            {hidden > 0 && (
              <button
                className="no-print mt-2 text-[16px] font-medium leading-7 tracking-[-0.3px] text-gold outline-none hover:underline focus-visible:underline"
                onClick={onExpand}
              >
                + {hidden}개 더보기
              </button>
            )}
          </>
        )}
        {leftoverMonthly > 0 && (
          <p className="mt-4 text-[16px] font-medium leading-7 tracking-[-0.3px] text-muted">
            남는 <span className="tnum font-semibold">{won(leftoverMonthly)}원</span>/월은
            일반계좌로 모으세요.
          </p>
        )}
      </section>
    </Reveal>
  );
}
