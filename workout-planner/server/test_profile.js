// Native fetch in Node 18+

async function testProfile() {
    try {
        // 1. Login
        const loginRes = await fetch('http://localhost:3000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'test@example.com' })
        });
        const { token } = await loginRes.json();
        console.log('Got Token:', token ? 'Yes' : 'No');

        // 2. Create Profile
        const profileRes = await fetch('http://localhost:3000/api/profile', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                age: 30,
                gender: 'male',
                weight: 80,
                targetWeight: 75,
                goal: 'lose_fat',
                activityLevel: 'moderate'
            })
        });
        const profileData = await profileRes.json();
        console.log('Profile Response:', JSON.stringify(profileData, null, 2));

    } catch (error) {
        console.error('Error:', error);
    }
}

testProfile();
