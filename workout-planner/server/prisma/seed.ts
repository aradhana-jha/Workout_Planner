import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const exercises = [
    { name: 'Push Up', description: 'Standard push up', difficulty: 'beginner', muscleGroup: 'chest' },
    { name: 'Squat', description: 'Bodyweight squat', difficulty: 'beginner', muscleGroup: 'legs' },
    { name: 'Lunge', description: 'Forward lunge', difficulty: 'beginner', muscleGroup: 'legs' },
    { name: 'Plank', description: 'Forearm plank', difficulty: 'beginner', muscleGroup: 'core' },
    { name: 'Burpee', description: 'Full body explosive movement', difficulty: 'intermediate', muscleGroup: 'full_body' },
    { name: 'Mountain Climber', description: 'Knees to chest in plank', difficulty: 'intermediate', muscleGroup: 'core' },
    { name: 'Jumping Jack', description: 'Cardio warmup', difficulty: 'beginner', muscleGroup: 'full_body' },
    { name: 'Glute Bridge', description: 'Hips raise from floor', difficulty: 'beginner', muscleGroup: 'legs' },
    { name: 'Tricep Dip', description: 'Dip using chair or floor', difficulty: 'beginner', muscleGroup: 'chest' },
    { name: 'High Knees', description: 'Running in place', difficulty: 'beginner', muscleGroup: 'full_body' },
    { name: 'Russian Twist', description: 'Seated torso twist', difficulty: 'intermediate', muscleGroup: 'core' },
    { name: 'Leg Raise', description: 'Lying leg lift', difficulty: 'intermediate', muscleGroup: 'core' },
    { name: 'Wall Sit', description: 'Static squat against wall', difficulty: 'beginner', muscleGroup: 'legs' },
    { name: 'Step Up', description: 'Step onto chair/box', difficulty: 'beginner', muscleGroup: 'legs' },
    { name: 'Calf Raise', description: 'Heel raise standing', difficulty: 'beginner', muscleGroup: 'legs' },
    { name: 'Superman', description: 'Lying back extension', difficulty: 'beginner', muscleGroup: 'core' },
    { name: 'Side Plank', description: 'One arm plank', difficulty: 'intermediate', muscleGroup: 'core' },
    { name: 'Diamond Push Up', description: 'Hands close together', difficulty: 'advanced', muscleGroup: 'chest' },
    { name: 'Pike Push Up', description: 'Hips high push up', difficulty: 'intermediate', muscleGroup: 'chest' },
    { name: 'Jump Squat', description: 'Explosive squat', difficulty: 'intermediate', muscleGroup: 'legs' },
    { name: 'Bicycle Crunch', description: 'Elbow to opposite knee', difficulty: 'intermediate', muscleGroup: 'core' },
    { name: 'Inchworm', description: 'Walk hands out to plank', difficulty: 'beginner', muscleGroup: 'full_body' },
    { name: 'Bear Crawl', description: 'Crawl on hands and toes', difficulty: 'intermediate', muscleGroup: 'full_body' },
    { name: 'Reverse Lunge', description: 'Step back lunge', difficulty: 'beginner', muscleGroup: 'legs' },
    { name: 'Curtsy Lunge', description: 'Cross leg behind', difficulty: 'intermediate', muscleGroup: 'legs' },
    { name: 'Single Leg Deadlift', description: 'Balance on one leg', difficulty: 'intermediate', muscleGroup: 'legs' },
    { name: 'Flutter Kicks', description: 'Lying leg kicks', difficulty: 'intermediate', muscleGroup: 'core' },
    { name: 'Sit Up', description: 'Full torso raise', difficulty: 'beginner', muscleGroup: 'core' },
    { name: 'Wide Push Up', description: 'Hands wide apart', difficulty: 'intermediate', muscleGroup: 'chest' },
    { name: 'Box Jump', description: 'Jump onto surface', difficulty: 'advanced', muscleGroup: 'legs' }
];

async function main() {
    console.log('Start seeding ...');
    for (const e of exercises) {
        const exercise = await prisma.exercise.create({
            data: e,
        });
        console.log(`Created exercise with id: ${exercise.id}`);
    }
    console.log('Seeding finished.');
}

main()
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (e) => {
        console.error(e);
        await prisma.$disconnect();
        process.exit(1);
    });
