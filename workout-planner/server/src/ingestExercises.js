/**
 * Exercise Library Ingestion Script
 * 
 * Imports exercises from home_exercise_library.xlsx into the database.
 * Run with: node src/ingestExercises.js
 */

const { PrismaClient } = require('@prisma/client');
const XLSX = require('xlsx');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
    console.log('Starting exercise ingestion...');

    // Load the Excel file
    const workbook = XLSX.readFile(path.join(__dirname, '../../../home_exercise_library.xlsx'));
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet);

    console.log(`Found ${rows.length} exercises in the Excel file.`);

    // Clear existing exercises
    await prisma.workoutExercise.deleteMany({});
    await prisma.exercise.deleteMany({});
    console.log('Cleared existing exercises.');

    let successCount = 0;
    let errorCount = 0;

    for (const row of rows) {
        try {
            // Map Excel columns to database fields
            const exercise = {
                externalId: row['Exercise ID'] || null,
                name: row['Exercise Name'] || 'Unknown Exercise',
                description: row['Notes'] || row['Description'] || null,
                videoUrl: null,

                // Difficulty range
                difficultyMin: (row['Difficulty Min'] || 'beginner').toLowerCase(),
                difficultyMax: (row['Difficulty Max'] || 'advanced').toLowerCase(),

                // Equipment - parse semicolon-separated values into JSON array
                equipmentTags: JSON.stringify(parseMultiValue(row['Equipment Tags'])),

                // Type
                workoutType: row['Workout Type'] || 'Strength training',

                // Movement pattern
                movementPattern: row['Movement Pattern'] || 'General',

                // Focus areas
                focusAreaTags: JSON.stringify(parseMultiValue(row['Focus Area Tags'])),

                // Impact level
                impactLevel: (row['Impact Level'] || 'low').toLowerCase(),

                // Avoid/Modify flags - pain areas that should avoid this exercise
                avoidModifyFlags: JSON.stringify(parseMultiValue(row['Avoid/Modify Flags'])),

                // Preference exclusion flags
                preferenceExclusionFlags: JSON.stringify(parseMultiValue(row['Preference Exclusion Flags'])),

                // Phase tags
                phaseTags: JSON.stringify(parseMultiValue(row['Phase Tags'])),

                // Variation links
                easierVariationId: row['Easier Variation ID'] || null,
                harderVariationId: row['Harder Variation ID'] || null,

                // Notes
                notes: row['Notes'] || null,
            };

            await prisma.exercise.create({ data: exercise });
            successCount++;
        } catch (error) {
            console.error(`Error importing exercise "${row['Exercise Name']}":`, error.message);
            errorCount++;
        }
    }

    console.log(`\nIngestion complete!`);
    console.log(`Successfully imported: ${successCount} exercises`);
    console.log(`Errors: ${errorCount}`);
}

/**
 * Parse multi-value fields (semicolon-separated) into an array
 */
function parseMultiValue(value) {
    if (!value) return [];
    if (typeof value !== 'string') return [String(value)];
    return value.split(';').map(v => v.trim()).filter(v => v.length > 0);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
