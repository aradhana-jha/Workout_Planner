import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/axios';
import { CheckCircle, ArrowLeft, ChevronRight, TimerReset } from 'lucide-react';
import clsx from 'clsx';
import { ExerciseMedia } from '../components/ExerciseMedia';

interface Exercise {
    id: string;
    name: string;
    description: string;
    videoUrl: string | null;
    difficulty?: string | null;
    muscleGroup?: string | null;
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
    targetReps: number | null;
    targetSeconds?: number | null;
    targetRestSeconds?: number | null;
    logs: ExerciseLog[];
}

interface WorkoutDay {
    id: string;
    dayNumber: number;
    title: string;
    isCompleted: boolean;
    exercises: WorkoutExercise[];
}

function getCompletedSets(item: WorkoutExercise) {
    return item.logs.filter(log => log.isDone).length;
}

function getTargetLabel(item: WorkoutExercise) {
    if (item.targetReps != null) {
        return `${item.targetSets} x ${item.targetReps} reps`;
    }

    if (item.targetSeconds != null) {
        return `${item.targetSets} x ${item.targetSeconds}s`;
    }

    return `${item.targetSets} sets`;
}

function getRepOrTimeLabel(item: WorkoutExercise) {
    if (item.targetReps != null) {
        return `${item.targetReps} reps`;
    }

    if (item.targetSeconds != null) {
        return `${item.targetSeconds} seconds`;
    }

    return 'Target set';
}

function getMuscleGroupLabel(item: WorkoutExercise) {
    return item.exercise.muscleGroup?.trim() || 'Full body';
}

function getDifficultyLabel(item: WorkoutExercise) {
    return item.exercise.difficulty?.trim() || 'All levels';
}

export function WorkoutPage() {
    const { dayId } = useParams<{ dayId: string }>();
    const navigate = useNavigate();
    const [workout, setWorkout] = useState<WorkoutDay | null>(null);
    const [loading, setLoading] = useState(true);
    const [completing, setCompleting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [expandedExerciseId, setExpandedExerciseId] = useState<string | null>(null);

    useEffect(() => {
        const fetchWorkout = async () => {
            try {
                const res = await api.get('/workout/day', { params: { dayId } });
                const nextWorkout = res.data.workoutDay as WorkoutDay | null;
                setWorkout(nextWorkout);
                if (nextWorkout) {
                    const nextExercise = nextWorkout.exercises.find(item => getCompletedSets(item) < item.targetSets) ?? nextWorkout.exercises[0] ?? null;
                    setExpandedExerciseId(nextExercise?.id ?? null);
                }
                setError(null);
            } catch (error) {
                console.error('Failed to fetch workout', error);
                setError('Unable to load this workout right now.');
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
            let nextExerciseId: string | null = null;
            setWorkout(prev => {
                if (!prev) return null;
                const exercises = prev.exercises.map(ex => {
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
                });

                const nextUnfinished = exercises.find(ex => getCompletedSets(ex) < ex.targetSets);
                nextExerciseId = nextUnfinished?.id ?? exercises[exercises.length - 1]?.id ?? null;

                return {
                    ...prev,
                    exercises,
                };
            });
            if (nextExerciseId) {
                setExpandedExerciseId(nextExerciseId);
            }
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
    if (error) return <div className="p-8 text-center text-red-600">{error}</div>;
    if (!workout) return <div className="p-8 text-center">Workout not found</div>;
    if (workout.exercises.length === 0) {
        return (
            <div className="app-shell px-4 py-6 sm:px-6 lg:px-8">
                <div className="mx-auto max-w-4xl space-y-6">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-[0_12px_30px_rgba(15,23,42,0.08)] transition hover:bg-slate-50"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </button>
                        <div>
                            <p className="section-label">Day {workout.dayNumber}</p>
                            <h1 className="text-3xl font-black tracking-tight text-slate-900">
                                {workout.title}
                            </h1>
                        </div>
                    </div>

                    <div className="surface-panel space-y-6 overflow-hidden p-8 text-center">
                        <p className="section-label text-emerald-700">Recovery day</p>
                        <h2 className="text-4xl font-black tracking-tight text-slate-900">
                            No training blocks today.
                        </h2>
                        <p className="mx-auto max-w-2xl text-base leading-8 text-slate-600">
                            Use today to walk, stretch lightly, or simply recover so tomorrow’s session feels sharper. You can still mark the day complete to keep the plan moving.
                        </p>
                        <button
                            onClick={handleCompleteWorkout}
                            disabled={completing}
                            className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-900 px-6 py-4 text-sm font-bold uppercase tracking-[0.2em] text-white transition hover:bg-slate-800 disabled:cursor-wait disabled:opacity-70"
                        >
                            {completing ? 'Completing...' : 'Complete recovery day'}
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const totalSets = workout.exercises.reduce((sum, item) => sum + item.targetSets, 0);
    const completedSets = workout.exercises.reduce((sum, item) => sum + getCompletedSets(item), 0);
    const progressPercent = totalSets > 0 ? Math.round((completedSets / totalSets) * 100) : 0;
    const fallbackExercise = workout.exercises.find(item => getCompletedSets(item) < item.targetSets) ?? workout.exercises[0];
    const selectedExerciseIndex = Math.max(0, workout.exercises.findIndex(item => item.id === expandedExerciseId));
    const activeExercise = workout.exercises[selectedExerciseIndex] ?? fallbackExercise;
    const activeExerciseIndex = workout.exercises.findIndex(item => item.id === activeExercise.id);
    const nextSetNumber = Array.from({ length: activeExercise.targetSets }, (_, idx) => idx + 1)
        .find(setNum => !activeExercise.logs.find(log => log.setNumber === setNum)?.isDone) ?? null;
    const canGoNext = activeExerciseIndex < workout.exercises.length - 1;

    const goToExercise = (index: number) => {
        const nextExercise = workout.exercises[index];
        if (nextExercise) {
            setExpandedExerciseId(nextExercise.id);
        }
    };

    return (
        <div className="app-shell flex min-h-screen flex-col">
            <header className="border-b border-white/70 bg-[#f8f3ea]/95 backdrop-blur-xl">
                <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-[0_12px_30px_rgba(15,23,42,0.08)] transition hover:bg-slate-50"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </button>
                        <div>
                            <p className="section-label">Day {workout.dayNumber}</p>
                            <h1 className="text-xl font-black tracking-tight text-slate-900 sm:text-2xl">
                                {workout.title}
                            </h1>
                        </div>
                    </div>
                    <div className="min-w-[9rem]">
                        <div className="flex items-center justify-between text-sm font-semibold text-slate-500">
                            <span>Progress</span>
                            <span>{completedSets}/{totalSets}</span>
                        </div>
                        <div className="progress-track mt-2">
                            <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
                        </div>
                    </div>
                </div>
            </header>

            <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 py-4 sm:px-6">
                <section className="surface-panel p-3 sm:p-4">
                    <div className="flex gap-2 overflow-x-auto pb-1">
                        {workout.exercises.map((item, index) => {
                            const completed = getCompletedSets(item);
                            const isActive = item.id === activeExercise.id;
                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => goToExercise(index)}
                                    className={clsx(
                                        'min-w-[8.5rem] rounded-[20px] border px-3 py-3 text-left transition',
                                        isActive
                                            ? 'border-amber-300 bg-amber-50 shadow-[0_14px_30px_rgba(245,158,11,0.12)]'
                                            : 'border-slate-200 bg-white'
                                    )}
                                >
                                    <p className="section-label">{`Move ${index + 1}`}</p>
                                    <p className="mt-2 line-clamp-2 text-sm font-black leading-5 text-slate-900">
                                        {item.exercise.name}
                                    </p>
                                    <p className="mt-2 text-xs font-semibold text-slate-500">
                                        {completed}/{item.targetSets} sets
                                    </p>
                                </button>
                            );
                        })}
                    </div>
                </section>

                <section className="surface-panel flex flex-1 flex-col overflow-hidden p-4 sm:p-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="max-w-2xl">
                            <p className="section-label text-amber-700">Live workout mode</p>
                            <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
                                {activeExercise.exercise.name}
                            </h2>
                            <p className="mt-3 text-base leading-7 text-slate-600">
                                {activeExercise.exercise.description || 'Move smoothly, keep the tempo controlled, and let the app guide the session one set at a time.'}
                            </p>
                        </div>
                        <div className="grid min-w-[14rem] gap-3 sm:grid-cols-2">
                            <div className="rounded-[22px] bg-slate-950 px-4 py-4 text-white">
                                <p className="section-label text-white/50">Target</p>
                                <p className="mt-2 text-lg font-black">{getTargetLabel(activeExercise)}</p>
                            </div>
                            <div className="rounded-[22px] border border-slate-200 bg-white px-4 py-4">
                                <p className="section-label">Rest</p>
                                <p className="mt-2 flex items-center gap-2 text-lg font-black text-slate-900">
                                    <TimerReset className="h-4 w-4 text-amber-600" />
                                    {activeExercise.targetRestSeconds ?? 0}s
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="mt-5 grid flex-1 gap-5 lg:grid-cols-[1.05fr,0.95fr]">
                        <div>
                            <ExerciseMedia
                                title={activeExercise.exercise.name}
                                videoUrl={activeExercise.exercise.videoUrl}
                                muscleGroup={getMuscleGroupLabel(activeExercise)}
                                difficulty={getDifficultyLabel(activeExercise)}
                                isExpanded={expandedExerciseId === activeExercise.id}
                                onToggle={() => setExpandedExerciseId(current => current === activeExercise.id ? null : activeExercise.id)}
                            />
                        </div>

                        <div className="flex flex-col gap-4">
                            <div className="rounded-[28px] border border-amber-200 bg-[linear-gradient(160deg,rgba(255,255,255,0.94),rgba(254,243,199,0.78))] p-5 shadow-[0_18px_40px_rgba(245,158,11,0.1)]">
                                <p className="section-label text-amber-700">Current set</p>
                                <p className="mt-2 text-4xl font-black tracking-tight text-slate-900">
                                    {nextSetNumber ? `Set ${nextSetNumber}` : 'Exercise done'}
                                </p>
                                <p className="mt-3 text-base leading-7 text-slate-600">
                                    {nextSetNumber
                                        ? `${getRepOrTimeLabel(activeExercise)}. Tap once when the set is complete and the next unfinished set will be ready.`
                                        : 'All sets for this exercise are logged. Move to the next exercise or finish the workout.'}
                                </p>
                                {nextSetNumber ? (
                                    <button
                                        onClick={() => handleLogSet(activeExercise.exerciseId, nextSetNumber, activeExercise.targetReps ?? 0, 0)}
                                        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-slate-900 px-6 py-5 text-base font-bold uppercase tracking-[0.18em] text-white transition hover:bg-slate-800"
                                    >
                                        <CheckCircle className="h-5 w-5" />
                                        Complete set {nextSetNumber}
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => canGoNext ? goToExercise(activeExerciseIndex + 1) : handleCompleteWorkout()}
                                        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-slate-900 px-6 py-5 text-base font-bold uppercase tracking-[0.18em] text-white transition hover:bg-slate-800"
                                    >
                                        {canGoNext ? 'Next exercise' : completing ? 'Completing...' : 'Complete workout'}
                                        <ChevronRight className="h-5 w-5" />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </section>

                <section className="surface-panel flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <p className="section-label">Finish the session</p>
                        <p className="mt-2 text-base font-semibold text-slate-700">
                            {completedSets} of {totalSets} sets logged across {workout.exercises.length} exercises.
                        </p>
                    </div>
                    <button
                        onClick={handleCompleteWorkout}
                        disabled={completing}
                        className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-900 px-6 py-4 text-sm font-bold uppercase tracking-[0.2em] text-white transition hover:bg-slate-800 disabled:cursor-wait disabled:opacity-70"
                    >
                        {completing ? 'Completing...' : 'Complete workout'}
                        <ChevronRight className="h-4 w-4" />
                    </button>
                </section>
            </main>
        </div>
    );
}
