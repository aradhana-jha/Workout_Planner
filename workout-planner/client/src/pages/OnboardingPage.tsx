import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/axios';
import { ChevronLeft, ChevronRight, Check } from 'lucide-react';

// Question configurations
const QUESTIONS = [
    {
        id: 'goal',
        title: 'What is your main goal for the next 30 days?',
        type: 'single',
        options: [
            'Lose body fat',
            'Build muscle',
            'Get stronger',
            'Improve stamina',
            'Improve mobility',
            'General fitness'
        ]
    },
    {
        id: 'equipment',
        title: 'What equipment do you have access to?',
        subtitle: 'Choose all that apply',
        type: 'multi',
        options: [
            'No equipment',
            'Resistance bands',
            'Dumbbells',
            'Kettlebell',
            'Barbell and weight plates',
            'Pull-up bar',
            'Bench'
        ]
    },
    {
        id: 'timePerWorkout',
        title: 'How much time can you spend per workout?',
        type: 'single',
        options: [
            { label: '15 minutes', value: 15 },
            { label: '25 minutes', value: 25 },
            { label: '40 minutes', value: 40 },
            { label: '60 minutes', value: 60 }
        ]
    },
    {
        id: 'experienceLevel',
        title: 'What best describes your experience with workouts?',
        type: 'single',
        options: [
            { label: 'Beginner (I have not worked out consistently)', value: 'beginner' },
            { label: 'Some experience (I have done it before, not consistent recently)', value: 'some experience' },
            { label: 'Intermediate (I train regularly and know basic form)', value: 'intermediate' },
            { label: 'Advanced (I train regularly and track progress)', value: 'advanced' }
        ]
    },
    {
        id: 'recentConsistency',
        title: 'In the last 4 weeks, how often did you work out?',
        type: 'single',
        options: [
            '0 days per week',
            '1-2 days per week',
            '3-4 days per week',
            '5+ days per week'
        ]
    },
    {
        id: 'painAreas',
        title: 'Do you have pain or an injury that we should plan around?',
        subtitle: 'Choose all that apply',
        type: 'multi',
        options: [
            'None',
            'Lower back',
            'Knees',
            'Shoulders',
            'Neck',
            'Wrists',
            'Ankles'
        ]
    },
    {
        id: 'movementRestrictions',
        title: 'Are any of these difficult or not possible for you right now?',
        subtitle: 'Choose all that apply',
        type: 'multi',
        options: [
            'None',
            'Squatting down is difficult',
            'Lunges are difficult',
            'Push-ups are difficult',
            'Pull-ups are difficult',
            'Jumping is difficult',
            'Running is difficult'
        ]
    },
    {
        id: 'workoutStylePreference',
        title: 'What kind of workouts do you enjoy more?',
        type: 'single',
        options: [
            'Mostly strength training',
            'Mostly cardio',
            'Mix of both',
            'Decide for me'
        ]
    },
    {
        id: 'focusAreas',
        title: 'Which areas do you want to focus on?',
        subtitle: 'Choose up to 2',
        type: 'multi',
        maxSelect: 2,
        options: [
            'Core',
            'Glutes and legs',
            'Chest and arms',
            'Back and posture',
            'Full body balance'
        ]
    },
    {
        id: 'intensityPreference',
        title: 'How hard do you want workouts to feel most days?',
        type: 'single',
        options: [
            { label: 'Easy (I want to build the habit first)', value: 'Easy' },
            { label: 'Moderate (challenging but doable)', value: 'Moderate' },
            { label: 'Hard (I like intense workouts)', value: 'Hard' }
        ]
    },
    {
        id: 'startingAbility',
        title: 'Quick ability check (optional)',
        subtitle: 'This helps us pick the right starting exercises for you',
        type: 'ability',
        abilities: [
            {
                id: 'startingAbilityPushups',
                label: 'Push-ups you can do:',
                options: ['0', '1-5', '6-15', '16+']
            },
            {
                id: 'startingAbilitySquats',
                label: 'Bodyweight squats:',
                options: ['0-10', '11-25', '26-50', '50+']
            },
            {
                id: 'startingAbilityPlank',
                label: 'Plank hold:',
                options: ['under 20 seconds', '20-45', '45-90', '90+']
            }
        ]
    },
    {
        id: 'sleepBucket',
        title: 'How is your sleep most nights?',
        type: 'single',
        options: [
            'Under 6 hours',
            '6-7 hours',
            '7-8 hours',
            '8+ hours'
        ]
    },
    {
        id: 'preferenceExclusions',
        title: 'Anything you strongly dislike or want to avoid?',
        subtitle: 'Choose all that apply',
        type: 'multi',
        options: [
            'None',
            'Running',
            'Jumping',
            'Burpees',
            'Long workouts',
            'Heavy lifting'
        ]
    }
];

interface FormData {
    goal: string;
    equipment: string[];
    timePerWorkout: number;
    experienceLevel: string;
    recentConsistency: string;
    painAreas: string[];
    movementRestrictions: string[];
    workoutStylePreference: string;
    focusAreas: string[];
    intensityPreference: string;
    startingAbilityPushups: string;
    startingAbilitySquats: string;
    startingAbilityPlank: string;
    sleepBucket: string;
    preferenceExclusions: string[];
}

export function OnboardingPage() {
    const navigate = useNavigate();
    const [currentStep, setCurrentStep] = useState(0);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState<FormData>({
        goal: '',
        equipment: [],
        timePerWorkout: 25,
        experienceLevel: '',
        recentConsistency: '',
        painAreas: [],
        movementRestrictions: [],
        workoutStylePreference: '',
        focusAreas: [],
        intensityPreference: '',
        startingAbilityPushups: '',
        startingAbilitySquats: '',
        startingAbilityPlank: '',
        sleepBucket: '',
        preferenceExclusions: []
    });

    const currentQuestion = QUESTIONS[currentStep];
    const isLastStep = currentStep === QUESTIONS.length - 1;
    const progress = ((currentStep + 1) / QUESTIONS.length) * 100;

    const handleSingleSelect = (questionId: string, value: string | number) => {
        setFormData(prev => ({ ...prev, [questionId]: value }));
    };

    const handleMultiSelect = (questionId: string, value: string, maxSelect?: number) => {
        setFormData(prev => {
            const current = prev[questionId as keyof FormData] as string[];

            // Handle "None" exclusivity
            if (value === 'None') {
                return { ...prev, [questionId]: ['None'] };
            }

            // Remove "None" if selecting something else
            const filtered = current.filter(v => v !== 'None');

            if (filtered.includes(value)) {
                return { ...prev, [questionId]: filtered.filter(v => v !== value) };
            } else {
                if (maxSelect && filtered.length >= maxSelect) {
                    return { ...prev, [questionId]: [...filtered.slice(1), value] };
                }
                return { ...prev, [questionId]: [...filtered, value] };
            }
        });
    };

    const handleAbilitySelect = (abilityId: string, value: string) => {
        setFormData(prev => ({ ...prev, [abilityId]: value }));
    };

    const canProceed = () => {
        const q = currentQuestion;
        if (q.type === 'single') {
            return formData[q.id as keyof FormData] !== '' && formData[q.id as keyof FormData] !== undefined;
        }
        if (q.type === 'multi') {
            return (formData[q.id as keyof FormData] as string[]).length > 0;
        }
        if (q.type === 'ability') {
            return true; // Optional
        }
        return true;
    };

    const handleNext = () => {
        if (isLastStep) {
            handleSubmit();
        } else {
            setCurrentStep(prev => prev + 1);
        }
    };

    const handleBack = () => {
        if (currentStep > 0) {
            setCurrentStep(prev => prev - 1);
        }
    };

    const handleSubmit = async () => {
        setLoading(true);
        try {
            // Prepare data for API
            const profileData = {
                goal: formData.goal,
                equipment: JSON.stringify(formData.equipment.length > 0 ? formData.equipment : ['No equipment']),
                timePerWorkout: formData.timePerWorkout,
                experienceLevel: formData.experienceLevel,
                recentConsistency: formData.recentConsistency,
                painAreas: JSON.stringify(formData.painAreas.length > 0 ? formData.painAreas : ['None']),
                movementRestrictions: JSON.stringify(formData.movementRestrictions.length > 0 ? formData.movementRestrictions : ['None']),
                workoutStylePreference: formData.workoutStylePreference,
                focusAreas: JSON.stringify(formData.focusAreas.length > 0 ? formData.focusAreas : ['Full body balance']),
                intensityPreference: formData.intensityPreference,
                startingAbilityPushups: formData.startingAbilityPushups || null,
                startingAbilitySquats: formData.startingAbilitySquats || null,
                startingAbilityPlank: formData.startingAbilityPlank || null,
                sleepBucket: formData.sleepBucket,
                preferenceExclusions: JSON.stringify(formData.preferenceExclusions.length > 0 ? formData.preferenceExclusions : ['None'])
            };

            await api.post('/profile', profileData);
            navigate('/dashboard');
        } catch (error) {
            console.error('Failed to save profile', error);
            alert('Failed to save profile. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const renderQuestion = () => {
        const q = currentQuestion;

        if (q.type === 'single' && q.options) {
            return (
                <div className="space-y-3">
                    {q.options.map((option, idx) => {
                        const value = typeof option === 'object' ? option.value : option;
                        const label = typeof option === 'object' ? option.label : String(option);
                        const isSelected = formData[q.id as keyof FormData] === value;

                        return (
                            <button
                                key={idx}
                                type="button"
                                onClick={() => handleSingleSelect(q.id, value)}
                                className={`w-full p-4 text-left rounded-lg border-2 transition-all ${isSelected
                                    ? 'border-blue-500 bg-blue-50 text-blue-900'
                                    : 'border-gray-200 hover:border-gray-300 text-gray-700'
                                    }`}
                            >
                                <div className="flex items-center justify-between">
                                    <span className="font-medium">{label}</span>
                                    {isSelected && <Check className="w-5 h-5 text-blue-500" />}
                                </div>
                            </button>
                        );
                    })}
                </div>
            );
        }

        if (q.type === 'multi' && q.options) {
            const selected = formData[q.id as keyof FormData] as string[];
            return (
                <div className="space-y-3">
                    {q.options.map((option, idx) => {
                        const optionStr = String(option);
                        const isSelected = selected.includes(optionStr);

                        return (
                            <button
                                key={idx}
                                type="button"
                                onClick={() => handleMultiSelect(q.id, optionStr, q.maxSelect)}
                                className={`w-full p-4 text-left rounded-lg border-2 transition-all ${isSelected
                                    ? 'border-blue-500 bg-blue-50 text-blue-900'
                                    : 'border-gray-200 hover:border-gray-300 text-gray-700'
                                    }`}
                            >
                                <div className="flex items-center justify-between">
                                    <span className="font-medium">{optionStr}</span>
                                    {isSelected && <Check className="w-5 h-5 text-blue-500" />}
                                </div>
                            </button>
                        );
                    })}
                </div>
            );
        }

        if (q.type === 'ability') {
            return (
                <div className="space-y-6">
                    {q.abilities?.map((ability) => (
                        <div key={ability.id} className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700">
                                {ability.label}
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                {ability.options.map((option, idx) => {
                                    const isSelected = formData[ability.id as keyof FormData] === option;
                                    return (
                                        <button
                                            key={idx}
                                            type="button"
                                            onClick={() => handleAbilitySelect(ability.id, option)}
                                            className={`p-3 text-sm rounded-lg border-2 transition-all ${isSelected
                                                ? 'border-blue-500 bg-blue-50 text-blue-900'
                                                : 'border-gray-200 hover:border-gray-300 text-gray-700'
                                                }`}
                                        >
                                            {option}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                    <p className="text-sm text-gray-500 italic">
                        You can skip this if you're not sure.
                    </p>
                </div>
            );
        }

        return null;
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col">
            {/* Progress bar */}
            <div className="bg-white shadow-sm">
                <div className="max-w-xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-600">
                            Question {currentStep + 1} of {QUESTIONS.length}
                        </span>
                        <span className="text-sm font-medium text-blue-600">
                            {Math.round(progress)}%
                        </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* Question content */}
            <div className="flex-1 flex flex-col justify-center px-4 py-8">
                <div className="max-w-xl mx-auto w-full">
                    <div className="bg-white rounded-2xl shadow-xl p-8">
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">
                            {currentQuestion.title}
                        </h2>
                        {currentQuestion.subtitle && (
                            <p className="text-gray-500 mb-6">{currentQuestion.subtitle}</p>
                        )}

                        <div className="mb-8">
                            {renderQuestion()}
                        </div>

                        {/* Navigation buttons */}
                        <div className="flex justify-between">
                            <button
                                type="button"
                                onClick={handleBack}
                                disabled={currentStep === 0}
                                className={`flex items-center px-4 py-2 rounded-lg transition-all ${currentStep === 0
                                    ? 'text-gray-300 cursor-not-allowed'
                                    : 'text-gray-600 hover:bg-gray-100'
                                    }`}
                            >
                                <ChevronLeft className="w-5 h-5 mr-1" />
                                Back
                            </button>

                            <button
                                type="button"
                                onClick={handleNext}
                                disabled={!canProceed() || loading}
                                className={`flex items-center px-6 py-2 rounded-lg font-medium transition-all ${canProceed() && !loading
                                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                    }`}
                            >
                                {loading ? (
                                    'Creating Plan...'
                                ) : isLastStep ? (
                                    <>
                                        Create My Plan
                                        <Check className="w-5 h-5 ml-1" />
                                    </>
                                ) : (
                                    <>
                                        Next
                                        <ChevronRight className="w-5 h-5 ml-1" />
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
