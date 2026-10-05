// 학교 '출결처리현황' 양식 그대로 엑셀(.xlsx) 만들기: 제목(A1:J1 병합), 결재란(담임·부장·교감), 5행 머리글, 6행부터 내용
// exceljs 는 무거워서 누를 때만 내려받음
export async function downloadSchoolXlsx({ title, sheetName, header, rows, fileName }) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName.slice(0, 31), {
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } },
  });
  ws.columns = [13, 13, 9, 11, 8, 7, 9, 9, 22, 24].map((width) => ({ width }));
  const thin = { style: 'thin', color: { argb: 'FF555555' } };
  const box = { top: thin, left: thin, bottom: thin, right: thin };
  const center = { vertical: 'middle', horizontal: 'center', wrapText: true };

  ws.mergeCells('A1:J1');
  Object.assign(ws.getCell('A1'), { value: title, font: { bold: true, size: 16 }, alignment: { vertical: 'middle', horizontal: 'center' } });
  ws.getRow(1).height = 32;

  // 결재란
  ws.mergeCells('F2:F3');
  ws.getCell('F2').value = '결재';
  ['담임', '부장', '교감'].forEach((v, i) => { ws.getCell(2, 7 + i).value = v; });
  for (const r of [2, 3]) for (let c = 6; c <= 9; c++) Object.assign(ws.getCell(r, c), { border: box, alignment: center });
  ws.getRow(3).height = 36;

  // 머리글(5행)
  const h = ws.getRow(5);
  header.forEach((v, i) => { h.getCell(i + 1).value = v; });
  h.eachCell((cell) => Object.assign(cell, { border: box, alignment: center, font: { bold: true }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8E8E8' } } }));
  h.height = 22;

  rows.forEach((r, k) => {
    const row = ws.getRow(6 + k);
    r.forEach((v, i) => { row.getCell(i + 1).value = v === '' ? null : String(v); });
    for (let c = 1; c <= header.length; c++) Object.assign(row.getCell(c), { border: box, alignment: { ...center, horizontal: c >= 9 ? 'left' : 'center' } });
  });
  ws.views = [{ state: 'frozen', ySplit: 5 }];

  const buf = await wb.xlsx.writeBuffer();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
