import fs from 'node:fs';
import { COMMON_GYM_EXERCISES } from '../../prisma/gym-exercise-library.mjs';

const homeExercises = JSON.parse(fs.readFileSync(new URL('../../prisma/exercise-library.json', import.meta.url), 'utf8'));
const exercises = [...homeExercises, ...COMMON_GYM_EXERCISES];
const errors = [];
const ids = new Set();
const names = new Set();
const supportedEquipment = new Set([
    'No equipment', 'Resistance bands', 'Dumbbells', 'Kettlebell',
    'Barbell and weight plates', 'Squat rack', 'Bench', 'Pull-up bar', 'Treadmill',
]);

for (const exercise of exercises) {
    if (!exercise.externalId || ids.has(exercise.externalId)) errors.push(`Invalid or duplicate id: ${exercise.externalId}`);
    if (!exercise.name || names.has(exercise.name.toLowerCase())) errors.push(`Invalid or duplicate name: ${exercise.name}`);
    ids.add(exercise.externalId);
    names.add(exercise.name.toLowerCase());

    const requiredArrayFields = (exercise.notes || '').includes('quality:legacy')
        ? ['equipmentTags', 'focusAreaTags']
        : ['equipmentTags', 'focusAreaTags', 'phaseTags'];
    for (const key of requiredArrayFields) {
        if (!Array.isArray(exercise[key]) || exercise[key].length === 0) errors.push(`${exercise.name}: missing ${key}`);
    }

    const unsupported = exercise.equipmentTags.filter(tag => !supportedEquipment.has(tag));
    if (unsupported.length > 0) errors.push(`${exercise.name}: unsupported equipment ${unsupported.join(', ')}`);
}

const gymNames = new Set(COMMON_GYM_EXERCISES.map(exercise => exercise.name));
const noEquipmentEligible = exercises.filter(exercise => exercise.equipmentTags.includes('No equipment'));
const leakedGymExercises = noEquipmentEligible.filter(exercise => gymNames.has(exercise.name));
if (leakedGymExercises.length > 0) errors.push(`Gym exercises leaked into bodyweight pool: ${leakedGymExercises.map(item => item.name).join(', ')}`);

const requiredGymFamilies = {
    legs: ['Dumbbell walking lunge', 'Dumbbell step-up', 'Kettlebell goblet squat'],
    glutes: ['Dumbbell Romanian deadlift', 'Dumbbell glute bridge', 'Kettlebell deadlift'],
    chest: ['Dumbbell bench press', 'Incline dumbbell press', 'Kettlebell floor press'],
    back: ['One-arm kettlebell row'],
    arms: ['Dumbbell biceps curl', 'Dumbbell triceps extension'],
    fullBody: ['Farmer carry', 'Kettlebell suitcase carry'],
};

for (const [family, requiredNames] of Object.entries(requiredGymFamilies)) {
    const missing = requiredNames.filter(name => !names.has(name.toLowerCase()));
    if (missing.length > 0) errors.push(`${family}: missing ${missing.join(', ')}`);
}

const summary = {
    totalExercises: exercises.length,
    homeLibrary: homeExercises.length,
    simpleEquipmentLibrary: COMMON_GYM_EXERCISES.length,
    bodyweightEligible: noEquipmentEligible.length,
    simpleEquipmentExercisesWithoutVideo: COMMON_GYM_EXERCISES.filter(exercise => !exercise.videoUrl).length,
    equipment: [...new Set(exercises.flatMap(exercise => exercise.equipmentTags))].sort(),
    errors,
};

console.log(JSON.stringify(summary, null, 2));
if (errors.length > 0) process.exitCode = 1;
