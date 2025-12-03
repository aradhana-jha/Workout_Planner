// Native fetch in Node 18+

async function testWorkoutFlow() {
    try {
        // 1. Login
        const loginRes = await fetch('http://localhost:3000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'test_flow@example.com' })
        });
        const { token } = await loginRes.json();
        console.log('Got Token');

        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };

        // 2. Create Profile & Plan
        await fetch('http://localhost:3000/api/profile', {
            method: 'POST',
            headers,
            body: JSON.stringify({
                age: 25,
                gender: 'female',
                weight: 60,
                targetWeight: 55,
                goal: 'build_muscle',
                activityLevel: 'active'
            })
        });
        console.log('Profile & Plan Created');

        // 3. Get Plan
        const planRes = await fetch('http://localhost:3000/api/workout/plan/current', { headers });
        const { plan } = await planRes.json();
        const day1 = plan.days.find(d => d.dayNumber === 1);
        console.log('Day 1 ID:', day1.id);

        // 4. Get Workout Details
        const dayRes = await fetch(`http://localhost:3000/api/workout/day/${day1.id}`, { headers });
        const { workoutDay } = await dayRes.json();
        const exercise = workoutDay.exercises[0];

        // 5. Log Set
        await fetch(`http://localhost:3000/api/workout/day/${day1.id}/log`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                exerciseId: exercise.exerciseId,
                setNumber: 1,
                reps: 12,
                weight: 10
            })
        });
        console.log('Set Logged');

        // 6. Complete Workout
        await fetch(`http://localhost:3000/api/workout/day/${day1.id}/complete`, {
            method: 'POST',
            headers
        });
        console.log('Workout Completed');

        // 7. Verify Plan Status
        const planRes2 = await fetch('http://localhost:3000/api/workout/plan/current', { headers });
        const { plan: updatedPlan } = await planRes2.json();
        const updatedDay1 = updatedPlan.days.find(d => d.dayNumber === 1);
        console.log('Day 1 Completed:', updatedDay1.isCompleted);

    } catch (error) {
        console.error('Error:', error);
    }
}

testWorkoutFlow();
