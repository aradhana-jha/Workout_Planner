const { PrismaClient } = require('@prisma/client');
const XLSX = require('xlsx');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
    const workbook = XLSX.readFile(path.join(__dirname, '../../../home_exercise_library.xlsx'));
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet);

    console.log(`Starting ingestion of ${data.length} exercises...`);

    for (const row of data) {
        const equipment = [];
        if (row['No equipment'] === 'Yes') equipment.push('No equipment');
        if (row['Resistance bands'] === 'Yes') equipment.push('Resistance bands');
        if (row['Dumbbells'] === 'Yes') equipment.push('Dumbbells');
        if (row['Kettlebell'] === 'Yes') equipment.push('Kettlebell');
        if (row['Barbell and weight plates'] === 'Yes') equipment.push('Barbell and weight plates');
        if (row['Pull-up bar'] === 'Yes') equipment.push('Pull-up bar');
        if (row['Bench'] === 'Yes') equipment.push('Bench');
        if (row['Cardio machine'] === 'Yes') equipment.push('Cardio machine');

        const phaseTags = row['Phase tags'] ? row['Phase tags'].split(',').map((t) => t.trim()) : [];
        const focusAreas = row['Focus areas'] ? row['Focus areas'].split(',').map((t) => t.trim()) : [];

        // EXCLUSION FLAGS
        const exclusions = [];
        if (row['Avoid running'] === 'Yes') exclusions.push('Running');
        if (row['Avoid jumping'] === 'Yes') exclusions.push('Jumping');
        if (row['Avoid burpees'] === 'Yes') exclusions.push('Burpees');
        if (row['Avoid long workouts'] === 'Yes') exclusions.push('Long workouts');
        if (row['Avoid heavy lifting'] === 'Yes') exclusions.push('Heavy lifting');

        // PAIN FLAGS (parsing from notes or hardcoded if logic exists)
        // For V1, the user wants us to use the "Avoid or modify notes" but also mentions specific pain areas.
        // Let's store the notes in a way that we can filter.
        const avoidFlags = [];
        const notesStr = (row['Avoid or modify notes'] || '').toLowerCase();
        if (notesStr.includes('knee')) avoidFlags.push('Knees');
        if (notesStr.includes('back')) avoidFlags.push('Lower back');
        if (notesStr.includes('shoulder')) avoidFlags.push('Shoulders');
        if (notesStr.includes('neck')) avoidFlags.push('Neck');
        if (notesStr.includes('wrist')) avoidFlags.push('Wrists');
        if (notesStr.includes('ankle')) avoidFlags.push('Ankles');

        await prisma.exercise.create({
            data: {
                externalId: row['Exercise ID'],
                name: row['Exercise name'],
                description: row['Coaching notes'], // Use coaching notes as description if empty
                difficultyMin: (row['Minimum experience level'] || 'beginner').toLowerCase(),
                difficultyMax: (row['Maximum experience level'] || 'advanced').toLowerCase(),
                equipmentTags: JSON.stringify(equipment),
                workoutType: row['Workout type'],
                movementPattern: row['Movement pattern'],
                focusAreaTags: JSON.stringify(focusAreas),
                impactLevel: (row['Impact level'] || 'low').toLowerCase(),
                avoidModifyFlags: JSON.stringify(avoidFlags),
                preferenceExclusionFlags: JSON.stringify(exclusions),
                phaseTags: JSON.stringify(phaseTags),
                easierVariationId: row['Easier variation exercise ID'] || null,
                harderVariationId: row['Harder variation exercise ID'] || null,
                notes: row['Coaching notes']
            }
        });
    }
    console.log('Successfully imported', data.length, 'exercises');
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
