import { useNavigate } from "react-router";
import { useFunnel } from "@use-funnel/react-router";
import { FunnelDataSchema, type FunnelData, toProfile } from "../rules/profile";
import { StepAccounts } from "./steps/StepAccounts";
import { StepBasic } from "./steps/StepBasic";
import { StepIncome } from "./steps/StepIncome";
import { StepInvest } from "./steps/StepInvest";

type Ctx = Partial<FunnelData>;

const STEPS = ["basic", "accounts", "invest", "income"] as const;

// 펀넬 오케스트레이션 — 4단계 순서 결정 + 마지막 단계 완료 시 결과 페이지 이동
export default function FunnelPage() {
  const navigate = useNavigate();
  const funnel = useFunnel<{ basic: Ctx; accounts: Ctx; invest: Ctx; income: Ctx }>({
    id: "tax-funnel",
    initial: { step: "basic", context: {} },
  });

  function finish(ctx: Ctx) {
    const parsed = FunnelDataSchema.safeParse(ctx);
    if (!parsed.success) return; // 필수값 누락 시 무시 (1단계에서 막힘)
    navigate("/result", { state: toProfile(parsed.data) });
  }

  return (
    <funnel.Render
      basic={({ context, history }) => (
        <StepBasic
          value={context}
          totalSteps={STEPS.length}
          onNext={(p) => history.push("accounts", { ...context, ...p })}
        />
      )}
      accounts={({ context, history }) => (
        <StepAccounts
          value={context}
          totalSteps={STEPS.length}
          onNext={(p) => history.push("invest", { ...context, ...p })}
          onSkip={() => history.push("invest", { ...context })}
        />
      )}
      invest={({ context, history }) => (
        <StepInvest
          value={context}
          totalSteps={STEPS.length}
          onNext={(p) => history.push("income", { ...context, ...p })}
          onSkip={() => history.push("income", { ...context })}
        />
      )}
      income={({ context }) => (
        <StepIncome
          value={context}
          totalSteps={STEPS.length}
          onSubmit={(p) => finish({ ...context, ...p })}
          onSkip={() => finish(context)}
        />
      )}
    />
  );
}
