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

const generateTimesheetExcel = async (data) => {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('Timesheet');
  const rate = parseFloat(data.rateValue) || 0;
  const totalHrs = (data.rows || []).reduce((sum, r) => sum + (parseFloat(r.hrs) || 0), 0);
  const totalWage = totalHrs * rate;

  const headerStyle = { font: { bold: true } };
  const tableHeaderFill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF2563EB' },
  };

  ws.columns = [
    { width: 22 },
    { width: 28 },
  ];

  ws.addRow(['Employee Name', data.employeeName || '']).eachCell((cell) => { cell.font = headerStyle.font; });
  ws.addRow(['Employee ID', data.employeeId || '']).eachCell((cell) => { cell.font = headerStyle.font; });
  ws.addRow(['Client', data.client || '']).eachCell((cell) => { cell.font = headerStyle.font; });
  ws.addRow(['Manager', data.managerName || '']).eachCell((cell) => { cell.font = headerStyle.font; });
  ws.addRow(['Rate Type', data.rateType || '']).eachCell((cell) => { cell.font = headerStyle.font; });
  ws.addRow(['Rate Value', data.rateValue || 0]).eachCell((cell) => { cell.font = headerStyle.font; });
  ws.addRow(['Period Type', data.periodType || '']).eachCell((cell) => { cell.font = headerStyle.font; });
  ws.addRow(['Period', data.periodLabel || '']).eachCell((cell) => { cell.font = headerStyle.font; });
  ws.addRow([]);

  const tableHeaderRow = ws.addRow(['Date', 'Day', 'Task Description', 'Hrs', 'Total Wage']);
  tableHeaderRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = tableHeaderFill;
    cell.alignment = { horizontal: 'center' };
  });

  ws.getColumn(3).width = 40;
  ws.getColumn(4).width = 10;
  ws.getColumn(5).width = 14;

  (data.rows || []).forEach((row) => {
    const hrs = parseFloat(row.hrs) || 0;
    ws.addRow([
      row.date || '',
      row.day || '',
      row.task || '',
      hrs,
      (hrs * rate).toFixed(2),
    ]);
  });

  const totalRow = ws.addRow(['', '', 'Total', totalHrs, totalWage.toFixed(2)]);
  totalRow.eachCell((cell) => { cell.font = { bold: true }; });

  const safePeriod = (data.periodLabel || 'timesheet').replace(/[^\w\-]/g, '_');
  const safeEmpId = (data.employeeId || 'employee').replace(/[^\w\-]/g, '_');
  const filename = `Timesheet_${safeEmpId}_${safePeriod}.xlsx`;

  const buffer = await workbook.xlsx.writeBuffer();
  return { buffer, filename };
};

module.exports = { exportToExcel, generateTimesheetExcel };
