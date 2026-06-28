import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import clsx from 'clsx';
import { ArrowLeft, CheckCircle2, ChevronRight, PlayCircle, TimerReset } from 'lucide-react';
import { api } from '../lib/axios';
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
    return item.logs.filter((log) => log.isDone).length;
}

function isExerciseComplete(item: WorkoutExercise) {
    return getCompletedSets(item) >= item.targetSets;
}

function getSetTargetLabel(item: WorkoutExercise) {
    if (item.targetReps != null) {
        return `${item.targetReps} reps`;
    }

    if (item.targetSeconds != null) {
        return `${item.targetSeconds} seconds`;
    }

    return 'Target set';
}

export function WorkoutPage() {
    const { dayId } = useParams<{ dayId: string }>();
    const navigate = useNavigate();
    const exerciseRefs = useRef<Record<string, HTMLElement | null>>({});
    const pendingScrollExerciseId = useRef<string | null>(null);

    const [workout, setWorkout] = useState<WorkoutDay | null>(null);
    const [loading, setLoading] = useState(true);
    const [completing, setCompleting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [completionError, setCompletionError] = useState<string | null>(null);
    const [expandedExerciseId, setExpandedExerciseId] = useState<string | null>(null);

    useEffect(() => {
        const fetchWorkout = async () => {
            try {
                const res = await api.get('/workout/day', { params: { dayId } });
                const nextWorkout = res.data.workoutDay as WorkoutDay | null;
                setWorkout(nextWorkout);

                if (nextWorkout) {
                    const firstOpenExercise = nextWorkout.exercises.find((item) => getCompletedSets(item) < item.targetSets) ?? nextWorkout.exercises[0] ?? null;
                    setExpandedExerciseId(firstOpenExercise?.id ?? null);
                }

                setError(null);
            } catch (fetchError) {
                console.error('Failed to fetch workout', fetchError);
                setError('Unable to load this workout right now.');
            } finally {
                setLoading(false);
            }
        };

        void fetchWorkout();
    }, [dayId]);

    useEffect(() => {
        const targetExerciseId = pendingScrollExerciseId.current ?? expandedExerciseId;
        if (!targetExerciseId) return;

        const element = exerciseRefs.current[targetExerciseId];
        if (!element) return;

        const timeout = window.setTimeout(() => {
            element.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
            });
            pendingScrollExerciseId.current = null;
        }, 80);

        return () => window.clearTimeout(timeout);
    }, [expandedExerciseId, workout]);

    const handleLogSet = async (workoutExerciseId: string, exerciseId: string, setNumber: number, reps: number, weight: number) => {
        try {
            setCompletionError(null);
            const res = await api.post('/workout/day/log', {
                dayId,
                exerciseId,
                setNumber,
                reps,
                weight,
            });

            if (!workout) {
                return;
            }

            const nextExercises = workout.exercises.map((exercise) => {
                if (exercise.id !== workoutExerciseId) {
                    return exercise;
                }

                const existingLogIndex = exercise.logs.findIndex((log) => log.setNumber === setNumber);
                const newLog = res.data.log;
                const nextLogs = [...exercise.logs];

                if (existingLogIndex >= 0) {
                    nextLogs[existingLogIndex] = newLog;
                } else {
                    nextLogs.push(newLog);
                }

                return { ...exercise, logs: nextLogs };
            });

            const currentIndex = nextExercises.findIndex((exercise) => exercise.id === workoutExerciseId);
            const currentExercise = currentIndex >= 0 ? nextExercises[currentIndex] : null;
            const currentExerciseDone = currentExercise ? isExerciseComplete(currentExercise) : false;

            let nextExerciseId = currentExercise?.id ?? null;

            if (currentExerciseDone && currentIndex >= 0) {
                const nextUnfinishedExercise = nextExercises
                    .slice(currentIndex + 1)
                    .find((exercise) => !isExerciseComplete(exercise));

                nextExerciseId = nextUnfinishedExercise?.id ?? nextExercises[currentIndex + 1]?.id ?? currentExercise?.id ?? null;
            }

            setWorkout({
                ...workout,
                exercises: nextExercises,
            });

            if (nextExerciseId && nextExerciseId !== currentExercise?.id) {
                pendingScrollExerciseId.current = nextExerciseId;
            }

            if (nextExerciseId) {
                setExpandedExerciseId(nextExerciseId);
            }
        } catch (logError) {
            console.error('Failed to log set', logError);
        }
    };

    const handleCompleteWorkout = async () => {
        if (!workout) {
            return;
        }

        const totalSets = workout.exercises.reduce((sum, item) => sum + item.targetSets, 0);
        const completedSets = workout.exercises.reduce((sum, item) => sum + getCompletedSets(item), 0);

        if (completedSets < totalSets) {
            setCompletionError('Complete all planned sets before marking this workout done.');
            return;
        }

        setCompleting(true);
        setCompletionError(null);
        try {
            await api.post('/workout/day/complete', { dayId });
            navigate('/dashboard');
        } catch (completeError: any) {
            console.error('Failed to complete workout', completeError);
            setCompletionError(
                completeError?.response?.data?.message ||
                'Unable to complete this workout right now.'
            );
        } finally {
            setCompleting(false);
        }
    };

    if (loading) {
        return (
            <div className="app-shell px-4 py-8">
                <div className="mobile-shell">
                    <div className="surface-panel animate-pulse p-6">
                        <div className="h-4 w-24 rounded-full bg-[#DDE7EA]" />
                        <div className="mt-4 h-10 w-48 rounded-full bg-[#DDE7EA]" />
                        <div className="mt-6 h-64 rounded-[28px] bg-[#F1F4F6]" />
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return <div className="p-8 text-center text-red-600">{error}</div>;
    }

    if (!workout) {
        return <div className="p-8 text-center">Workout not found</div>;
    }

    if (workout.exercises.length === 0) {
        return (
            <div className="app-shell px-4 py-6">
                <div className="mobile-shell gap-4">
                    <header className="flex items-center gap-3 px-1">
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#DDE7EA] bg-white text-[#66758A] shadow-[0_12px_30px_rgba(11,18,32,0.10)]"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </button>
                        <div>
                            <p className="section-label">Day {workout.dayNumber}</p>
                            <h1 className="text-2xl font-black tracking-tight text-[#0B1220]">{workout.title}</h1>
                        </div>
                    </header>

                    <section className="overflow-hidden rounded-[30px] bg-[linear-gradient(135deg,#0B1220_0%,#10243B_60%,#18BDB2_130%)] p-6 text-white shadow-[0_24px_54px_rgba(11,18,32,0.30)]">
                        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-[#D7E0EA]">Recovery day</p>
                        <h2 className="mt-3 text-3xl font-black tracking-tight">No training blocks today.</h2>
                        <p className="mt-3 text-sm leading-6 text-[#D7E0EA]">
                            Use today to walk, stretch lightly, or simply recover so tomorrow feels sharper. You can still mark the day complete to keep the plan moving.
                        </p>
                        <button
                            onClick={handleCompleteWorkout}
                            disabled={completing}
                            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-6 py-4 text-sm font-bold uppercase tracking-[0.18em] text-[#0B1220] transition hover:bg-[#F7FAFA] disabled:cursor-wait disabled:opacity-70"
                        >
                            {completing ? 'Completing...' : 'Complete recovery day'}
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    </section>
                </div>
            </div>
        );
    }

    const totalSets = workout.exercises.reduce((sum, item) => sum + item.targetSets, 0);
    const completedSets = workout.exercises.reduce((sum, item) => sum + getCompletedSets(item), 0);
    const progressPercent = totalSets > 0 ? Math.round((completedSets / totalSets) * 100) : 0;
    const canCompleteWorkout = completedSets >= totalSets;

    return (
        <div className="app-shell px-4 py-4">
            <div className="mobile-shell gap-4">
                <header className="overflow-hidden rounded-[30px] bg-[linear-gradient(135deg,#0B1220_0%,#10243B_60%,#18BDB2_130%)] px-5 py-5 text-white shadow-[0_26px_56px_rgba(11,18,32,0.32)]">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex min-w-0 items-start gap-3">
                            <button
                                onClick={() => navigate('/dashboard')}
                                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/16 bg-white/10 text-white backdrop-blur-sm"
                            >
                                <ArrowLeft className="h-5 w-5" />
                            </button>
                            <div className="min-w-0">
                                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-[#D7E0EA]">Day {workout.dayNumber}</p>
                                <h1 className="mt-2 text-2xl font-black tracking-tight">
                                    {workout.title}
                                </h1>
                            </div>
                        </div>

                        <div className="rounded-[20px] border border-white/10 bg-white/8 px-3 py-3 text-right backdrop-blur-sm">
                            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-[#D7E0EA]">Sets</p>
                            <p className="mt-1 text-lg font-black">{completedSets}/{totalSets}</p>
                        </div>
                    </div>

                    <div className="mt-5">
                        <div className="h-2.5 overflow-hidden rounded-full bg-white/12">
                            <div
                                className="h-full rounded-full bg-[linear-gradient(90deg,#D7E0EA_0%,#A9E7E1_40%,#22C7B8_100%)]"
                                style={{ width: `${progressPercent}%` }}
                            />
                        </div>
                        <p className="mt-3 text-sm font-medium text-[#D7E0EA]">{progressPercent}% complete</p>
                    </div>
                </header>

                <main className="space-y-4">
                    {workout.exercises.map((exercise, index) => {
                        const completedExerciseSets = getCompletedSets(exercise);
                        const isComplete = isExerciseComplete(exercise);
                        const isExpanded = expandedExerciseId === exercise.id;

                        return (
                            <article
                                key={exercise.id}
                                ref={(element) => {
                                    exerciseRefs.current[exercise.id] = element;
                                }}
                                className={clsx(
                                    'mobile-card overflow-hidden p-0 transition',
                                    isExpanded && 'ring-2 ring-[#22C7B8]/30 shadow-[0_20px_44px_rgba(11,18,32,0.14)]',
                                    isComplete && 'border-[#22C7B8] bg-[#F3FFFC]'
                                )}
                            >
                                <button
                                    type="button"
                                    onClick={() => setExpandedExerciseId(exercise.id)}
                                    className="flex w-full items-start justify-between gap-3 px-4 pb-3 pt-4 text-left"
                                >
                                    <div className="min-w-0">
                                        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-[#66758A]">
                                            Exercise {index + 1}
                                        </p>
                                        <h2 className="mt-2 text-xl font-black tracking-tight text-[#0B1220]">
                                            {exercise.exercise.name}
                                        </h2>
                                        <p className="mt-2 text-sm leading-6 text-[#66758A]">
                                            {exercise.exercise.description || 'Follow the target, keep the movement controlled, and move on when all sets are complete.'}
                                        </p>
                                    </div>

                                    <div className="shrink-0 rounded-[18px] bg-[#F1F4F6] px-3 py-2 text-right">
                                        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-[#66758A]">Progress</p>
                                        <p className="mt-1 text-sm font-black text-[#0B1220]">{completedExerciseSets}/{exercise.targetSets}</p>
                                    </div>
                                </button>

                                <div className="flex justify-end px-4 pb-4">
                                    <div className="inline-flex items-center gap-2 rounded-full border border-[#DDE7EA] bg-white px-4 py-2 text-sm font-black text-[#0B1220] shadow-[0_10px_24px_rgba(11,18,32,0.08)]">
                                        <TimerReset className="h-4 w-4 text-[#0EAFA3]" />
                                        {exercise.targetRestSeconds ?? 0}s rest
                                    </div>
                                </div>

                                <div className="px-4 pb-4">
                                    <ExerciseMedia
                                        title={exercise.exercise.name}
                                        videoUrl={exercise.exercise.videoUrl}
                                        isExpanded={isExpanded}
                                        onToggle={() => setExpandedExerciseId((current) => current === exercise.id ? null : exercise.id)}
                                    />
                                </div>

                                <div className="space-y-2 border-t border-[#E7EEF0] bg-white/70 px-4 py-4">
                                    {Array.from({ length: exercise.targetSets }, (_, itemIndex) => {
                                        const setNumber = itemIndex + 1;
                                        const log = exercise.logs.find((entry) => entry.setNumber === setNumber);
                                        const isDone = Boolean(log?.isDone);

                                        return (
                                            <div
                                                key={setNumber}
                                                className={clsx(
                                                    'flex items-center justify-between rounded-[18px] border px-4 py-3 transition',
                                                    isDone
                                                        ? 'border-[#22C7B8] bg-[#F3FFFC]'
                                                        : 'border-[#E1E8ED] bg-white'
                                                )}
                                            >
                                                <div>
                                                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#66758A]">
                                                        Set {setNumber}
                                                    </p>
                                                    <p className="mt-1 text-sm font-black text-[#0B1220]">
                                                        {getSetTargetLabel(exercise)}
                                                    </p>
                                                </div>

                                                <button
                                                    onClick={() => handleLogSet(exercise.id, exercise.exerciseId, setNumber, exercise.targetReps ?? 0, 0)}
                                                    className={clsx(
                                                        'inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-xs font-bold uppercase tracking-[0.16em] transition',
                                                        isDone
                                                            ? 'bg-[#132238] text-white'
                                                            : 'bg-[linear-gradient(135deg,#0B1220_0%,#10243B_55%,#17BDB2_130%)] text-white shadow-[0_12px_24px_rgba(11,18,32,0.18)]'
                                                    )}
                                                >
                                                    {isDone ? (
                                                        <>
                                                            <CheckCircle2 className="h-4 w-4" />
                                                            Done
                                                        </>
                                                    ) : (
                                                        <>
                                                            <PlayCircle className="h-4 w-4" />
                                                            Mark done
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>

                                {isComplete && (
                                    <div className="border-t border-[#E7EEF0] px-4 py-4">
                                        <div className="rounded-full bg-[#E8FBF8] px-3 py-2 text-xs font-bold uppercase tracking-[0.16em] text-[#0E6D68] w-fit">
                                            Completed
                                        </div>
                                    </div>
                                )}
                            </article>
                        );
                    })}
                </main>

                <section className="mobile-card flex flex-col gap-4">
                    <div>
                        <p className="section-label">Finish session</p>
                        <p className="mt-2 text-base font-semibold text-[#66758A]">
                            {completedSets} of {totalSets} sets logged across {workout.exercises.length} exercises.
                        </p>
                        {completionError && (
                            <p className="mt-3 rounded-[18px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
                                {completionError}
                            </p>
                        )}
                    </div>
                    <button
                        onClick={handleCompleteWorkout}
                        disabled={completing || !canCompleteWorkout}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#0B1220_0%,#10243B_55%,#17BDB2_130%)] px-6 py-4 text-sm font-bold uppercase tracking-[0.18em] text-white shadow-[0_16px_32px_rgba(11,18,32,0.18)] transition hover:opacity-95 disabled:cursor-wait disabled:opacity-70"
                    >
                        {completing ? 'Completing...' : canCompleteWorkout ? 'Complete workout' : 'Finish all sets'}
                        <ChevronRight className="h-4 w-4" />
                    </button>
                </section>
            </div>
        </div>
    );
}
