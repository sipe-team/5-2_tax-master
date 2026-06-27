import { Route, Routes } from "react-router";

import FunnelPage from "./funnel/FunnelPage";
import LandingPage from "./landing/LandingPage";
import ResultPage from "./result/ResultPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/start" element={<FunnelPage />} />
      <Route path="/result" element={<ResultPage />} />
    </Routes>
  );
}
