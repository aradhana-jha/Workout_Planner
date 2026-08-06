import { PrismaClient } from '@prisma/client';
import XLSX from 'xlsx';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { COMMON_GYM_EXERCISES } from './gym-exercise-library.mjs';

const prisma = new PrismaClient();
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const libraryPath = path.resolve(currentDir, './exercise-library.json');
const workbookPath = path.resolve(currentDir, '../home_exercise_library.xlsx');
const dryRun = process.argv.includes('--dry-run');

function yes(value) {
    return String(value || '').trim().toLowerCase() === 'yes';
}

function toJsonArray(values) {
    return JSON.stringify(values.filter(Boolean));
}

function normalizeArray(value, fallback = []) {
    if (Array.isArray(value)) return value.map((item) => String(item)).filter(Boolean);
    if (typeof value === 'string') {
        return value
            .split(/[;,]/)
            .map((item) => item.trim())
            .filter(Boolean);
    }
    return fallback;
}

function normalizeExercise(exercise) {
    return {
        externalId: exercise.externalId ? String(exercise.externalId) : null,
        name: exercise.name ? String(exercise.name) : 'Unknown Exercise',
        description: exercise.description ? String(exercise.description) : null,
        videoUrl: exercise.videoUrl ? String(exercise.videoUrl) : null,
        isActive: exercise.isActive !== false,
        difficultyMin: String(exercise.difficultyMin || 'beginner').toLowerCase(),
        difficultyMax: String(exercise.difficultyMax || 'advanced').toLowerCase(),
        equipmentTags: toJsonArray(normalizeArray(exercise.equipmentTags, ['No equipment'])),
        workoutType: exercise.workoutType ? String(exercise.workoutType) : 'Strength training',
        movementPattern: exercise.movementPattern ? String(exercise.movementPattern) : 'General',
        focusAreaTags: toJsonArray(normalizeArray(exercise.focusAreaTags)),
        impactLevel: String(exercise.impactLevel || 'low').toLowerCase(),
        avoidModifyFlags: toJsonArray(normalizeArray(exercise.avoidModifyFlags)),
        preferenceExclusionFlags: toJsonArray(normalizeArray(exercise.preferenceExclusionFlags)),
        phaseTags: toJsonArray(normalizeArray(exercise.phaseTags, ['Main exercise'])),
        easierVariationId: exercise.easierVariationId ? String(exercise.easierVariationId) : null,
        harderVariationId: exercise.harderVariationId ? String(exercise.harderVariationId) : null,
        notes: exercise.notes ? String(exercise.notes) : exercise.description ? String(exercise.description) : null,
    };
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
        isActive: true,
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
    let rows;
    let sourceName;

    if (fs.existsSync(libraryPath)) {
        rows = [
            ...JSON.parse(fs.readFileSync(libraryPath, 'utf8')),
            ...COMMON_GYM_EXERCISES,
        ].map(normalizeExercise);
        sourceName = path.basename(libraryPath);
    } else {
        const workbook = XLSX.readFile(workbookPath);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json(sheet).map(buildExercise);
        sourceName = path.basename(workbookPath);
    }

    if (rows.length === 0) {
        throw new Error(`No exercises found in ${sourceName}`);
    }

    let count = 0;
    const activeExternalIds = [];
    for (const row of rows) {
        const exercise = row.externalId || row.equipmentTags ? row : buildExercise(row);
        if (exercise.externalId) activeExternalIds.push(exercise.externalId);
        if (!dryRun) {
            await upsertExercise(exercise);
        }
        count += 1;
    }

    // Preserve exercises referenced by historical plans, but remove obsolete GYM
    // entries from the active catalogue used to build every new plan.
    if (!dryRun) {
        await prisma.exercise.updateMany({
            where: {
                externalId: { startsWith: 'GYM', notIn: activeExternalIds },
            },
            data: { isActive: false },
        });
    }

    console.log(`${dryRun ? 'Validated' : 'Seeded'} ${count} exercises from ${sourceName}`);
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
