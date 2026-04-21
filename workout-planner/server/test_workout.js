// Native fetch in Node 18+

async function testWorkout() {
    try {
        const loginRes = await fetch('http://127.0.0.1:3000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'test@example.com' })
        });
        if (!loginRes.ok) {
            throw new Error(`Login failed: ${loginRes.status} ${await loginRes.text()}`);
        }

        const { token } = await loginRes.json();
        console.log('Got Token:', token ? 'Yes' : 'No');

        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };

        const planRes = await fetch('http://127.0.0.1:3000/api/workout/plan/current', { headers });
        if (!planRes.ok) {
            throw new Error(`Get plan failed: ${planRes.status} ${await planRes.text()}`);
        }
        const { plan } = await planRes.json();
        console.log('Current Plan ID:', plan?.id);

        if (!plan) {
            console.log('No active plan found. Run test_profile.js first.');
            return;
        }

        const day1 = plan.days.find(d => d.dayNumber === 1);
        console.log('Day 1 ID:', day1?.id);

        const dayRes = await fetch(`http://127.0.0.1:3000/api/workout/day?dayId=${day1.id}`, { headers });
        if (!dayRes.ok) {
            throw new Error(`Get day failed: ${dayRes.status} ${await dayRes.text()}`);
        }
        const { workoutDay } = await dayRes.json();
        console.log('Day 1 Exercises:', workoutDay.exercises.length);

        const firstExercise = workoutDay.exercises[0];
        console.log('First Exercise:', firstExercise.exercise.name);

        const logRes = await fetch('http://127.0.0.1:3000/api/workout/day/log', {
            method: 'POST',
            headers,
            body: JSON.stringify({
                dayId: day1.id,
                exerciseId: firstExercise.exerciseId,
                setNumber: 1,
                reps: firstExercise.targetReps ?? 0,
                weight: 0
            })
        });
        if (!logRes.ok) {
            throw new Error(`Log set failed: ${logRes.status} ${await logRes.text()}`);
        }
        const logData = await logRes.json();
        console.log('Log Result:', JSON.stringify(logData, null, 2));

        const completeRes = await fetch('http://127.0.0.1:3000/api/workout/day/complete', {
            method: 'POST',
            headers,
            body: JSON.stringify({ dayId: day1.id })
        });
        if (!completeRes.ok) {
            throw new Error(`Complete day failed: ${completeRes.status} ${await completeRes.text()}`);
        }
        const completeData = await completeRes.json();
        console.log('Complete Result:', completeData);

    } catch (error) {
        console.error('Error:', error);
    }
}

testWorkout();
