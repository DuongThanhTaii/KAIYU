const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, 'BẢNG-TỪ-VỰNG-HSK.xlsx');
const workbook = XLSX.readFile(filePath);

console.log('=== SHEET NAMES ===');
console.log(workbook.SheetNames);
console.log('\nTotal sheets:', workbook.SheetNames.length);

workbook.SheetNames.forEach((sheetName, idx) => {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`SHEET ${idx + 1}: "${sheetName}"`);
    console.log('='.repeat(60));

    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    if (jsonData.length === 0) {
        console.log('(Empty sheet)');
        return;
    }

    // Show headers (first row)
    const headers = jsonData[0];
    console.log('\nHeaders:', JSON.stringify(headers));
    console.log('Total rows (including header):', jsonData.length);
    console.log('Data rows:', jsonData.length - 1);

    // Show first 3 data rows as sample
    console.log('\nSample data (first 3 rows):');
    for (let i = 1; i <= Math.min(3, jsonData.length - 1); i++) {
        const row = jsonData[i];
        console.log(`  Row ${i}:`, JSON.stringify(row));
    }
});
