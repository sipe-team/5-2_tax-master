// 결과 화면 → PDF로 저장 (브라우저 인쇄 다이얼로그 호출)
// 인쇄 전에 접힌 영역(워터폴 더보기·가정/제외)을 모두 펼치고 0.35s 뒤 print 호출
export function PdfSaveButton({ onSave }: { onSave: () => void }) {
  return (
    <div className="no-print mb-6">
      <button
        type="button"
        onClick={onSave}
        className="inline-flex items-center gap-1.5 rounded-lg border border-gold/50 px-3 py-1.5 text-[13px] font-600 text-gold outline-none transition-colors hover:bg-gold/10 focus-visible:bg-gold/10"
      >
        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" aria-hidden>
          <path
            d="M10 3v9m0 0 3-3m-3 3-3-3M4 14v2a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-2"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        PDF로 저장
      </button>
    </div>
  );
}
