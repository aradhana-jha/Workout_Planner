import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/axios';
import { CheckCircle, Circle, ArrowLeft, ChevronRight, PlayCircle, TimerReset } from 'lucide-react';
import clsx from 'clsx';
import { ExerciseMedia } from '../components/ExerciseMedia';

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

function getExerciseTips(item: WorkoutExercise) {
    const lowerMuscle = item.exercise.muscleGroup.toLowerCase();
    const tips = [
        lowerMuscle.includes('core')
            ? 'Brace before each rep and keep your ribs stacked over your hips.'
            : lowerMuscle.includes('legs')
                ? 'Own the lowering phase and keep pressure even through the whole foot.'
                : lowerMuscle.includes('back')
                    ? 'Move the shoulder blades first, then let the arms follow.'
                    : 'Move with control and stop the set when the rep quality drops.',
        item.targetSeconds != null
            ? 'Keep your breathing steady so the hold stays smooth instead of frantic.'
            : 'Use a full pain-free range of motion instead of rushing the count.',
        item.exercise.difficulty.toLowerCase().includes('beginner')
            ? 'Quality beats speed. Make the first round look exactly like the last.'
            : 'If the set feels unstable, reduce tempo before increasing intensity.',
    ];

    return tips;
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
    const currentExercise = workout.exercises.find(item => getCompletedSets(item) < item.targetSets) ?? workout.exercises[0];
    const focusGroups = Array.from(new Set(workout.exercises.map(item => item.exercise.muscleGroup))).slice(0, 3);

    return (
        <div className="app-shell pb-24">
            <header className="sticky top-0 z-20 border-b border-white/70 bg-[#f8f3ea]/90 backdrop-blur-xl">
                <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-[0_12px_30px_rgba(15,23,42,0.08)] transition hover:bg-slate-50"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </button>
                        <div>
                            <p className="section-label">Day {workout.dayNumber}</p>
                            <h1 className="text-2xl font-black tracking-tight text-slate-900">
                                {workout.title}
                            </h1>
                        </div>
                    </div>
                    <div className="hidden min-w-[16rem] sm:block">
                        <div className="flex items-center justify-between text-sm font-semibold text-slate-500">
                            <span>Session progress</span>
                            <span>{completedSets}/{totalSets} sets</span>
                        </div>
                        <div className="progress-track mt-3">
                            <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
                        </div>
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
                <section className="surface-panel overflow-hidden p-6 sm:p-8">
                    <div className="grid gap-8 lg:grid-cols-[1.2fr,0.8fr]">
                        <div className="space-y-6">
                            <div>
                                <p className="section-label text-amber-700">Current focus</p>
                                <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
                                    {currentExercise.exercise.name}
                                </h2>
                                <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
                                    {currentExercise.exercise.description || 'Open the exercise demo, lock in the movement pattern, and work through the session with deliberate reps and cleaner execution.'}
                                </p>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-3">
                                <div className="rounded-[24px] bg-slate-950 px-5 py-5 text-white shadow-[0_20px_50px_rgba(15,23,42,0.22)]">
                                    <p className="section-label text-white/50">Session completion</p>
                                    <p className="mt-3 text-4xl font-black">{progressPercent}%</p>
                                </div>
                                <div className="rounded-[24px] border border-slate-200 bg-white px-5 py-5">
                                    <p className="section-label">Target</p>
                                    <p className="mt-3 text-2xl font-black tracking-tight text-slate-900">
                                        {getTargetLabel(currentExercise)}
                                    </p>
                                </div>
                                <div className="rounded-[24px] border border-slate-200 bg-white px-5 py-5">
                                    <p className="section-label">Rest pacing</p>
                                    <p className="mt-3 flex items-center gap-2 text-2xl font-black tracking-tight text-slate-900">
                                        <TimerReset className="h-5 w-5 text-amber-600" />
                                        {currentExercise.targetRestSeconds ?? 0}s
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-[28px] border border-white/70 bg-[linear-gradient(160deg,rgba(255,255,255,0.9),rgba(254,243,199,0.72))] p-6 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.6)]">
                            <p className="section-label text-amber-700">Session snapshot</p>
                            <div className="mt-5 space-y-4">
                                <div className="flex items-center justify-between rounded-[20px] bg-white/80 px-4 py-4">
                                    <span className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                                        Exercises
                                    </span>
                                    <span className="text-2xl font-black text-slate-900">{workout.exercises.length}</span>
                                </div>
                                <div className="flex items-center justify-between rounded-[20px] bg-white/80 px-4 py-4">
                                    <span className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                                        Live focus
                                    </span>
                                    <span className="text-sm font-bold text-slate-900">{currentExercise.exercise.muscleGroup}</span>
                                </div>
                                <div className="rounded-[20px] bg-white/80 px-4 py-4">
                                    <span className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                                        Queue
                                    </span>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {focusGroups.map(group => (
                                            <span key={group} className="rounded-full bg-slate-900 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-white">
                                                {group}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="surface-panel p-4 sm:p-5">
                    <div className="flex gap-3 overflow-x-auto pb-1">
                        {workout.exercises.map((item, index) => {
                            const isActive = item.id === expandedExerciseId;
                            const completed = getCompletedSets(item);
                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => setExpandedExerciseId(item.id)}
                                    className={clsx(
                                        'min-w-[15rem] rounded-[22px] border px-4 py-4 text-left transition',
                                        isActive
                                            ? 'border-amber-300 bg-amber-50 shadow-[0_18px_36px_rgba(245,158,11,0.12)]'
                                            : 'border-slate-200 bg-white hover:border-slate-300'
                                    )}
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="section-label">{`Exercise ${index + 1}`}</span>
                                        <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                                            {completed}/{item.targetSets}
                                        </span>
                                    </div>
                                    <p className="mt-3 text-base font-black tracking-tight text-slate-900">
                                        {item.exercise.name}
                                    </p>
                                    <p className="mt-2 text-sm text-slate-500">
                                        {getTargetLabel(item)}
                                    </p>
                                </button>
                            );
                        })}
                    </div>
                </section>

                <section className="space-y-5">
                    {workout.exercises.map((item, index) => {
                        const isCurrent = item.id === currentExercise.id;
                        const isExpanded = item.id === expandedExerciseId;
                        const completed = getCompletedSets(item);
                        const tips = getExerciseTips(item);

                        return (
                            <article
                                key={item.id}
                                className={clsx(
                                    'surface-panel overflow-hidden transition',
                                    isCurrent && 'ring-2 ring-amber-200'
                                )}
                            >
                                <div className="border-b border-slate-200/80 px-5 py-5 sm:px-6">
                                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                        <div>
                                            <div className="flex items-center gap-3">
                                                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-sm font-black text-white">
                                                    {index + 1}
                                                </span>
                                                <div>
                                                    <p className="section-label">{isCurrent ? 'Current move' : 'In queue'}</p>
                                                    <h3 className="mt-1 text-2xl font-black tracking-tight text-slate-900">
                                                        {item.exercise.name}
                                                    </h3>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-3">
                                            <span className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-600">
                                                {getTargetLabel(item)}
                                            </span>
                                            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
                                                {completed}/{item.targetSets} sets done
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid gap-0 lg:grid-cols-[1.05fr,0.95fr]">
                                    <div className="p-4 sm:p-5">
                                        <ExerciseMedia
                                            title={item.exercise.name}
                                            videoUrl={item.exercise.videoUrl}
                                            muscleGroup={item.exercise.muscleGroup}
                                            difficulty={item.exercise.difficulty}
                                            isExpanded={isExpanded}
                                            onToggle={() => setExpandedExerciseId(current => current === item.id ? null : item.id)}
                                        />
                                    </div>

                                    <div className="border-t border-slate-200/70 p-5 sm:p-6 lg:border-l lg:border-t-0">
                                        <div className="space-y-6">
                                            <div className="space-y-3">
                                                <p className="section-label">How to approach it</p>
                                                <p className="text-base leading-7 text-slate-600">
                                                    {item.exercise.description || 'Use steady breathing, move under control, and treat every rep like a demo rep.'}
                                                </p>
                                                <ul className="grid gap-2 text-sm leading-6 text-slate-600">
                                                    {tips.map(tip => (
                                                        <li key={tip} className="rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3">
                                                            {tip}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>

                                            <div className="flex flex-wrap items-center gap-3 rounded-[22px] bg-amber-50 px-4 py-4 text-sm font-semibold text-slate-700">
                                                <PlayCircle className="h-4 w-4 text-amber-600" />
                                                Demo is built into the card. Keep one exercise open at a time so the workout stays readable.
                                            </div>

                                            <div className="space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <p className="section-label">Set tracker</p>
                                                    <span className="text-sm font-semibold text-slate-500">
                                                        Rest {item.targetRestSeconds ?? 0}s
                                                    </span>
                                                </div>
                                                {Array.from({ length: item.targetSets }).map((_, idx) => {
                                                    const setNum = idx + 1;
                                                    const log = item.logs.find(l => l.setNumber === setNum);
                                                    const isDone = !!log?.isDone;

                                                    return (
                                                        <div
                                                            key={setNum}
                                                            className={clsx(
                                                                'flex items-center justify-between gap-4 rounded-[20px] border px-4 py-4 transition',
                                                                isDone ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'
                                                            )}
                                                        >
                                                            <div>
                                                                <p className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">
                                                                    Set {setNum}
                                                                </p>
                                                                <p className="mt-2 text-base font-bold text-slate-900">
                                                                    {getRepOrTimeLabel(item)}
                                                                </p>
                                                            </div>
                                                            <button
                                                                onClick={() => handleLogSet(item.exerciseId, setNum, item.targetReps ?? 0, 0)}
                                                                className={clsx(
                                                                    'inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm font-bold uppercase tracking-[0.16em] transition',
                                                                    isDone
                                                                        ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                                                        : 'bg-slate-900 text-white hover:bg-slate-800'
                                                                )}
                                                            >
                                                                {isDone ? (
                                                                    <>
                                                                        <CheckCircle className="h-4 w-4" />
                                                                        Logged
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <Circle className="h-4 w-4" />
                                                                        Mark done
                                                                    </>
                                                                )}
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </article>
                        );
                    })}
                </section>
            </main>

            <div className="fixed inset-x-0 bottom-0 z-30 px-4 pb-4 sm:px-6 lg:px-8">
                <div className="mx-auto max-w-6xl">
                    <div className="surface-panel flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p className="section-label">Finish the session</p>
                            <p className="mt-2 text-base font-semibold text-slate-700">
                                {completedSets} of {totalSets} sets logged. Use the queue above to review any unfinished movement before completing the day.
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
                    </div>
                </div>
            </div>
        </div>
    );
}
