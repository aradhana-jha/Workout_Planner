// Native fetch in Node 18+

async function testProfile() {
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

        const profileRes = await fetch('http://127.0.0.1:3000/api/profile', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
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
        const profileData = await profileRes.json();
        console.log('Profile Response:', JSON.stringify(profileData, null, 2));

    } catch (error) {
        console.error('Error:', error);
    }
}

testProfile();
