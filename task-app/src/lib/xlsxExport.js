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

// 자리배치표 한 장(A4 가로): 제목 · 자리(이름 + 아래 작게 역할) · 교탁 · 청소 당번 표 · 오른쪽에 운동장 창문 + 1인 1역 목록
// 자리 칸 사이에 좁은 빈 열을 두어 책상처럼 떨어져 보이게 함. 청소 표는 자리 영역 너비를 요일 수만큼 나눠 병합.
export async function downloadSeatSheetXlsx({ title, model, opt, fileName }) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('자리배치표', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 1, margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 } },
  });
  const thin = { style: 'thin', color: { argb: 'FF333333' } };
  const box = { top: thin, left: thin, bottom: thin, right: thin };
  const center = { vertical: 'middle', horizontal: 'center', wrapText: true };
  const fill = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
  const C = model.seats[0]?.length ?? 1;
  const W = 2 * C - 1; // 자리 영역 열 수 (자리 + 사이 빈 열)
  const winCol = W + 2;
  const listCol = W + 4; // 1인 1역 목록 시작 열
  ws.columns = [
    ...Array.from({ length: W }, (_, i) => ({ width: i % 2 === 0 ? 12 : 2.5 })),
    { width: 2 }, { width: 7 }, { width: 2 },
    { width: 6 }, { width: 9 }, { width: 13 }, { width: 18 },
  ];
  const style = (cell, s) => Object.assign(cell, s);

  // 제목
  if (W > 1) ws.mergeCells(1, 1, 1, W);
  style(ws.getCell(1, 1), { value: title, font: { bold: true, size: 18 }, alignment: center, fill: fill('FFF4CCCC') });
  ws.getRow(1).height = 34;

  // 자리
  let row = 3;
  const perSeat = opt.roles ? 3 : 2;
  const seatTop = row;
  model.seats.forEach((cells) => {
    cells.forEach((x, c) => {
      const col = 1 + c * 2;
      if (!x) return;
      style(ws.getCell(row, col), { value: x.name, font: { bold: true, size: 15 }, alignment: center, border: box });
      if (opt.roles) style(ws.getCell(row + 1, col), { value: x.role || null, font: { size: 9 }, alignment: center, border: box });
    });
    ws.getRow(row).height = 26;
    if (opt.roles) ws.getRow(row + 1).height = 15;
    ws.getRow(row + perSeat - 1).height = 13; // 책상 사이 (오른쪽 1인 1역 목록도 같은 줄이라 너무 좁지 않게)
    row += perSeat;
  });
  const seatBottom = row - 2;

  // 교탁 (가운데)
  const bFrom = Math.max(1, Math.ceil(W / 2) - 2);
  const bTo = Math.min(W, bFrom + 4);
  if (bTo > bFrom) ws.mergeCells(row, bFrom, row, bTo);
  style(ws.getCell(row, bFrom), { value: '교탁', font: { bold: true, size: 14 }, alignment: center, border: box, fill: fill('FFFFF2CC') });
  ws.getRow(row).height = 26;
  row += 2;

  // 청소 당번 표
  if (opt.clean) {
    const parts = model.days.length + 1;
    const span = (k) => [1 + Math.floor((k * W) / parts), Math.max(1 + Math.floor((k * W) / parts), Math.floor(((k + 1) * W) / parts))];
    const put = (r, k, value, extra = {}) => {
      const [a, b] = span(k);
      if (b > a) ws.mergeCells(r, a, r, b);
      style(ws.getCell(r, a), { value: value || null, alignment: center, border: box, ...extra });
      for (let x = a; x <= b; x += 1) ws.getCell(r, x).border = box;
    };
    put(row, 0, '구역', { font: { bold: true }, fill: fill('FFF4CCCC') });
    model.days.forEach((d, i) => put(row, i + 1, d, { font: { bold: true }, fill: fill('FFF4CCCC') }));
    row += 1;
    for (const r of model.cleanRows) {
      if (r.first) {
        const [a, b] = span(0);
        if (r.span > 1 || b > a) ws.mergeCells(row, a, row + r.span - 1, b);
        style(ws.getCell(row, a), { value: r.zone, font: { bold: true, size: 10 }, alignment: center, border: box, fill: fill('FFF4CCCC') });
        for (let y = row; y < row + r.span; y += 1) for (let x = a; x <= b; x += 1) ws.getCell(y, x).border = box;
      }
      r.cells.forEach((n, i) => put(row, i + 1, n));
      ws.getRow(row).height = 18;
      row += 1;
    }
    const [, last] = span(model.days.length);
    for (const rule of model.rules) {
      const [a0, b0] = span(0);
      if (b0 > a0) ws.mergeCells(row, a0, row, b0);
      style(ws.getCell(row, a0), { value: rule.title, font: { bold: true }, alignment: center, border: box });
      if (last > b0 + 1) ws.mergeCells(row, b0 + 1, row, last);
      if (last >= b0 + 1) style(ws.getCell(row, b0 + 1), { value: rule.body, alignment: center, border: box });
      ws.getRow(row).height = Math.max(18, 15 * rule.body.split('\n').length);
      row += 1;
    }
    if (model.footer) {
      if (last > 1) ws.mergeCells(row, 1, row, last);
      style(ws.getCell(row, 1), { value: model.footer, alignment: center, border: box });
      row += 1;
    }
  }

  // 오른쪽: 운동장 창문 + 1인 1역 목록
  if (opt.list) {
    if (seatBottom > seatTop) ws.mergeCells(seatTop, winCol, seatBottom, winCol);
    style(ws.getCell(seatTop, winCol), { value: '운동장 창문', font: { size: 14 }, alignment: { ...center, textRotation: 'vertical' }, fill: fill('FFC9DAF8'), border: box });
    const head = ['번호', '이름', '역할', '1인 1역할'];
    head.forEach((h, i) => style(ws.getCell(2, listCol + i), { value: h, font: { bold: true }, alignment: center, border: box }));
    model.roleList.forEach((r, k) => {
      [r.number ?? null, r.name, r.role || null, r.detail || null].forEach((v, i) => style(ws.getCell(3 + k, listCol + i), { value: v, alignment: center, border: box, font: { size: 10 } }));
    });
  }

  const buf = await wb.xlsx.writeBuffer();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
