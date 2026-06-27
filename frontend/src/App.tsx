import { Route, Routes } from "react-router";
import FunnelPage from "./funnel/FunnelPage";
import ResultPage from "./result/ResultPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<FunnelPage />} />
      <Route path="/result" element={<ResultPage />} />
    </Routes>
  );
}
