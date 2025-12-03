import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/axios';
import { CheckCircle, Circle, Lock } from 'lucide-react';
import clsx from 'clsx';
import { useAuthStore } from '../store/authStore';

interface Day {
    id: string;
    dayNumber: number;
    title: string;
    isCompleted: boolean;
    completedAt: string | null;
}

interface Plan {
    id: string;
    days: Day[];
}

export function DashboardPage() {
    const [plan, setPlan] = useState<Plan | null>(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const logout = useAuthStore((state) => state.logout);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    useEffect(() => {
        const fetchPlan = async () => {
            try {
                const res = await api.get('/workout/plan/current');
                setPlan(res.data.plan);
            } catch (error) {
                console.error('Failed to fetch plan', error);
            } finally {
                setLoading(false);
            }
        };
        fetchPlan();
    }, []);

    if (loading) return <div className="p-8 text-center">Loading plan...</div>;

    if (!plan) {
        return (
            <div className="p-8 text-center">
                <p>No active plan found.</p>
                <button
                    onClick={() => navigate('/onboarding')}
                    className="mt-4 text-blue-600 hover:underline"
                >
                    Create a Plan
                </button>
                <button
                    onClick={handleLogout}
                    className="block mt-8 mx-auto text-gray-500 hover:text-gray-700"
                >
                    Logout
                </button>
            </div>
        );
    }

    // Find the first incomplete day (current day)
    const currentDayIndex = plan.days.findIndex(d => !d.isCompleted);
    const currentDay = currentDayIndex !== -1 ? plan.days[currentDayIndex] : null;

    return (
        <div className="min-h-screen bg-gray-50 pb-12">
            <header className="bg-white shadow">
                <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
                    <h1 className="text-3xl font-bold text-gray-900">Your 30-Day Plan</h1>
                    <div className="flex items-center space-x-4">
                        <div className="text-sm text-gray-500">
                            {plan.days.filter(d => d.isCompleted).length} / 30 Days Completed
                        </div>
                        <button
                            onClick={handleLogout}
                            className="text-sm text-red-600 hover:text-red-800"
                        >
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                {/* Current Workout Card */}
                {currentDay && (
                    <div className="bg-blue-600 rounded-lg shadow-lg p-6 mb-8 text-white mx-4 sm:mx-0">
                        <h2 className="text-2xl font-bold mb-2">Today's Workout</h2>
                        <p className="text-blue-100 text-lg mb-6">{currentDay.title}</p>
                        <button
                            onClick={() => navigate(`/workout/${currentDay.id}`)}
                            className="bg-white text-blue-600 px-6 py-3 rounded-full font-semibold hover:bg-blue-50 transition-colors"
                        >
                            Start Workout
                        </button>
                    </div>
                )}

                {/* Calendar Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 px-4 sm:px-0">
                    {plan.days.map((day, index) => {
                        const isLocked = index > (currentDayIndex === -1 ? 30 : currentDayIndex);
                        const isCurrent = index === currentDayIndex;

                        return (
                            <div
                                key={day.id}
                                onClick={() => !isLocked && navigate(`/workout/${day.id}`)}
                                className={clsx(
                                    "bg-white p-4 rounded-lg shadow border-2 transition-all cursor-pointer",
                                    isCurrent ? "border-blue-500 ring-2 ring-blue-200" : "border-transparent",
                                    isLocked ? "opacity-50 cursor-not-allowed bg-gray-100" : "hover:border-gray-200"
                                )}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <span className={clsx(
                                        "text-sm font-medium px-2 py-1 rounded",
                                        day.isCompleted ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"
                                    )}>
                                        Day {day.dayNumber}
                                    </span>
                                    {day.isCompleted ? (
                                        <CheckCircle className="w-5 h-5 text-green-500" />
                                    ) : isLocked ? (
                                        <Lock className="w-5 h-5 text-gray-400" />
                                    ) : (
                                        <Circle className="w-5 h-5 text-gray-300" />
                                    )}
                                </div>
                                <h3 className="font-semibold text-gray-900">{day.title}</h3>
                                {day.isCompleted && (
                                    <p className="text-xs text-gray-500 mt-2">
                                        Completed {new Date(day.completedAt!).toLocaleDateString()}
                                    </p>
                                )}
                            </div>
                        );
                    })}
                </div>
            </main>
        </div>
    );
}
