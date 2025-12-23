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
            // Build equipment tags from individual columns
            const equipmentTags = [];
            if (row['No equipment'] === 'Yes') equipmentTags.push('No equipment');
            if (row['Resistance bands'] === 'Yes') equipmentTags.push('Resistance bands');
            if (row['Dumbbells'] === 'Yes') equipmentTags.push('Dumbbells');
            if (row['Kettlebell'] === 'Yes') equipmentTags.push('Kettlebell');
            if (row['Barbell and weight plates'] === 'Yes') equipmentTags.push('Barbell and weight plates');
            if (row['Pull-up bar'] === 'Yes') equipmentTags.push('Pull-up bar');
            if (row['Bench'] === 'Yes') equipmentTags.push('Bench');
            if (row['Cardio machine'] === 'Yes') equipmentTags.push('Cardio machine');

            // If no equipment specified, default to "No equipment"
            if (equipmentTags.length === 0) {
                equipmentTags.push('No equipment');
            }

            // Build preference exclusion flags
            const preferenceExclusionFlags = [];
            if (row['Avoid running'] === 'Yes') preferenceExclusionFlags.push('Running');
            if (row['Avoid jumping'] === 'Yes') preferenceExclusionFlags.push('Jumping');
            if (row['Avoid burpees'] === 'Yes') preferenceExclusionFlags.push('Burpees');
            if (row['Avoid long workouts'] === 'Yes') preferenceExclusionFlags.push('Long workouts');
            if (row['Avoid heavy lifting'] === 'Yes') preferenceExclusionFlags.push('Heavy lifting');

            // Build phase tags
            const phaseTags = [];
            if (row['Stretching tag'] === 'Yes') phaseTags.push('Stretching');
            if (row['Main exercise tag'] === 'Yes') phaseTags.push('Main exercise');
            if (row['Cool off tag'] === 'Yes') phaseTags.push('Cool off');

            // Parse avoid/modify notes for pain areas
            const avoidModifyFlags = [];
            const avoidNotes = (row['Avoid or modify notes'] || '').toLowerCase();
            if (avoidNotes.includes('lower back') || avoidNotes.includes('back')) avoidModifyFlags.push('Lower back');
            if (avoidNotes.includes('knee')) avoidModifyFlags.push('Knees');
            if (avoidNotes.includes('shoulder')) avoidModifyFlags.push('Shoulders');
            if (avoidNotes.includes('neck')) avoidModifyFlags.push('Neck');
            if (avoidNotes.includes('wrist')) avoidModifyFlags.push('Wrists');
            if (avoidNotes.includes('ankle')) avoidModifyFlags.push('Ankles');

            // Parse focus areas
            const focusAreas = (row['Focus areas'] || '')
                .split(',')
                .map(f => f.trim())
                .filter(f => f.length > 0);

            // Map Excel columns to database fields
            const exercise = {
                externalId: row['Exercise ID'] || null,
                name: row['Exercise name'] || 'Unknown Exercise',
                description: row['Coaching notes'] || null,
                videoUrl: null,

                // Difficulty range
                difficultyMin: (row['Minimum experience level'] || 'beginner').toLowerCase(),
                difficultyMax: (row['Maximum experience level'] || 'advanced').toLowerCase(),

                // Equipment
                equipmentTags: JSON.stringify(equipmentTags),

                // Type
                workoutType: row['Workout type'] || 'Strength training',

                // Movement pattern
                movementPattern: row['Movement pattern'] || 'General',

                // Focus areas
                focusAreaTags: JSON.stringify(focusAreas),

                // Impact level
                impactLevel: (row['Impact level'] || 'low').toLowerCase(),

                // Avoid/Modify flags
                avoidModifyFlags: JSON.stringify(avoidModifyFlags),

                // Preference exclusion flags
                preferenceExclusionFlags: JSON.stringify(preferenceExclusionFlags),

                // Phase tags
                phaseTags: JSON.stringify(phaseTags),

                // Variation links
                easierVariationId: row['Easier variation exercise ID'] || null,
                harderVariationId: row['Harder variation exercise ID'] || null,

                // Notes
                notes: row['Coaching notes'] || null,
            };

            await prisma.exercise.create({ data: exercise });
            successCount++;
            console.log(`  ✓ Imported: ${exercise.name}`);
        } catch (error) {
            console.error(`  ✗ Error importing exercise "${row['Exercise name']}":`, error.message);
            errorCount++;
        }
    }

    console.log(`\nIngestion complete!`);
    console.log(`Successfully imported: ${successCount} exercises`);
    console.log(`Errors: ${errorCount}`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
