const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const generatePayslipPDF = (payslip, employee, outputPath) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);

    doc.fontSize(20).text('PAYSLIP', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12);
    doc.text(`Employee: ${employee.first_name} ${employee.last_name}`);
    doc.text(`Employee ID: ${employee.employee_id}`);
    doc.text(`Period: ${payslip.month}/${payslip.year}`);
    doc.moveDown();

    doc.text('Earnings', { underline: true });
    doc.text(`Basic Salary: ₹${Number(payslip.basic_salary).toLocaleString()}`);
    doc.text(`HRA: ₹${Number(payslip.hra).toLocaleString()}`);
    doc.text(`Transport: ₹${Number(payslip.transport_allowance).toLocaleString()}`);
    doc.text(`Medical: ₹${Number(payslip.medical_allowance).toLocaleString()}`);
    doc.text(`Special: ₹${Number(payslip.special_allowance).toLocaleString()}`);
    doc.text(`Gross Salary: ₹${Number(payslip.gross_salary).toLocaleString()}`);
    doc.moveDown();

    doc.text('Deductions', { underline: true });
    doc.text(`PF: ₹${Number(payslip.pf_deduction).toLocaleString()}`);
    doc.text(`Tax: ₹${Number(payslip.tax_deduction).toLocaleString()}`);
    doc.text(`Other: ₹${Number(payslip.other_deductions).toLocaleString()}`);
    doc.moveDown();

    doc.fontSize(14).text(`Net Salary: ₹${Number(payslip.net_salary).toLocaleString()}`, { align: 'right' });

    doc.end();
    stream.on('finish', () => resolve(outputPath));
    stream.on('error', reject);
  });
};

module.exports = { generatePayslipPDF };
