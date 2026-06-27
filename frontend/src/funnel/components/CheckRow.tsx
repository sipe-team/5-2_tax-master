import checkedIcon from "../../assets/checked.svg";
import defaultCheckIcon from "../../assets/default-check.svg";

// 박스형 체크 행 — 선택 시 primary-light 배경, 비선택 시 border 박스
export function CheckRow({
  label,
  checked,
  onChange,
  error,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  error?: boolean;
}) {
  return (
    <label
      className={`flex w-full cursor-pointer items-center gap-3.5 rounded-lg p-5 text-[18px] font-semibold leading-5 tracking-[-0.54px] text-gray800 transition-colors ${
        checked
          ? "bg-primary-light backdrop-blur-[50px]"
          : error
            ? "border border-error bg-surface"
            : "border border-line bg-surface"
      }`}
    >
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <img
        src={checked ? checkedIcon : defaultCheckIcon}
        alt=""
        aria-hidden
        width={24}
        height={24}
        className="shrink-0"
      />
      {label}
    </label>
  );
}
