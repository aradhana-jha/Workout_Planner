// Native fetch in Node 18+

async function testWorkoutFlow() {
    try {
        const loginRes = await fetch('http://127.0.0.1:3000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'test_flow@example.com' })
        });
        if (!loginRes.ok) {
            throw new Error(`Login failed: ${loginRes.status} ${await loginRes.text()}`);
        }

        const { token } = await loginRes.json();
        console.log('Got Token');

        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };

        const profileRes = await fetch('http://127.0.0.1:3000/api/profile', {
            method: 'POST',
            headers,
            body: JSON.stringify({
                goal: 'Build muscle',
                equipment: JSON.stringify(['No equipment', 'Dumbbells']),
                timePerWorkout: 25,
                experienceLevel: 'beginner',
                recentConsistency: '1-2 days per week',
                painAreas: JSON.stringify(['None']),
                movementRestrictions: JSON.stringify(['None']),
                workoutStylePreference: 'Mix of both',
                focusAreas: JSON.stringify(['Full body balance']),
                intensityPreference: 'Moderate',
                startingAbilityPushups: '1-5',
                startingAbilitySquats: '11-25',
                startingAbilityPlank: '20-45',
                sleepBucket: '7-8 hours',
                preferenceExclusions: JSON.stringify(['None'])
            })
        });
        if (!profileRes.ok) {
            throw new Error(`Profile failed: ${profileRes.status} ${await profileRes.text()}`);
        }
        console.log('Profile & Plan Created');

        const planRes = await fetch('http://127.0.0.1:3000/api/workout/plan/current', { headers });
        if (!planRes.ok) {
            throw new Error(`Get plan failed: ${planRes.status} ${await planRes.text()}`);
        }
        const { plan } = await planRes.json();
        if (!plan) {
            throw new Error('No active plan returned');
        }
        const day1 = plan.days.find(d => d.dayNumber === 1);
        console.log('Day 1 ID:', day1.id);

        const dayRes = await fetch(`http://127.0.0.1:3000/api/workout/day?dayId=${day1.id}`, { headers });
        if (!dayRes.ok) {
            throw new Error(`Get workout failed: ${dayRes.status} ${await dayRes.text()}`);
        }
        const { workoutDay } = await dayRes.json();
        const exercise = workoutDay.exercises[0];

        const logRes = await fetch('http://127.0.0.1:3000/api/workout/day/log', {
            method: 'POST',
            headers,
            body: JSON.stringify({
                dayId: day1.id,
                exerciseId: exercise.exerciseId,
                setNumber: 1,
                reps: exercise.targetReps ?? 0,
                weight: 10
            })
        });
        if (!logRes.ok) {
            throw new Error(`Log set failed: ${logRes.status} ${await logRes.text()}`);
        }
        console.log('Set Logged');

        const completeRes = await fetch('http://127.0.0.1:3000/api/workout/day/complete', {
            method: 'POST',
            headers,
            body: JSON.stringify({ dayId: day1.id })
        });
        if (!completeRes.ok) {
            throw new Error(`Complete workout failed: ${completeRes.status} ${await completeRes.text()}`);
        }
        console.log('Workout Completed');

        const planRes2 = await fetch('http://127.0.0.1:3000/api/workout/plan/current', { headers });
        if (!planRes2.ok) {
            throw new Error(`Get updated plan failed: ${planRes2.status} ${await planRes2.text()}`);
        }
        const { plan: updatedPlan } = await planRes2.json();
        const updatedDay1 = updatedPlan.days.find(d => d.dayNumber === 1);
        console.log('Day 1 Completed:', updatedDay1.isCompleted);

    } catch (error) {
        console.error('Error:', error);
    }
}

testWorkoutFlow();
