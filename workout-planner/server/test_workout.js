// Native fetch in Node 18+

async function testWorkout() {
    try {
        // 1. Login
        const loginRes = await fetch('http://localhost:3000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'test@example.com' })
        });
        const { token } = await loginRes.json();
        console.log('Got Token:', token ? 'Yes' : 'No');

        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };

        // 2. Get Current Plan
        const planRes = await fetch('http://localhost:3000/api/workout/plan/current', { headers });
        const { plan } = await planRes.json();
        console.log('Current Plan ID:', plan?.id);

        if (!plan) {
            console.log('No active plan found. Run test_profile.js first.');
            return;
        }

        const day1 = plan.days.find(d => d.dayNumber === 1);
        console.log('Day 1 ID:', day1?.id);

        // 3. Get Day Details
        const dayRes = await fetch(`http://localhost:3000/api/workout/day/${day1.id}`, { headers });
        const { workoutDay } = await dayRes.json();
        console.log('Day 1 Exercises:', workoutDay.exercises.length);

        const firstExercise = workoutDay.exercises[0];
        console.log('First Exercise:', firstExercise.exercise.name);

        // 4. Log Set
        const logRes = await fetch(`http://localhost:3000/api/workout/day/${day1.id}/log`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                exerciseId: firstExercise.exerciseId,
                setNumber: 1,
                reps: 10,
                weight: 0
            })
        });
        const logData = await logRes.json();
        console.log('Log Result:', JSON.stringify(logData, null, 2));

        // 5. Complete Day
        const completeRes = await fetch(`http://localhost:3000/api/workout/day/${day1.id}/complete`, {
            method: 'POST',
            headers
        });
        const completeData = await completeRes.json();
        console.log('Complete Result:', completeData);

    } catch (error) {
        console.error('Error:', error);
    }
}

testWorkout();
