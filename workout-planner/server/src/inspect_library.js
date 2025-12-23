const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const workbook = XLSX.readFile(path.join(__dirname, '../../../home_exercise_library.xlsx'));
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(sheet);

console.log(JSON.stringify(data.slice(0, 5), null, 2));
console.log('Total exercises:', data.length);
console.log('Columns:', Object.keys(data[0]));
