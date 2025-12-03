import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/axios';

export function OnboardingPage() {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        age: 30,
        gender: 'male',
        weight: 70,
        targetWeight: 65,
        goal: 'lose_fat',
        activityLevel: 'moderate',
    });
    const [loading, setLoading] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: name === 'age' || name === 'weight' || name === 'targetWeight' ? Number(value) : value,
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.post('/profile', formData);
            navigate('/dashboard');
        } catch (error) {
            console.error('Failed to save profile', error);
            alert('Failed to save profile. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                    Setup Your Profile
                </h2>
                <p className="mt-2 text-center text-sm text-gray-600">
                    Help us create your personalized workout plan.
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
                    <form className="space-y-6" onSubmit={handleSubmit}>

                        <div>
                            <label htmlFor="age" className="block text-sm font-medium text-gray-700">Age</label>
                            <div className="mt-1">
                                <input
                                    id="age"
                                    name="age"
                                    type="number"
                                    required
                                    value={formData.age}
                                    onChange={handleChange}
                                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="gender" className="block text-sm font-medium text-gray-700">Gender</label>
                            <div className="mt-1">
                                <select
                                    id="gender"
                                    name="gender"
                                    value={formData.gender}
                                    onChange={handleChange}
                                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                >
                                    <option value="male">Male</option>
                                    <option value="female">Female</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="weight" className="block text-sm font-medium text-gray-700">Weight (kg)</label>
                                <div className="mt-1">
                                    <input
                                        id="weight"
                                        name="weight"
                                        type="number"
                                        required
                                        value={formData.weight}
                                        onChange={handleChange}
                                        className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                    />
                                </div>
                            </div>

                            <div>
                                <label htmlFor="targetWeight" className="block text-sm font-medium text-gray-700">Target (kg)</label>
                                <div className="mt-1">
                                    <input
                                        id="targetWeight"
                                        name="targetWeight"
                                        type="number"
                                        required
                                        value={formData.targetWeight}
                                        onChange={handleChange}
                                        className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                    />
                                </div>
                            </div>
                        </div>

                        <div>
                            <label htmlFor="goal" className="block text-sm font-medium text-gray-700">Fitness Goal</label>
                            <div className="mt-1">
                                <select
                                    id="goal"
                                    name="goal"
                                    value={formData.goal}
                                    onChange={handleChange}
                                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                >
                                    <option value="lose_fat">Lose Fat</option>
                                    <option value="build_muscle">Build Muscle</option>
                                    <option value="stay_active">Stay Active</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label htmlFor="activityLevel" className="block text-sm font-medium text-gray-700">Activity Level</label>
                            <div className="mt-1">
                                <select
                                    id="activityLevel"
                                    name="activityLevel"
                                    value={formData.activityLevel}
                                    onChange={handleChange}
                                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                >
                                    <option value="sedentary">Sedentary (Little to no exercise)</option>
                                    <option value="moderate">Moderate (Exercise 1-3 times/week)</option>
                                    <option value="active">Active (Exercise 4-5 times/week)</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                            >
                                {loading ? 'Generating Plan...' : 'Create Plan'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
