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

const generateExperienceLetterPDF = (employee, resignation, outputPath) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);

    doc.fontSize(20).text('EXPERIENCE LETTER', { align: 'center' });
    doc.moveDown(2);
    doc.fontSize(12);
    doc.text(`Date: ${new Date().toLocaleDateString('en-IN')}`);
    doc.moveDown();
    doc.text(`To Whom It May Concern,`);
    doc.moveDown();
    doc.text(
      `This is to certify that ${employee.first_name} ${employee.last_name} (Employee ID: ${employee.employee_id}) ` +
      `was employed with our organization as ${employee.designation || 'Employee'} from ${employee.joining_date ? new Date(employee.joining_date).toLocaleDateString('en-IN') : 'N/A'} ` +
      `to ${resignation.last_working_date ? new Date(resignation.last_working_date).toLocaleDateString('en-IN') : 'N/A'}.`
    );
    doc.moveDown();
    doc.text('During their tenure, they performed their duties with dedication and professionalism.');
    doc.moveDown();
    doc.text('We wish them success in their future endeavors.');
    doc.moveDown(2);
    doc.text('Authorized Signatory');
    doc.text('Human Resources Department');

    doc.end();
    stream.on('finish', () => resolve(outputPath));
    stream.on('error', reject);
  });
};

const generateRelievingLetterPDF = (employee, resignation, outputPath) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);

    doc.fontSize(20).text('RELIEVING LETTER', { align: 'center' });
    doc.moveDown(2);
    doc.fontSize(12);
    doc.text(`Date: ${new Date().toLocaleDateString('en-IN')}`);
    doc.moveDown();
    doc.text(`Dear ${employee.first_name} ${employee.last_name},`);
    doc.moveDown();
    doc.text(
      `This letter confirms that you have been relieved from your duties effective ` +
      `${resignation.last_working_date ? new Date(resignation.last_working_date).toLocaleDateString('en-IN') : 'today'}. ` +
      `We acknowledge receipt of your resignation and confirm that all company assets have been returned.`
    );
    doc.moveDown();
    doc.text('We thank you for your contributions to the organization.');
    doc.moveDown(2);
    doc.text('Authorized Signatory');
    doc.text('Human Resources Department');

    doc.end();
    stream.on('finish', () => resolve(outputPath));
    stream.on('error', reject);
  });
};

module.exports = { generatePayslipPDF, generateExperienceLetterPDF, generateRelievingLetterPDF };
