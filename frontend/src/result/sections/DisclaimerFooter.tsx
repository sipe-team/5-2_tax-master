import { Reveal } from "../components/Reveal";

// 법령·자문 면책 고지 푸터
export function DisclaimerFooter({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <Reveal>
      <footer className="border-t border-line pt-5 text-[12px] leading-relaxed text-muted">
        {items.map((d, i) => (
          <p key={i}>※ {d}</p>
        ))}
      </footer>
    </Reveal>
  );
}
