import { useMemo } from "react";
import { Navigate, useLocation } from "react-router";
import { recommend } from "../engine";
import { ruleSet } from "../rules/products";
import type { UserProfile } from "../rules/schema";
import { ResultView } from "./ResultView";

export default function ResultPage() {
  const location = useLocation();
  const profile = location.state as UserProfile | null;
  const rec = useMemo(() => (profile ? recommend(profile, ruleSet) : null), [profile]);

  if (!profile || !rec) return <Navigate to="/" replace />;
  return <ResultView rec={rec} profile={profile} />;
}
