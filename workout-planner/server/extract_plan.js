const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const filePath = 'C:\\Users\\jhaaa\\OneDrive\\Documents\\Coding projeect\\Workout_Planner_App\\Exercise Plan.xlsx';

try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = 'Muscle gain '; // Corrected sheet name

    if (!workbook.Sheets[sheetName]) {
        console.error(`Sheet "${sheetName}" not found. Available sheets: ${workbook.SheetNames.join(', ')}`);
        process.exit(1);
    }

    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet);

    console.log(JSON.stringify(data, null, 2));

} catch (error) {
    console.error("Error reading file:", error);
}
