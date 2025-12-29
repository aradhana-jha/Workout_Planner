import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/axios';
import { CheckCircle, Circle, ArrowLeft, Play } from 'lucide-react';
import clsx from 'clsx';

interface Exercise {
    id: string;
    name: string;
    description: string;
    videoUrl: string | null;
    difficulty: string;
    muscleGroup: string;
}

interface ExerciseLog {
    id: string;
    setNumber: number;
    reps: number;
    weight: number | null;
    isDone: boolean;
}

interface WorkoutExercise {
    id: string;
    exerciseId: string;
    exercise: Exercise;
    targetSets: number;
    targetReps: number;
    logs: ExerciseLog[];
}

interface WorkoutDay {
    id: string;
    dayNumber: number;
    title: string;
    isCompleted: boolean;
    exercises: WorkoutExercise[];
}

export function WorkoutPage() {
    const { dayId } = useParams<{ dayId: string }>();
    const navigate = useNavigate();
    const [workout, setWorkout] = useState<WorkoutDay | null>(null);
    const [loading, setLoading] = useState(true);
    const [completing, setCompleting] = useState(false);

    useEffect(() => {
        const fetchWorkout = async () => {
            try {
                const res = await api.get('/workout/day', { params: { dayId } });
                setWorkout(res.data.workoutDay);
            } catch (error) {
                console.error('Failed to fetch workout', error);
            } finally {
                setLoading(false);
            }
        };
        fetchWorkout();
    }, [dayId]);

    const handleLogSet = async (exerciseId: string, setNumber: number, reps: number, weight: number) => {
        try {
            const res = await api.post('/workout/day/log', {
                dayId,
                exerciseId,
                setNumber,
                reps,
                weight,
            });

            // Update local state
            setWorkout(prev => {
                if (!prev) return null;
                return {
                    ...prev,
                    exercises: prev.exercises.map(ex => {
                        if (ex.exerciseId === exerciseId) {
                            const existingLogIndex = ex.logs.findIndex(l => l.setNumber === setNumber);
                            const newLog = res.data.log;
                            let newLogs = [...ex.logs];
                            if (existingLogIndex >= 0) {
                                newLogs[existingLogIndex] = newLog;
                            } else {
                                newLogs.push(newLog);
                            }
                            return { ...ex, logs: newLogs };
                        }
                        return ex;
                    })
                };
            });
        } catch (error) {
            console.error('Failed to log set', error);
        }
    };

    const handleCompleteWorkout = async () => {
        // if (!confirm('Are you sure you want to complete this workout?')) return;
        setCompleting(true);
        try {
            await api.post('/workout/day/complete', { dayId });
            navigate('/dashboard');
        } catch (error) {
            console.error('Failed to complete workout', error);
        } finally {
            setCompleting(false);
        }
    };

    if (loading) return <div className="p-8 text-center">Loading workout...</div>;
    if (!workout) return <div className="p-8 text-center">Workout not found</div>;

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            {/* Header */}
            <header className="bg-white shadow sticky top-0 z-10">
                <div className="max-w-3xl mx-auto px-4 py-4 flex items-center">
                    <button onClick={() => navigate('/dashboard')} className="mr-4 text-gray-600">
                        <ArrowLeft className="w-6 h-6" />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">{workout.title}</h1>
                        <p className="text-sm text-gray-500">Day {workout.dayNumber}</p>
                    </div>
                </div>
            </header>

            <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
                {workout.exercises.map((item) => (
                    <div key={item.id} className="bg-white rounded-lg shadow overflow-hidden">
                        <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                            <h3 className="font-bold text-lg text-gray-900">{item.exercise.name}</h3>
                            <span className="text-xs font-medium bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                {item.targetSets} x {item.targetReps}
                            </span>
                        </div>

                        {/* Video/Description Placeholder */}
                        <div className="p-4 text-sm text-gray-600 border-b border-gray-100">
                            <p>{item.exercise.description}</p>
                            {item.exercise.videoUrl && (
                                <a href={item.exercise.videoUrl} target="_blank" rel="noreferrer" className="text-blue-600 flex items-center mt-2 hover:underline">
                                    <Play className="w-4 h-4 mr-1" /> Watch Video
                                </a>
                            )}
                        </div>

                        {/* Sets */}
                        <div className="p-4 space-y-3">
                            {Array.from({ length: item.targetSets }).map((_, idx) => {
                                const setNum = idx + 1;
                                const log = item.logs.find(l => l.setNumber === setNum);
                                const isDone = !!log?.isDone;

                                return (
                                    <div key={setNum} className="flex items-center justify-between bg-gray-50 p-3 rounded">
                                        <span className="text-sm font-medium text-gray-500">Set {setNum}</span>
                                        <div className="flex items-center space-x-4">
                                            <div className="text-sm">
                                                <span className="font-bold">{item.targetReps}</span> reps
                                            </div>
                                            <button
                                                onClick={() => handleLogSet(item.exerciseId, setNum, item.targetReps, 0)}
                                                className={clsx(
                                                    "p-2 rounded-full transition-colors",
                                                    isDone ? "bg-green-100 text-green-600" : "bg-gray-200 text-gray-400 hover:bg-gray-300"
                                                )}
                                            >
                                                {isDone ? <CheckCircle className="w-6 h-6" /> : <Circle className="w-6 h-6" />}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}

                <button
                    onClick={handleCompleteWorkout}
                    disabled={completing}
                    className="w-full bg-blue-600 text-white py-4 rounded-lg font-bold text-lg shadow-lg hover:bg-blue-700 transition-colors fixed bottom-4 left-4 right-4 max-w-3xl mx-auto disabled:opacity-50"
                >
                    {completing ? 'Completing...' : 'Complete Workout'}
                </button>
            </main>
        </div>
    );
}
