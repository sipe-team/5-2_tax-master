import { useNavigate } from "react-router";

import backIcon from "../assets/backbutton-left.svg";

// 사양: w-full · h-54 · padding 10px 20px · items-center · sticky top
export function BackHeader() {
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-40 w-full bg-paper">
      <div className="mx-auto flex h-[54px] max-w-[640px] items-center px-5 py-2.5">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="뒤로 가기"
          className="-ml-2 flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-line/50"
        >
          <img src={backIcon} alt="" aria-hidden width={24} height={24} />
        </button>
      </div>
    </header>
  );
}
