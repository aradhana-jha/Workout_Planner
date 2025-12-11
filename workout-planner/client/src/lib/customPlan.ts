export interface CustomExercise {
    id: string;
    name: string;
    sets: number | string; // Allow string for "30 seconds" or "10-12"
    reps: string;
    type: 'warmup' | 'strength' | 'core' | 'stretching' | 'rest';
    muscleGroup: string;
}

export interface DayPlan {
    day: number;
    title: string; // e.g., "Full Body Strength" or based on content
    exercises: CustomExercise[];
}

export const MUSCLE_GAIN_PLAN: Record<number, DayPlan> = {
    1: {
        day: 1,
        title: "Upper Body Strength",
        exercises: [
            { id: 'd1-w1', name: 'Arm circles', sets: 1, reps: '30 seconds', type: 'warmup', muscleGroup: 'warmup' },
            { id: 'd1-w2', name: 'Shoulder rolls', sets: 1, reps: '30 seconds', type: 'warmup', muscleGroup: 'warmup' },
            { id: 'd1-w3', name: 'Torso twists (standing)', sets: 1, reps: '30 seconds', type: 'warmup', muscleGroup: 'warmup' },
            { id: 'd1-c1', name: 'Incline push-up (hands on bench/chair)', sets: 3, reps: '8–10', type: 'strength', muscleGroup: 'chest' },
            { id: 'd1-c2', name: 'Dumbbell shoulder press (seated/standing)', sets: 3, reps: '10–12', type: 'strength', muscleGroup: 'shoulders' },
            { id: 'd1-c3', name: 'Chair triceps dips', sets: 2, reps: '8–10', type: 'strength', muscleGroup: 'triceps' },
            { id: 'd1-c4', name: 'Plank', sets: 2, reps: '20–30 seconds', type: 'core', muscleGroup: 'core' },
            { id: 'd1-s1', name: 'Chest stretch against wall', sets: 1, reps: '30 seconds/side', type: 'stretching', muscleGroup: 'chest' },
            { id: 'd1-s2', name: 'Child’s pose', sets: 1, reps: '45 seconds', type: 'stretching', muscleGroup: 'back' },
        ]
    },
    2: {
        day: 2,
        title: "Lower Body & Core",
        exercises: [
            { id: 'd2-w1', name: 'March in place', sets: 1, reps: '60 seconds', type: 'warmup', muscleGroup: 'warmup' },
            { id: 'd2-w2', name: 'Arm swings', sets: 1, reps: '30 seconds', type: 'warmup', muscleGroup: 'warmup' },
            { id: 'd2-w3', name: 'Hip circles', sets: 1, reps: '30 seconds', type: 'warmup', muscleGroup: 'warmup' },
            { id: 'd2-w4', name: 'Reverse lunges (bodyweight)', sets: 1, reps: '8 reps/leg', type: 'warmup', muscleGroup: 'legs' },
            { id: 'd2-c1', name: 'Bodyweight squats', sets: 3, reps: '12', type: 'strength', muscleGroup: 'legs' },
            { id: 'd2-c2', name: 'Romanian deadlift with dumbbells', sets: 3, reps: '10–12', type: 'strength', muscleGroup: 'legs' },
            { id: 'd2-c3', name: 'Side lying leg raises', sets: 2, reps: '12–15/side', type: 'strength', muscleGroup: 'legs' },
            { id: 'd2-c4', name: 'Plank', sets: 2, reps: '20–30 seconds', type: 'core', muscleGroup: 'core' },
            { id: 'd2-c5', name: 'Glute bridge', sets: 2, reps: '12', type: 'strength', muscleGroup: 'glutes' },
            { id: 'd2-s1', name: 'Standing calf stretch', sets: 1, reps: '30 seconds/side', type: 'stretching', muscleGroup: 'calves' },
            { id: 'd2-s2', name: 'Seated hamstring stretch', sets: 1, reps: '30 seconds/side', type: 'stretching', muscleGroup: 'legs' },
            { id: 'd2-s3', name: 'Figure four glute stretch', sets: 1, reps: '30 seconds/side', type: 'stretching', muscleGroup: 'glutes' },
            { id: 'd2-s4', name: 'Hip flexor lunge stretch', sets: 1, reps: '30 seconds/side', type: 'stretching', muscleGroup: 'legs' },
        ]
    },
    3: {
        day: 3,
        title: "Full Body Combine",
        exercises: [
            { id: 'd3-w1', name: 'Neck circles', sets: 1, reps: '30 seconds', type: 'warmup', muscleGroup: 'warmup' },
            { id: 'd3-w2', name: 'Arm circles', sets: 1, reps: '30 seconds', type: 'warmup', muscleGroup: 'warmup' },
            { id: 'd3-w3', name: 'Shoulder rolls', sets: 1, reps: '30 seconds', type: 'warmup', muscleGroup: 'warmup' },
            { id: 'd3-w4', name: 'Cat–cow', sets: 1, reps: '10 reps', type: 'warmup', muscleGroup: 'back' },
            { id: 'd3-c1', name: 'Incline push-up', sets: 3, reps: '8–10', type: 'strength', muscleGroup: 'chest' },
            { id: 'd3-c2', name: 'Dumbbell shoulder press', sets: 3, reps: '10–12', type: 'strength', muscleGroup: 'shoulders' },
            { id: 'd3-c3', name: 'One-arm dumbbell row', sets: 3, reps: '10–12/arm', type: 'strength', muscleGroup: 'back' },
            { id: 'd3-c4', name: 'Chair triceps dips', sets: 2, reps: '8–10', type: 'strength', muscleGroup: 'triceps' },
            { id: 'd3-c5', name: 'Dumbbell biceps curl', sets: 2, reps: '10–12', type: 'strength', muscleGroup: 'biceps' },
            { id: 'd3-s1', name: 'Chest stretch against wall', sets: 1, reps: '30 seconds/side', type: 'stretching', muscleGroup: 'chest' },
            { id: 'd3-s2', name: 'Shoulder cross-body stretch', sets: 1, reps: '30 seconds/side', type: 'stretching', muscleGroup: 'shoulders' },
            { id: 'd3-s3', name: 'Child’s pose', sets: 1, reps: '45 seconds', type: 'stretching', muscleGroup: 'back' },
        ]
    },
    4: {
        day: 4,
        title: "Rest & Recovery",
        exercises: [] // No exercises
    },
    5: {
        day: 5,
        title: "Lower Body Conditioning",
        exercises: [
            { id: 'd5-w1', name: 'March in place', sets: 1, reps: '60 seconds', type: 'warmup', muscleGroup: 'warmup' },
            { id: 'd5-w2', name: 'Arm swings', sets: 1, reps: '30 seconds', type: 'warmup', muscleGroup: 'warmup' },
            { id: 'd5-w3', name: 'Hip circles', sets: 1, reps: '30 seconds', type: 'warmup', muscleGroup: 'warmup' },
            { id: 'd5-w4', name: 'Torso twists (standing)', sets: 1, reps: '30 seconds', type: 'warmup', muscleGroup: 'warmup' },
            { id: 'd5-c1', name: 'Bodyweight squats', sets: 3, reps: '12', type: 'strength', muscleGroup: 'legs' },
            { id: 'd5-c2', name: 'Reverse lunges', sets: 3, reps: '8–10/leg', type: 'strength', muscleGroup: 'legs' },
            { id: 'd5-c3', name: 'Glute bridge', sets: 3, reps: '12–15', type: 'strength', muscleGroup: 'glutes' },
            { id: 'd5-c4', name: 'Superman', sets: 2, reps: '10–12', type: 'core', muscleGroup: 'back' },
            { id: 'd5-c5', name: 'Side plank', sets: 2, reps: '20–30s/side', type: 'core', muscleGroup: 'core' },
            { id: 'd5-s1', name: 'Standing hamstring stretch', sets: 1, reps: '30s/side', type: 'stretching', muscleGroup: 'legs' },
            { id: 'd5-s2', name: 'Standing quad stretch', sets: 1, reps: '30s/side', type: 'stretching', muscleGroup: 'legs' },
            { id: 'd5-s3', name: 'Seated glute stretch', sets: 1, reps: '30s/side', type: 'stretching', muscleGroup: 'glutes' },
            { id: 'd5-s4', name: 'Cat–cow (slow)', sets: 1, reps: '10 reps', type: 'stretching', muscleGroup: 'back' },
        ]
    },
    6: {
        day: 6,
        title: "Full Body Strength",
        exercises: [
            { id: 'd6-w1', name: 'Low-impact jumping jacks', sets: 1, reps: '40 seconds', type: 'warmup', muscleGroup: 'warmup' },
            { id: 'd6-w2', name: 'Arm circles', sets: 1, reps: '30 seconds', type: 'warmup', muscleGroup: 'warmup' },
            { id: 'd6-w3', name: 'Hip circles', sets: 1, reps: '30 seconds', type: 'warmup', muscleGroup: 'warmup' },
            { id: 'd6-w4', name: 'Bodyweight squats', sets: 1, reps: '15 reps', type: 'warmup', muscleGroup: 'legs' },
            { id: 'd6-c1', name: 'Goblet squat with dumbbell', sets: 3, reps: '10–12', type: 'strength', muscleGroup: 'legs' },
            { id: 'd6-c2', name: 'Romanian deadlift with dumbbells', sets: 3, reps: '10–12', type: 'strength', muscleGroup: 'legs' },
            { id: 'd6-c3', name: 'Incline push-up', sets: 3, reps: '8–10', type: 'strength', muscleGroup: 'chest' },
            { id: 'd6-c4', name: 'One-arm dumbbell row', sets: 3, reps: '10–12/arm', type: 'strength', muscleGroup: 'back' },
            { id: 'd6-c5', name: 'Dead bug', sets: 2, reps: '10/side', type: 'core', muscleGroup: 'core' },
            { id: 'd6-s1', name: 'Standing hamstring stretch', sets: 1, reps: '30s/side', type: 'stretching', muscleGroup: 'legs' },
            { id: 'd6-s2', name: 'Standing quad stretch', sets: 1, reps: '30s/side', type: 'stretching', muscleGroup: 'legs' },
            { id: 'd6-s3', name: 'Chest stretch against wall', sets: 1, reps: '30s/side', type: 'stretching', muscleGroup: 'chest' },
            { id: 'd6-s4', name: 'Child’s pose', sets: 1, reps: '45 seconds', type: 'stretching', muscleGroup: 'back' },
        ]
    },
    7: {
        day: 7,
        title: "Rest & Recovery",
        exercises: [] // No exercises
    }
};
