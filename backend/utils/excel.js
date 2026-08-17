const ExcelJS = require('exceljs');

const exportToExcel = async (data, columns, sheetName = 'Sheet1') => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);

  worksheet.columns = columns.map((col) => ({
    header: col.header,
    key: col.key,
    width: col.width || 20,
  }));

  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF2563EB' },
  };
  worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

  data.forEach((row) => worksheet.addRow(row));

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
};

const SHORT_DAY_TO_FULL = {
  Sun: 'Sunday',
  Mon: 'Monday',
  Tues: 'Tuesday',
  Wed: 'Wednesday',
  Thurs: 'Thursday',
  Fri: 'Friday',
  Sat: 'Saturday',
};

const formatDayDisplay = (day) => {
  if (!day) return '';
  return SHORT_DAY_TO_FULL[day] || day;
};

const formatCommentDisplay = (value) => {
  if (!value) return '';
  const map = {
    Halfday: 'Halfday',
    fullday: 'Fullday',
    leave: 'Leave',
    'mandatory holiday': 'Mandatory Holiday',
  };
  return map[String(value).toLowerCase()] || value;
};

const TABLE_HEADER_FILL = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF2563EB' },
};

const BLACK = { argb: 'FF000000' };
const side = (style) => (style ? { style, color: BLACK } : {});
const border = (l, t, b, r) => ({ left: side(l), top: side(t), bottom: side(b), right: side(r) });

// Exact per-column (Date/Day/Hrs/Comments = index 0-3) border spec for each row
// "role" in the layout, pulled cell-by-cell from the reference file.
const BORDER_MATRIX = {
  metaFirst: [
    border('medium', 'medium', null, null),
    border(null, 'medium', null, null),
    border('thin', 'medium', 'thin', 'thin'),
    border('thin', 'medium', 'thin', 'medium'),
  ],
  metaMid: [
    border('medium', null, null, null),
    border(null, null, null, null),
    border('thin', 'thin', 'thin', 'thin'),
    border('thin', 'thin', 'thin', 'medium'),
  ],
  connectorPreHeader: [
    border('medium', null, null, null),
    border(null, null, null, null),
    border('thin', 'thin', null, 'thin'),
    border('thin', 'thin', null, 'medium'),
  ],
  header: [
    border('medium', 'medium', 'thin', 'thin'),
    border('thin', 'medium', 'thin', 'thin'),
    border('thin', 'medium', 'thin', 'thin'),
    border('thin', 'medium', 'thin', 'medium'),
  ],
  data: [
    border('medium', 'thin', 'thin', 'thin'),
    border('thin', 'thin', 'thin', 'thin'),
    border('thin', 'thin', 'thin', 'thin'),
    border('thin', 'thin', 'thin', 'medium'),
  ],
  lastData: [
    border('medium', 'thin', 'medium', 'thin'),
    border('thin', 'thin', 'medium', 'thin'),
    border('thin', 'thin', 'medium', 'thin'),
    border('thin', 'thin', 'medium', 'medium'),
  ],
  connectorPreTotal: [
    border('medium', null, null, 'thin'),
    border('thin', null, null, 'thin'),
    border(null, null, null, null),
    border('thin', null, null, 'medium'),
  ],
  // Total row: only the merged B:C anchor cell's border is set (see note in
  // generateClientTimesheetExcel) because exceljs aliases a merged cell's
  // style to its anchor -- setting borders on both halves causes the second
  // call to silently overwrite the first.
  totalAnchor: border('medium', 'medium', 'medium', 'thin'),
  totalHrs: border('thin', 'medium', 'medium', 'thin'),
  totalComments: border('thin', 'medium', 'medium', 'medium'),
  // Billing summary block: label merged B:C (matches Total row width),
  // value merged D:E (matches metadata value column width), so long
  // labels like "Rate (Hourly)" and values never overflow into a
  // neighboring cell the way the old single-column layout did.
  billingRow: border('thin', 'thin', 'thin', 'thin'),
  billingLastRow: border('thin', 'thin', 'medium', 'thin'),
};

function applyMatrixBorder(cell, rowType, colIdx) {
  cell.border = BORDER_MATRIX[rowType][colIdx];
}

function styleMetaValueCell(cell, { bold = false, center = false } = {}) {
  cell.alignment = { horizontal: center ? 'center' : 'left', vertical: 'middle' };
  if (bold) cell.font = { bold: true };
}

/**
 * Matches the client reference layout exactly:
 *  - Column A: blank margin (width 22)
 *  - Table: columns B:E, header row 9, data rows 10+
 *  - Metadata block: labels in D, values in E, rows 2-7, boxed with the
 *    same left/right medium outer edge as the table below it, plus a
 *    connector row (8) bridging it to the table header
 *  - Blank connector row after the last data row, then a Total row with a
 *    thick top/bottom frame and B:C merged
 *  - Optional billing summary block (Rate / Total Hours / Amount Due),
 *    laid out as merged label (B:C) + merged value (D:E) rows so it lines
 *    up cleanly under the table instead of overflowing a single column
 */
const generateClientTimesheetExcel = async (data, options = {}) => {
  const { includeBilling = false } = options;
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('Timesheet');

  ws.columns = [
    { width: 22 },
    { width: 7.5546875 },
    { width: 11 },
    { width: 14.77734375 },
    { width: 16.6640625 },
    { width: 10.109375 },
  ];

  const TABLE_COL_START = 2; // B
  const META_COL_LABEL = 4; // D
  const META_COL_VALUE = 5; // E
  const metaStartRow = 2;

  const metaRows = [
    ['Employee Name', data.employeeName || ''],
    ['Employee ID', data.employeeId || ''],
    ['Client', data.client || ''],
    ['Manager', data.managerName || ''],
    ['Period Type', data.periodType || ''],
    ['Period', data.periodLabel || ''],
  ];

  metaRows.forEach(([label, value], idx) => {
    const rowNum = metaStartRow + idx;
    const rowType = idx === 0 ? 'metaFirst' : 'metaMid';
    const bCell = ws.getCell(rowNum, TABLE_COL_START);
    const cCell = ws.getCell(rowNum, TABLE_COL_START + 1);
    const labelCell = ws.getCell(rowNum, META_COL_LABEL);
    const valueCell = ws.getCell(rowNum, META_COL_VALUE);
    applyMatrixBorder(bCell, rowType, 0);
    applyMatrixBorder(cCell, rowType, 1);
    applyMatrixBorder(labelCell, rowType, 2);
    applyMatrixBorder(valueCell, rowType, 3);
    labelCell.value = label;
    valueCell.value = value;
    styleMetaValueCell(valueCell, { center: true });
  });

  // Connector row bridging the metadata block to the table header
  const connectorPreHeaderRow = metaStartRow + metaRows.length; // row 8
  for (let colIdx = 0; colIdx < 4; colIdx++) {
    applyMatrixBorder(ws.getCell(connectorPreHeaderRow, TABLE_COL_START + colIdx), 'connectorPreHeader', colIdx);
  }

  const tableStartRow = connectorPreHeaderRow + 1; // row 9

  const headers = ['Date', 'Day', 'Number of Hrs', 'Comments'];
  const headerRow = ws.getRow(tableStartRow);
  headers.forEach((text, colIdx) => {
    const cell = headerRow.getCell(TABLE_COL_START + colIdx);
    cell.value = text;
    applyMatrixBorder(cell, 'header', colIdx);
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = TABLE_HEADER_FILL;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  const rows = data.rows || [];
  let totalHrs = 0;

  rows.forEach((row, idx) => {
    const hrs = parseFloat(row.hrs) || 0;
    totalHrs += hrs;
    const isLast = idx === rows.length - 1;
    const excelRow = ws.getRow(tableStartRow + 1 + idx);
    const values = [
      row.date || '',
      formatDayDisplay(row.day),
      hrs,
      formatCommentDisplay(row.comments),
    ];
    values.forEach((val, colIdx) => {
      const cell = excelRow.getCell(TABLE_COL_START + colIdx);
      cell.value = val;
      applyMatrixBorder(cell, isLast ? 'lastData' : 'data', colIdx);
      cell.alignment = { horizontal: colIdx === 3 ? 'left' : 'center', vertical: 'middle' };
    });
  });

  // Blank connector row (side borders only, no top/bottom), then Total row
  const blankRowNum = tableStartRow + 1 + rows.length;
  const totalRowNum = blankRowNum + 1;

  for (let colIdx = 0; colIdx < 4; colIdx++) {
    applyMatrixBorder(ws.getCell(blankRowNum, TABLE_COL_START + colIdx), 'connectorPreTotal', colIdx);
  }

  // Merge FIRST, then style only the anchor cell (B18) -- see note on
  // totalAnchor above for why the C18 half must not be styled separately.
  ws.mergeCells(totalRowNum, TABLE_COL_START, totalRowNum, TABLE_COL_START + 1); // B:C
  const totalLabelCell = ws.getCell(totalRowNum, TABLE_COL_START);
  totalLabelCell.value = 'Total';
  totalLabelCell.border = BORDER_MATRIX.totalAnchor;
  totalLabelCell.font = { bold: true };
  totalLabelCell.alignment = { horizontal: 'center', vertical: 'middle' };

  const totalHrsCell = ws.getCell(totalRowNum, TABLE_COL_START + 2); // D
  const firstDataRow = tableStartRow + 1;
  const lastDataRow = tableStartRow + rows.length;
  totalHrsCell.value = { formula: `SUM(D${firstDataRow}:D${lastDataRow})`, result: totalHrs };
  totalHrsCell.border = BORDER_MATRIX.totalHrs;
  totalHrsCell.font = { bold: true };
  totalHrsCell.alignment = { horizontal: 'center', vertical: 'middle' };

  const totalCommentsCell = ws.getCell(totalRowNum, TABLE_COL_START + 3); // E
  totalCommentsCell.border = BORDER_MATRIX.totalComments;

  if (includeBilling && data.rateValue != null && data.totalWage != null) {
    const rateLabel = `Rate (${data.rateType || 'Hourly'})`;
    const billingRows = [
      [rateLabel, Number(data.rateValue).toFixed(2)],
      ['Total Hours', totalHrs],
      ['Amount Due', Number(data.totalWage).toFixed(2)],
    ];
    let billingRow = totalRowNum + 2;

    billingRows.forEach(([label, value], idx) => {
      const rowNum = billingRow + idx;
      const isLast = idx === billingRows.length - 1;

      // Label spans B:C, value spans D:E -- same column grouping as the
      // metadata block above, so nothing overflows and everything lines
      // up under the table regardless of label length.
      ws.mergeCells(rowNum, TABLE_COL_START, rowNum, TABLE_COL_START + 1);
      ws.mergeCells(rowNum, META_COL_LABEL, rowNum, META_COL_VALUE);

      const labelCell = ws.getCell(rowNum, TABLE_COL_START);
      const valueCell = ws.getCell(rowNum, META_COL_LABEL);

      labelCell.value = label;
      valueCell.value = value;
      labelCell.border = isLast ? BORDER_MATRIX.billingLastRow : BORDER_MATRIX.billingRow;
      valueCell.border = isLast ? BORDER_MATRIX.billingLastRow : BORDER_MATRIX.billingRow;
      labelCell.alignment = { horizontal: 'left', vertical: 'middle' };
      valueCell.alignment = { horizontal: 'center', vertical: 'middle' };

      if (isLast) {
        labelCell.font = { bold: true };
        valueCell.font = { bold: true };
      }
    });
  }

  const safePeriod = (data.periodLabel || 'timesheet').replace(/[^\w\-]/g, '_');
  const safeEmpId = (data.employeeId || 'employee').replace(/[^\w\-]/g, '_');
  const filename = `Timesheet_${safeEmpId}_${safePeriod}.xlsx`;

  const buffer = await workbook.xlsx.writeBuffer();
  return { buffer, filename, totalHrs };
};

/** @deprecated Use generateClientTimesheetExcel -- kept as alias for export endpoint. */
const generateTimesheetExcel = generateClientTimesheetExcel;

module.exports = {
  exportToExcel,
  generateClientTimesheetExcel,
  generateTimesheetExcel,
  formatDayDisplay,
  formatCommentDisplay,
};