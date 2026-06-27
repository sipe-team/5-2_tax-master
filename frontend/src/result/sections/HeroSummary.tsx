import { Reveal } from "../components/Reveal";

// 결과 페이지 헤드라인: 최대 환급액(< 5만이면 격려 메시지)
export function HeroSummary({ maxBenefitMan }: { maxBenefitMan: number }) {
  return (
    <Reveal>
      {maxBenefitMan < 5 ? (
        <p className="mb-3 text-[22px] font-bold leading-tight tracking-tight text-gray900">
          절세를 잘하고 <span className="text-gold">계시네요!</span>
        </p>
      ) : (
        <p className="mb-3 text-[22px] font-bold leading-tight tracking-tight text-gray900">
          매년 최대
          <br />
          <span className="tnum text-gold">{maxBenefitMan.toLocaleString()}만원</span> 절약할 수
          있어요
        </p>
      )}
    </Reveal>
  );
}
