import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import {
    CheckCircle2,
    ChevronRight,
    Compass,
    History as HistoryIcon,
    LoaderCircle,
    PlayCircle,
    Sparkles,
    TimerReset,
} from 'lucide-react';
import { api } from '../lib/axios';
import { useAuthStore } from '../store/authStore';
import { ExerciseMedia } from '../components/ExerciseMedia';
import { APP_NAME } from '../lib/brand';
import logoImage from '../assets/brand/workout-planner-logo.png';
import fullBodyArt from '../assets/focus/full-body.jpg';
import absArt from '../assets/focus/abs.jpg';
import legsArt from '../assets/focus/legs.jpg';
import buttArt from '../assets/focus/butt.jpg';
import armsArt from '../assets/focus/arms.jpg';

type DashboardTab = 'plan' | 'discover' | 'history';
const POST_AUTH_NOTICE_KEY = 'post_auth_notice';
const ONBOARDING_NOTICE_PATTERNS = [
    'answer a few questions',
    'continue onboarding',
    'build your plan',
];
type FocusKey = 'full-body' | 'abs' | 'legs' | 'butt' | 'arms';

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

interface FocusWorkoutExercise {
    id: string;
    phase: 'warm-up' | 'main' | 'cool-down';
    name: string;
    muscleGroup: string;
    difficulty: string;
    description: string;
    videoUrl: string | null;
    targetLabel: string;
    targetSets: number;
    targetReps: number | null;
    targetSeconds?: number | null;
    targetRestSeconds?: number | null;
}

interface FocusWorkout {
    key: FocusKey;
    label: string;
    summary: string;
    profileSummary: string;
    estimatedMinutes: number;
    experienceLevel: string;
    exercises: FocusWorkoutExercise[];
}

const FOCUS_OPTIONS: Array<{ key: FocusKey; label: string; blurb: string; image: string; imagePosition?: string }> = [
    { key: 'full-body', label: 'Full body', blurb: 'Balanced daily training', image: fullBodyArt, imagePosition: 'center top' },
    { key: 'abs', label: 'Abs', blurb: 'Core and trunk control', image: absArt, imagePosition: 'center top' },
    { key: 'legs', label: 'Legs', blurb: 'Lower body power', image: legsArt, imagePosition: 'center top' },
    { key: 'butt', label: 'Butt', blurb: 'Glute-focused work', image: buttArt, imagePosition: 'center top' },
    { key: 'arms', label: 'Arms', blurb: 'Push and pull upper body', image: armsArt, imagePosition: 'center top' },
];

const FOCUS_PHASE_META: Record<FocusWorkoutExercise['phase'], { label: string; description: string }> = {
    'warm-up': {
        label: 'Warm-up',
        description: 'Open the joints and raise body temperature before the work sets.',
    },
    main: {
        label: 'Main workout',
        description: 'Primary training block matched to your selected body focus.',
    },
    'cool-down': {
        label: 'Cool-down',
        description: 'Stretch and reset after the main effort.',
    },
};

function getFocusSetTargetLabel(exercise: FocusWorkoutExercise) {
    if (exercise.targetReps != null) {
        return `${exercise.targetReps} reps`;
    }

    if (exercise.targetSeconds != null) {
        return `${exercise.targetSeconds} seconds`;
    }

    return 'Planned set';
}

function getStreak(days: Day[]) {
    let streak = 0;
    for (const day of days) {
        if (!day.isCompleted) {
            break;
        }
        streak += 1;
    }
    return streak;
}

function formatCompletionDate(date: string | null) {
    if (!date) {
        return '';
    }

    return new Date(date).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
    });
}

function formatMonthLabel(date: string) {
    return new Date(date).toLocaleDateString(undefined, {
        month: 'long',
        year: 'numeric',
    });
}

function toDateKey(date: Date) {
    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0'),
    ].join('-');
}

function getHistoryGroups(days: Day[]) {
    const completedDays = days
        .filter((day) => day.completedAt)
        .sort((left, right) => new Date(right.completedAt ?? 0).getTime() - new Date(left.completedAt ?? 0).getTime());

    const groups: Array<{ month: string; items: Day[] }> = [];

    for (const day of completedDays) {
        const month = formatMonthLabel(day.completedAt!);
        const group = groups.find((entry) => entry.month === month);

        if (group) {
            group.items.push(day);
        } else {
            groups.push({ month, items: [day] });
        }
    }

    return groups;
}

function getCalendarCells(days: Day[]) {
    const currentMonth = new Date();
    const calendarStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    calendarStart.setDate(calendarStart.getDate() - calendarStart.getDay());

    const completedDates = new Set(
        days
            .filter((day) => day.completedAt)
            .map((day) => toDateKey(new Date(day.completedAt!)))
    );

    return Array.from({ length: 35 }, (_, index) => {
        const date = new Date(calendarStart);
        date.setDate(calendarStart.getDate() + index);

        return {
            key: toDateKey(date),
            dayNumber: date.getDate(),
            isCurrentMonth: date.getMonth() === currentMonth.getMonth(),
            isToday: toDateKey(date) === toDateKey(new Date()),
            isCompleted: completedDates.has(toDateKey(date)),
        };
    });
}

function isStaleOnboardingNotice(message: string | null) {
    if (!message) return false;
    const normalized = message.toLowerCase();

    return ONBOARDING_NOTICE_PATTERNS.some((pattern) => normalized.includes(pattern));
}

function PlanTab({
    plan,
    onOpenDay,
    onRebuild,
}: {
    plan: Plan;
    onOpenDay: (dayId: string) => void;
    onRebuild: () => void;
}) {
    const currentDay = plan.days.find((day) => !day.isCompleted) ?? null;
    const completedDays = plan.days.filter((day) => day.isCompleted).length;
    const remainingDays = plan.days.length - completedDays;
    const streak = getStreak(plan.days);
    const progressPercent = Math.round((completedDays / plan.days.length) * 100);

    return (
        <div className="space-y-4">
            <section className="overflow-hidden rounded-[30px] bg-[linear-gradient(135deg,#0B1220_0%,#10243B_60%,#18BDB2_130%)] p-5 text-white shadow-[0_26px_56px_rgba(11,18,32,0.32)]">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-[#D7E0EA]">Current plan</p>
                <h2 className="mt-3 text-2xl font-black tracking-tight">
                    {currentDay ? currentDay.title : 'You finished the current block'}
                </h2>
                <p className="mt-3 max-w-sm text-sm leading-6 text-[#D7E0EA]">
                    {currentDay
                        ? 'Jump into the next guided workout or open any day from the plan below.'
                        : 'Rebuild a new 30-day sequence when you want a fresh program.'}
                </p>

                <div className="mt-5 grid grid-cols-3 gap-3">
                    <div className="rounded-[20px] border border-white/10 bg-white/8 px-3 py-3 backdrop-blur-sm">
                        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-[#D7E0EA]">Done</p>
                        <p className="mt-2 text-xl font-black">{completedDays}/30</p>
                    </div>
                    <div className="rounded-[20px] border border-white/10 bg-white/8 px-3 py-3 backdrop-blur-sm">
                        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-[#D7E0EA]">Left</p>
                        <p className="mt-2 text-xl font-black">{remainingDays}</p>
                    </div>
                    <div className="rounded-[20px] border border-white/10 bg-white/8 px-3 py-3 backdrop-blur-sm">
                        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-[#D7E0EA]">Streak</p>
                        <p className="mt-2 text-xl font-black">{streak}d</p>
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

                <div className="mt-5 flex gap-3">
                    <button
                        onClick={() => currentDay ? onOpenDay(currentDay.id) : onRebuild()}
                        className="flex-1 rounded-full bg-white px-4 py-3 text-sm font-bold uppercase tracking-[0.16em] text-[#0B1220] transition hover:bg-[#F7FAFA]"
                    >
                        {currentDay ? 'Continue' : 'Build again'}
                    </button>
                    <button
                        onClick={onRebuild}
                        className="rounded-full border border-white/20 px-4 py-3 text-sm font-bold uppercase tracking-[0.16em] text-[#EAF7F5] transition hover:bg-white/8"
                    >
                        Reset
                    </button>
                </div>
            </section>

            <section className="mobile-card space-y-4">
                <div>
                    <h3 className="text-xl font-black tracking-tight text-[#0B1220]">30-day plan</h3>
                </div>

                <div className="space-y-2">
                    {plan.days.map((day) => {
                        const isCurrent = currentDay?.id === day.id;
                        return (
                            <button
                                key={day.id}
                                type="button"
                                onClick={() => onOpenDay(day.id)}
                                className={clsx(
                                    'flex w-full items-center justify-between rounded-[20px] border px-4 py-3 text-left transition',
                                    isCurrent
                                        ? 'border-[#22C7B8] bg-[#F3FFFC] shadow-[0_12px_24px_rgba(34,199,184,0.08)]'
                                        : day.isCompleted
                                            ? 'border-[#DDE7EA] bg-[#F7FAFA]'
                                            : 'border-[#E1E8ED] bg-white shadow-[0_10px_22px_rgba(11,18,32,0.04)]'
                                )}
                            >
                                <div className="min-w-0">
                                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-[#66758A]">
                                        Day {day.dayNumber}
                                    </p>
                                    <p className="mt-1 truncate text-sm font-bold text-[#0B1220]">{day.title}</p>
                                </div>
                                <div className="ml-4 flex items-center gap-2">
                                    {day.isCompleted ? (
                                        <CheckCircle2 className="h-4 w-4 text-[#0EAFA3]" />
                                    ) : (
                                        <ChevronRight className="h-4 w-4 text-[#738097]" />
                                    )}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </section>
        </div>
    );
}

function DiscoverTab({
    activeFocus,
    onFocusChange,
    focusWorkout,
    focusLoading,
    focusError,
    onRebuild,
}: {
    activeFocus: FocusKey;
    onFocusChange: (focusKey: FocusKey) => void;
    focusWorkout: FocusWorkout | undefined;
    focusLoading: boolean;
    focusError: string | null;
    onRebuild: () => void;
}) {
    const workoutSectionRef = useRef<HTMLElement | null>(null);
    const exerciseCardRefs = useRef<Record<string, HTMLElement | null>>({});
    const pendingExerciseScrollId = useRef<string | null>(null);
    const [expandedPreviewId, setExpandedPreviewId] = useState<string | null>(null);
    const [pendingScroll, setPendingScroll] = useState(false);
    const [completedSetsByFocus, setCompletedSetsByFocus] = useState<Partial<Record<FocusKey, Record<string, number[]>>>>({});

    const completedSetLookup = completedSetsByFocus[activeFocus] ?? {};

    const focusSections = useMemo(() => {
        if (!focusWorkout) {
            return [];
        }

        return (['warm-up', 'main', 'cool-down'] as const)
            .map((phase) => ({
                phase,
                ...FOCUS_PHASE_META[phase],
                exercises: focusWorkout.exercises.filter((exercise) => exercise.phase === phase),
            }))
            .filter((section) => section.exercises.length > 0);
    }, [focusWorkout]);

    function getCompletedDiscoverSets(exerciseId: string) {
        return completedSetLookup[exerciseId]?.length ?? 0;
    }

    useEffect(() => {
        if (!focusWorkout) {
            return;
        }

        const firstOpenExercise = focusWorkout.exercises.find((exercise) => getCompletedDiscoverSets(exercise.id) < exercise.targetSets)
            ?? focusWorkout.exercises[0]
            ?? null;

        if (!expandedPreviewId || !focusWorkout.exercises.some((exercise) => exercise.id === expandedPreviewId)) {
            setExpandedPreviewId(firstOpenExercise?.id ?? null);
        }
    }, [completedSetLookup, expandedPreviewId, focusWorkout]);

    useEffect(() => {
        if (!pendingScroll || focusLoading || !workoutSectionRef.current) {
            return;
        }

        const timeout = window.setTimeout(() => {
            workoutSectionRef.current?.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
            });
            setPendingScroll(false);
        }, 120);

        return () => window.clearTimeout(timeout);
    }, [pendingScroll, focusError, focusLoading, focusWorkout]);

    useEffect(() => {
        const targetExerciseId = pendingExerciseScrollId.current ?? expandedPreviewId;
        if (!targetExerciseId) {
            return;
        }

        const element = exerciseCardRefs.current[targetExerciseId];
        if (!element) {
            return;
        }

        const timeout = window.setTimeout(() => {
            element.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
            });
            pendingExerciseScrollId.current = null;
        }, 80);

        return () => window.clearTimeout(timeout);
    }, [activeFocus, completedSetLookup, expandedPreviewId, focusWorkout]);

    const handleMarkDiscoverSetDone = (exerciseId: string, setNumber: number) => {
        if (!focusWorkout) {
            return;
        }

        const currentExercise = focusWorkout.exercises.find((exercise) => exercise.id === exerciseId);
        if (!currentExercise) {
            return;
        }

        const existingDoneSets = completedSetLookup[exerciseId] ?? [];
        if (existingDoneSets.includes(setNumber)) {
            return;
        }

        const nextDoneSets = [...existingDoneSets, setNumber].sort((left, right) => left - right);
        const currentExerciseCompleted = nextDoneSets.length >= currentExercise.targetSets;

        let nextExpandedExerciseId = exerciseId;

        if (currentExerciseCompleted) {
            const currentIndex = focusWorkout.exercises.findIndex((exercise) => exercise.id === exerciseId);
            const nextUnfinishedExercise = focusWorkout.exercises
                .slice(currentIndex + 1)
                .find((exercise) => {
                    const alreadyDone = exercise.id === exerciseId
                        ? nextDoneSets.length
                        : getCompletedDiscoverSets(exercise.id);
                    return alreadyDone < exercise.targetSets;
                });

            nextExpandedExerciseId = nextUnfinishedExercise?.id ?? focusWorkout.exercises[currentIndex + 1]?.id ?? exerciseId;
        }

        setCompletedSetsByFocus((current) => ({
            ...current,
            [activeFocus]: {
                ...(current[activeFocus] ?? {}),
                [exerciseId]: nextDoneSets,
            },
        }));

        if (nextExpandedExerciseId !== exerciseId) {
            pendingExerciseScrollId.current = nextExpandedExerciseId;
        }

        setExpandedPreviewId(nextExpandedExerciseId);
    };

    return (
        <div className="space-y-4">
            <section className="mobile-card overflow-hidden p-0">
                <div className="bg-[linear-gradient(135deg,#0B1220_0%,#10243B_60%,#18BDB2_130%)] px-5 py-5 text-white">
                    <h2 className="mt-2 text-2xl font-black tracking-tight">Pick an area to train</h2>
                    <p className="mt-2 text-sm leading-6 text-[#D7E0EA]">
                        Inspired by category-first workout apps: quick visual picks, then a tight list of exercises matched to your time and level.
                    </p>
                </div>

                <div className="grid grid-cols-2 gap-3 p-4">
                    {FOCUS_OPTIONS.map((focus) => {
                        const isActive = activeFocus === focus.key;
                        return (
                            <button
                                key={focus.key}
                                type="button"
                                onClick={() => {
                                    onFocusChange(focus.key);
                                    setPendingScroll(true);
                                }}
                                className={clsx(
                                    'overflow-hidden rounded-[24px] border text-left transition',
                                    isActive
                                        ? 'border-[#22C7B8] bg-[#F3FFFC] shadow-[0_16px_32px_rgba(34,199,184,0.08)]'
                                        : 'border-[#E1E8ED] bg-white shadow-[0_12px_24px_rgba(11,18,32,0.06)]'
                                )}
                            >
                                <div className="bg-[#F1F4F6]">
                                    <img src={focus.image} alt={focus.label} className="h-28 w-full object-cover" style={{ objectPosition: focus.imagePosition }} />
                                </div>
                                <div className="px-3 pb-4 pt-3">
                                    <p className="text-sm font-black text-[#0B1220]">{focus.label}</p>
                                    <p className="mt-1 text-xs leading-5 text-[#66758A]">{focus.blurb}</p>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </section>

            <section ref={workoutSectionRef} className="space-y-4">
                {focusLoading && !focusWorkout ? (
                    <div className="mobile-card flex items-center gap-3 text-sm font-semibold text-[#66758A]">
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                        Loading your workout suggestions...
                    </div>
                ) : focusError && !focusWorkout ? (
                    <div className="mobile-card space-y-3">
                        <div className="rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-4 text-sm font-medium text-rose-700">
                            {focusError}
                        </div>
                        <button
                            onClick={onRebuild}
                            className="rounded-full bg-[linear-gradient(135deg,#0B1220_0%,#10243B_55%,#17BDB2_130%)] px-5 py-3 text-sm font-bold uppercase tracking-[0.16em] text-white shadow-[0_14px_28px_rgba(11,18,32,0.18)]"
                        >
                            Complete onboarding
                        </button>
                    </div>
                ) : focusWorkout ? (
                    <div className="space-y-4">
                        <section className="overflow-hidden rounded-[30px] bg-[linear-gradient(135deg,#0B1220_0%,#10243B_60%,#18BDB2_130%)] px-5 py-5 text-white shadow-[0_26px_56px_rgba(11,18,32,0.32)]">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-[#D7E0EA]">Discover workout</p>
                                    <h3 className="mt-2 text-2xl font-black tracking-tight">{focusWorkout.label}</h3>
                                    <p className="mt-3 text-sm leading-6 text-[#D7E0EA]">{focusWorkout.summary}</p>
                                </div>
                                <div className="rounded-[20px] border border-white/10 bg-white/8 px-3 py-3 text-right backdrop-blur-sm">
                                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-[#D7E0EA]">Length</p>
                                    <p className="mt-1 text-lg font-black">{focusWorkout.estimatedMinutes} min</p>
                                </div>
                            </div>

                            <div className="mt-5 flex flex-wrap gap-2">
                                <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-[#EAF7F5]">
                                    {focusWorkout.profileSummary}
                                </span>
                                <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-[#EAF7F5]">
                                    {focusWorkout.exercises.length} exercises
                                </span>
                            </div>
                        </section>

                        {focusSections.map((section) => (
                            <section key={section.phase} className="space-y-3">
                                <div className="px-1">
                                    <p className="section-label">{section.label}</p>
                                    <p className="mt-1 text-sm text-[#66758A]">{section.description}</p>
                                </div>

                                <div className="space-y-4">
                                    {section.exercises.map((exercise, index) => {
                                        const isExpanded = expandedPreviewId === exercise.id;
                                        const completedExerciseSets = getCompletedDiscoverSets(exercise.id);
                                        const isComplete = completedExerciseSets >= exercise.targetSets;

                                        return (
                                            <article
                                                key={exercise.id}
                                                ref={(element) => {
                                                    exerciseCardRefs.current[exercise.id] = element;
                                                }}
                                                className={clsx(
                                                    'mobile-card overflow-hidden p-0 transition',
                                                    isExpanded && 'ring-2 ring-[#22C7B8]/30 shadow-[0_20px_44px_rgba(11,18,32,0.14)]',
                                                    isComplete && 'border-[#22C7B8] bg-[#F3FFFC]'
                                                )}
                                            >
                                                <button
                                                    type="button"
                                                    onClick={() => setExpandedPreviewId(exercise.id)}
                                                    className="flex w-full items-start justify-between gap-3 px-4 pb-3 pt-4 text-left"
                                                >
                                                    <div className="min-w-0">
                                                        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-[#66758A]">
                                                            {section.label} {index + 1}
                                                        </p>
                                                        <h4 className="mt-2 text-xl font-black tracking-tight text-[#0B1220]">
                                                            {exercise.name}
                                                        </h4>
                                                        <p className="mt-2 text-sm leading-6 text-[#66758A]">
                                                            {exercise.description || 'Follow the listed sets with steady control and clean range of motion.'}
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
                                                        title={exercise.name}
                                                        videoUrl={exercise.videoUrl}
                                                        isExpanded={isExpanded}
                                                        onToggle={() => setExpandedPreviewId((current) => current === exercise.id ? null : exercise.id)}
                                                    />
                                                </div>

                                                <div className="space-y-2 border-t border-[#E7EEF0] bg-white/70 px-4 py-4">
                                                    {Array.from({ length: exercise.targetSets }, (_, itemIndex) => {
                                                        const setNumber = itemIndex + 1;
                                                        const isDone = (completedSetLookup[exercise.id] ?? []).includes(setNumber);

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
                                                                        {getFocusSetTargetLabel(exercise)}
                                                                    </p>
                                                                </div>

                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleMarkDiscoverSetDone(exercise.id, setNumber)}
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
                                                        <div className="w-fit rounded-full bg-[#E8FBF8] px-3 py-2 text-xs font-bold uppercase tracking-[0.16em] text-[#0E6D68]">
                                                            Completed
                                                        </div>
                                                    </div>
                                                )}
                                            </article>
                                        );
                                    })}
                                </div>
                            </section>
                        ))}
                    </div>
                ) : null}
            </section>
        </div>
    );
}

function HistoryTab({
    plan,
    onOpenDay,
}: {
    plan: Plan;
    onOpenDay: (dayId: string) => void;
}) {
    const historyGroups = getHistoryGroups(plan.days);
    const calendarCells = useMemo(() => getCalendarCells(plan.days), [plan.days]);
    const currentMonthLabel = new Date().toLocaleDateString(undefined, {
        month: 'long',
        year: 'numeric',
    });

    return (
        <div className="space-y-4">
            <section className="mobile-card space-y-4">
                <div className="flex items-end justify-between gap-3">
                    <div>
                        <p className="section-label">History</p>
                        <h2 className="mt-1 text-xl font-black tracking-tight text-[#0B1220]">Completed workouts</h2>
                    </div>
                </div>

                {historyGroups.length === 0 ? (
                    <div className="rounded-[20px] border border-dashed border-[#DDE7EA] bg-white px-4 py-8 text-center">
                        <p className="text-sm font-semibold text-[#0B1220]">No completed workouts yet.</p>
                        <p className="mt-2 text-sm leading-6 text-[#66758A]">Finish a session and it will show up here.</p>
                    </div>
                ) : (
                    <div className="space-y-5">
                        {historyGroups.map((group) => (
                            <div key={group.month} className="space-y-2.5">
                                <p className="section-label">{group.month}</p>
                                {group.items.map((day) => (
                                    <button
                                        key={day.id}
                                        type="button"
                                        onClick={() => onOpenDay(day.id)}
                                        className="flex w-full items-center justify-between rounded-[18px] border border-[#E1E8ED] bg-white px-4 py-3 text-left transition hover:bg-[#F7FAFA]"
                                    >
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-bold text-[#0B1220]">{day.title}</p>
                                            <p className="mt-1 text-xs font-medium uppercase tracking-[0.16em] text-[#66758A]">
                                                {formatCompletionDate(day.completedAt)}
                                            </p>
                                        </div>
                                        <CheckCircle2 className="h-4 w-4 shrink-0 text-[#0EAFA3]" />
                                    </button>
                                ))}
                            </div>
                        ))}
                    </div>
                )}
            </section>

            <section className="mobile-card space-y-4">
                <div>
                    <p className="section-label">Calendar</p>
                    <h3 className="mt-1 text-xl font-black tracking-tight text-[#0B1220]">{currentMonthLabel}</h3>
                </div>

                <div className="grid grid-cols-7 gap-1.5 text-center text-[0.62rem] font-bold uppercase tracking-[0.16em] text-[#738097]">
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((label, index) => (
                        <div key={`${label}-${index}`} className="py-1">
                            {label}
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-7 gap-1.5">
                    {calendarCells.map((cell) => (
                        <div
                            key={cell.key}
                            className={clsx(
                                'flex aspect-square items-center justify-center rounded-[14px] text-sm font-semibold',
                                cell.isCurrentMonth
                                    ? 'bg-[#F1F4F6] text-[#66758A]'
                                    : 'bg-transparent text-[#738097]/45',
                                cell.isCompleted && 'bg-[linear-gradient(135deg,#0B1220_0%,#10243B_55%,#17BDB2_130%)] text-white shadow-[0_10px_20px_rgba(11,18,32,0.18)]',
                                cell.isToday && !cell.isCompleted && 'ring-2 ring-[#22C7B8]/30'
                            )}
                        >
                            {cell.dayNumber}
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}

export function DashboardPage() {
    const navigate = useNavigate();
    const logout = useAuthStore((state) => state.logout);

    const [plan, setPlan] = useState<Plan | null>(null);
    const [profileExists, setProfileExists] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [activeTab, setActiveTab] = useState<DashboardTab>('plan');
    const [authNotice, setAuthNotice] = useState<string | null>(null);
    const [activeFocus, setActiveFocus] = useState<FocusKey>('full-body');
    const [focusWorkouts, setFocusWorkouts] = useState<Partial<Record<FocusKey, FocusWorkout>>>({});
    const [focusLoadingKey, setFocusLoadingKey] = useState<FocusKey | null>(null);
    const [focusError, setFocusError] = useState<string | null>(null);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    useEffect(() => {
        const pendingNotice = sessionStorage.getItem(POST_AUTH_NOTICE_KEY);
        if (!pendingNotice) return;

        setAuthNotice(pendingNotice);
        sessionStorage.removeItem(POST_AUTH_NOTICE_KEY);
    }, []);

    useEffect(() => {
        const fetchPlan = async () => {
            try {
                const res = await api.get('/workout/plan/current');
                setPlan(res.data.plan);
                setProfileExists(Boolean(res.data.profileExists));
                setError(null);
            } catch (fetchError) {
                console.error('Failed to fetch plan', fetchError);
                setError('Unable to load your plan. Check the backend connection and try again.');
            } finally {
                setLoading(false);
            }
        };

        void fetchPlan();
    }, []);

    useEffect(() => {
        if (activeTab !== 'discover') {
            return;
        }

        if (focusWorkouts[activeFocus] || focusLoadingKey === activeFocus) {
            return;
        }

        const fetchFocusWorkout = async () => {
            try {
                setFocusLoadingKey(activeFocus);
                setFocusError(null);
                const res = await api.get('/workout/focus', {
                    params: { focusKey: activeFocus }
                });
                setFocusWorkouts((current) => ({
                    ...current,
                    [activeFocus]: res.data.focusWorkout,
                }));
            } catch (fetchError: any) {
                console.error('Failed to fetch focus workout', fetchError);
                if (fetchError?.response?.status === 404) {
                    setFocusError('Finish onboarding first so the app knows your available time, equipment, and level.');
                } else {
                    setFocusError('Unable to load body-focus recommendations right now.');
                }
            } finally {
                setFocusLoadingKey(null);
            }
        };

        void fetchFocusWorkout();
    }, [activeFocus, activeTab, focusLoadingKey, focusWorkouts]);

    if (loading) {
        return (
            <div className="app-shell px-4 py-8">
                <div className="mobile-shell">
                    <div className="surface-panel animate-pulse p-6">
                        <div className="h-4 w-24 rounded-full bg-[#DDE7EA]" />
                        <div className="mt-4 h-10 w-56 rounded-full bg-[#DDE7EA]" />
                        <div className="mt-6 h-48 rounded-[28px] bg-[#F1F4F6]" />
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="app-shell px-4 py-8">
                <div className="mobile-shell">
                    <div className="surface-panel space-y-6 p-8 text-center">
                        <p className="section-label">Dashboard unavailable</p>
                        <h1 className="text-3xl font-black tracking-tight text-[#0B1220]">
                            We could not load your plan.
                        </h1>
                        <p className="text-base leading-7 text-[#66758A]">{error}</p>
                        <button
                            onClick={handleLogout}
                            className="rounded-full border border-[#DDE7EA] px-5 py-3 text-sm font-bold uppercase tracking-[0.18em] text-[#66758A] transition hover:bg-[#F7FAFA]"
                        >
                            Logout
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (!plan) {
        const title = profileExists
            ? 'We could not find an active plan.'
            : 'Start your first guided block.';
        const description = profileExists
            ? 'Your profile exists, but there is no active workout plan right now. Rebuild your plan to generate a fresh 30-day sequence.'
            : 'Answer onboarding questions and the app will build a 30-day sequence around your goal, equipment, and current fitness level.';
        const primaryLabel = profileExists ? 'Rebuild plan' : 'Create a plan';

        return (
            <div className="app-shell px-4 py-8">
                <div className="mobile-shell">
                    <div className="surface-panel space-y-6 p-8 text-center">
                        <p className="section-label">{profileExists ? 'Plan unavailable' : 'No active plan'}</p>
                        <h1 className="text-3xl font-black tracking-tight text-[#0B1220]">
                            {title}
                        </h1>
                        <p className="mx-auto max-w-xl text-base leading-7 text-[#66758A]">
                            {description}
                        </p>
                        <div className="flex flex-col items-center justify-center gap-3">
                            <button
                                onClick={() => navigate('/onboarding')}
                                className="w-full rounded-full bg-[linear-gradient(135deg,#0B1220_0%,#10243B_55%,#17BDB2_130%)] px-6 py-3 text-sm font-bold uppercase tracking-[0.2em] text-white transition hover:opacity-95"
                            >
                                {primaryLabel}
                            </button>
                            <button
                                onClick={handleLogout}
                                className="w-full rounded-full border border-[#DDE7EA] px-6 py-3 text-sm font-bold uppercase tracking-[0.2em] text-[#66758A] transition hover:bg-[#F7FAFA]"
                            >
                                Logout
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="app-shell px-3 py-4 sm:px-4">
            <div className="mobile-shell">
                <header className="mb-4 flex items-start justify-between gap-4 px-1">
                    <div className="flex items-center gap-3">
                        <img
                            src={logoImage}
                            alt={`${APP_NAME} logo`}
                            className="h-11 w-11 rounded-[14px] object-cover shadow-[0_12px_24px_rgba(11,18,32,0.18)]"
                        />
                        <div>
                            <p className="text-sm font-black tracking-tight text-[rgba(234,247,245,0.88)]">{APP_NAME}</p>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="rounded-full border border-[rgba(234,247,245,0.35)] bg-[rgba(255,255,255,0.08)] px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-[#EAF7F5] shadow-[0_12px_24px_rgba(11,18,32,0.16)] backdrop-blur-sm"
                    >
                        Logout
                    </button>
                </header>

                <main className="space-y-4">
                    {authNotice && !isStaleOnboardingNotice(authNotice) && (
                        <section className="mobile-card border border-[#22C7B8]/18 bg-[rgba(232,251,248,0.98)] text-[#0E6D68]">
                            <p className="text-sm font-semibold leading-6">{authNotice}</p>
                        </section>
                    )}

                    {activeTab === 'plan' && (
                        <PlanTab
                            plan={plan}
                            onOpenDay={(dayId) => navigate(`/workout/${dayId}`)}
                            onRebuild={() => navigate('/onboarding')}
                        />
                    )}

                    {activeTab === 'discover' && (
                        <DiscoverTab
                            activeFocus={activeFocus}
                            onFocusChange={setActiveFocus}
                            focusWorkout={focusWorkouts[activeFocus]}
                            focusLoading={focusLoadingKey === activeFocus}
                            focusError={focusError}
                            onRebuild={() => navigate('/onboarding')}
                        />
                    )}

                    {activeTab === 'history' && (
                        <HistoryTab
                            plan={plan}
                            onOpenDay={(dayId) => navigate(`/workout/${dayId}`)}
                        />
                    )}
                </main>

                <nav className="fixed bottom-4 left-1/2 z-40 w-[calc(100%-1.5rem)] max-w-[27.5rem] -translate-x-1/2 rounded-full border border-[#E4EAEE] bg-[rgba(255,255,255,0.92)] p-2 shadow-[0_18px_40px_rgba(11,18,32,0.16)] backdrop-blur-xl">
                    <div className="flex items-center gap-2">
                        {[
                            { key: 'plan' as const, label: 'Plan', icon: Sparkles },
                            { key: 'discover' as const, label: 'Discover', icon: Compass },
                            { key: 'history' as const, label: 'History', icon: HistoryIcon },
                        ].map((tab) => {
                            const isActive = activeTab === tab.key;
                            return (
                                <button
                                    key={tab.key}
                                    type="button"
                                    onClick={() => setActiveTab(tab.key)}
                                    className={clsx(
                                        'mobile-tab',
                                        isActive
                                            ? 'bg-[linear-gradient(135deg,#0B1220_0%,#10243B_55%,#17BDB2_130%)] text-white shadow-[0_12px_24px_rgba(11,18,32,0.18)]'
                                            : 'text-[#738097]'
                                    )}
                                >
                                    <span className="flex items-center gap-2">
                                        <tab.icon className="h-4 w-4" />
                                        <span>{tab.label}</span>
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </nav>
            </div>
        </div>
    );
}
