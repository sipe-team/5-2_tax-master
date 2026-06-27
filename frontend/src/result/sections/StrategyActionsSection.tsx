import type { ActionCard } from "../../engine";
import { ActionItem } from "../components/ActionItem";
import { Reveal } from "../components/Reveal";

// "지금 할 일·전략" 섹션 — 워터폴 그릇에 묶이지 않은 순수 전략(증여·매도·RIA 등)만 표시
export function StrategyActionsSection({ actions }: { actions: ActionCard[] }) {
  if (actions.length === 0) return null;
  return (
    <Reveal>
      <section className="mb-7">
        <h2 className="mb-3 heading-md">
          지금 할 일 · 전략
        </h2>
        <div className="flex flex-col gap-3">
          {actions.map((a) => (
            <ActionItem key={a.id} a={a} />
          ))}
        </div>
      </section>
    </Reveal>
  );
}
