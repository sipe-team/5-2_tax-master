import { useEffect, useMemo, useState } from "react";
import { Navigate, useLocation } from "react-router";
import { recommend } from "../engine";
import { ruleSet } from "../rules/products";
import type { UserProfile } from "../rules/schema";
import { ResultView } from "./ResultView";

// 결과 계산이 즉시 끝나더라도, 분석 중인 느낌을 주기 위해 2~3초(난수) 로딩을 보여준다.
function ResultLoading() {
  return (
    <div className="result-loading">
      <img className="result-loading__mascot" src="/mascot.png" alt="절세비서" />
      <div className="result-loading__spinner" />
      <p className="result-loading__text">나에게 맞는 절세 전략을 분석하고 있어요…</p>
    </div>
  );
}

export default function ResultPage() {
  const location = useLocation();
  const profile = location.state as UserProfile | null;
  const rec = useMemo(() => (profile ? recommend(profile, ruleSet) : null), [profile]);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile || !rec) return;
    // 앱 진입 후 최초 결과는 정확히 2초, 이후 결과는 2~3초 난수 지연
    const seen = sessionStorage.getItem("result-seen") === "1";
    const delay = seen ? 2000 + Math.floor(Math.random() * 1000) : 2000;
    sessionStorage.setItem("result-seen", "1");
    const timer = window.setTimeout(() => setLoading(false), delay);
    return () => window.clearTimeout(timer);
  }, [profile, rec]);

  if (!profile || !rec) return <Navigate to="/" replace />;
  if (loading) return <ResultLoading />;
  return <ResultView rec={rec} profile={profile} />;
}
