import { PrismaClient } from '@prisma/client';
import XLSX from 'xlsx';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const prisma = new PrismaClient();
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const workbookPath = path.resolve(currentDir, '../home_exercise_library.xlsx');
const dryRun = process.argv.includes('--dry-run');

function yes(value) {
    return String(value || '').trim().toLowerCase() === 'yes';
}

function toJsonArray(values) {
    return JSON.stringify(values.filter(Boolean));
}

function buildExercise(row) {
    const equipmentTags = [];
    if (yes(row['No equipment'])) equipmentTags.push('No equipment');
    if (yes(row['Resistance bands'])) equipmentTags.push('Resistance bands');
    if (yes(row['Dumbbells'])) equipmentTags.push('Dumbbells');
    if (yes(row['Kettlebell'])) equipmentTags.push('Kettlebell');
    if (yes(row['Barbell and weight plates'])) equipmentTags.push('Barbell and weight plates');
    if (yes(row['Pull-up bar'])) equipmentTags.push('Pull-up bar');
    if (yes(row['Bench'])) equipmentTags.push('Bench');
    if (yes(row['Cardio machine'])) equipmentTags.push('Cardio machine');
    if (equipmentTags.length === 0) equipmentTags.push('No equipment');

    const preferenceExclusionFlags = [];
    if (yes(row['Avoid running'])) preferenceExclusionFlags.push('Running');
    if (yes(row['Avoid jumping'])) preferenceExclusionFlags.push('Jumping');
    if (yes(row['Avoid burpees'])) preferenceExclusionFlags.push('Burpees');
    if (yes(row['Avoid long workouts'])) preferenceExclusionFlags.push('Long workouts');
    if (yes(row['Avoid heavy lifting'])) preferenceExclusionFlags.push('Heavy lifting');

    const phaseTags = [];
    if (yes(row['Stretching tag'])) phaseTags.push('Stretching');
    if (yes(row['Main exercise tag'])) phaseTags.push('Main exercise');
    if (yes(row['Cool off tag'])) phaseTags.push('Cool off');

    const avoidModifyFlags = [];
    const avoidNotes = String(row['Avoid or modify notes'] || '').toLowerCase();
    if (avoidNotes.includes('lower back') || avoidNotes.includes('back')) avoidModifyFlags.push('Lower back');
    if (avoidNotes.includes('knee')) avoidModifyFlags.push('Knees');
    if (avoidNotes.includes('shoulder')) avoidModifyFlags.push('Shoulders');
    if (avoidNotes.includes('neck')) avoidModifyFlags.push('Neck');
    if (avoidNotes.includes('wrist')) avoidModifyFlags.push('Wrists');
    if (avoidNotes.includes('ankle')) avoidModifyFlags.push('Ankles');

    const focusAreas = String(row['Focus areas'] || '')
        .split(',')
        .map((focus) => focus.trim())
        .filter(Boolean);

    return {
        externalId: row['Exercise ID'] ? String(row['Exercise ID']) : null,
        name: row['Exercise name'] ? String(row['Exercise name']) : 'Unknown Exercise',
        description: row['Coaching notes'] ? String(row['Coaching notes']) : null,
        videoUrl: null,
        difficultyMin: String(row['Minimum experience level'] || 'beginner').toLowerCase(),
        difficultyMax: String(row['Maximum experience level'] || 'advanced').toLowerCase(),
        equipmentTags: toJsonArray(equipmentTags),
        workoutType: row['Workout type'] ? String(row['Workout type']) : 'Strength training',
        movementPattern: row['Movement pattern'] ? String(row['Movement pattern']) : 'General',
        focusAreaTags: toJsonArray(focusAreas),
        impactLevel: String(row['Impact level'] || 'low').toLowerCase(),
        avoidModifyFlags: toJsonArray(avoidModifyFlags),
        preferenceExclusionFlags: toJsonArray(preferenceExclusionFlags),
        phaseTags: toJsonArray(phaseTags),
        easierVariationId: row['Easier variation exercise ID'] ? String(row['Easier variation exercise ID']) : null,
        harderVariationId: row['Harder variation exercise ID'] ? String(row['Harder variation exercise ID']) : null,
        notes: row['Coaching notes'] ? String(row['Coaching notes']) : null,
    };
}

async function upsertExercise(exercise) {
    if (exercise.externalId) {
        await prisma.exercise.upsert({
            where: { externalId: exercise.externalId },
            update: exercise,
            create: exercise,
        });
        return;
    }

    const existing = await prisma.exercise.findFirst({ where: { name: exercise.name } });
    if (existing) {
        await prisma.exercise.update({ where: { id: existing.id }, data: exercise });
        return;
    }

    await prisma.exercise.create({ data: exercise });
}

async function main() {
    const workbook = XLSX.readFile(workbookPath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);

    if (rows.length === 0) {
        throw new Error(`No exercises found in ${workbookPath}`);
    }

    let count = 0;
    for (const row of rows) {
        const exercise = buildExercise(row);
        if (!dryRun) {
            await upsertExercise(exercise);
        }
        count += 1;
    }

    console.log(`${dryRun ? 'Validated' : 'Seeded'} ${count} exercises from ${path.basename(workbookPath)}`);
}

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        if (!dryRun) {
            await prisma.$disconnect();
        }
    });
