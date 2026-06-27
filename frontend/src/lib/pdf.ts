import html2canvas from "html2canvas-pro";
import { jsPDF } from "jspdf";

// 결과 화면(element) 전체를 한 장으로 캡처해 A4 여러 페이지 PDF로 저장한다.
// window.print() 인쇄 다이얼로그가 아니라 실제 .pdf 파일을 바로 다운로드한다.
export async function saveElementAsPdf(element: HTMLElement, fileName: string) {
  // 레티나급 선명도. 너무 키우면 메모리/속도 부담이라 2배로 고정.
  const scale = 2;

  const canvas = await html2canvas(element, {
    scale,
    useCORS: true,
    backgroundColor: "#ffffff",
    // 캡처에서 제외할 요소(버튼 등): .no-print
    ignoreElements: (el) => el.classList?.contains("no-print"),
    // 캡처 시점엔 펼쳐진 전체 높이를 잡아야 하므로 실제 콘텐츠 크기를 사용
    windowWidth: element.scrollWidth,
    windowHeight: element.scrollHeight,
  });

  const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();

  // 캔버스를 페이지 너비에 맞춰 스케일했을 때의 전체 높이
  const imgW = pageW;
  const imgH = (canvas.height * imgW) / canvas.width;

  if (imgH <= pageH) {
    // 한 페이지에 다 들어가는 경우
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, imgW, imgH);
  } else {
    // 여러 페이지로 분할: 페이지당 캔버스 픽셀 높이를 잘라 각 페이지에 그린다.
    const pageCanvasH = (pageH * canvas.width) / imgW; // 페이지 1장에 해당하는 캔버스 픽셀 높이
    let renderedH = 0;
    let page = 0;

    while (renderedH < canvas.height) {
      const sliceH = Math.min(pageCanvasH, canvas.height - renderedH);

      const pageCanvas = document.createElement("canvas");
      pageCanvas.width = canvas.width;
      pageCanvas.height = sliceH;
      const ctx = pageCanvas.getContext("2d");
      if (!ctx) break;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
      ctx.drawImage(
        canvas,
        0,
        renderedH,
        canvas.width,
        sliceH,
        0,
        0,
        canvas.width,
        sliceH,
      );

      const sliceImgH = (sliceH * imgW) / canvas.width;
      if (page > 0) pdf.addPage();
      pdf.addImage(
        pageCanvas.toDataURL("image/jpeg", 0.92),
        "JPEG",
        0,
        0,
        imgW,
        sliceImgH,
      );

      renderedH += sliceH;
      page += 1;
    }
  }

  pdf.save(fileName);
}
