// Read-only regression checks: no database connection or writes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');
function load(file, extra = '') {
    const exports = {};
    const source = fs.readFileSync(path.join(root, file), 'utf8') + extra;
    const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    vm.runInNewContext(code, { exports, require: () => ({ PrismaClient: class {} }), globalThis: {}, console });
    return exports;
}
const generator = new (load('lib/planGenerator.ts').PlanGenerator)();
const questions = load('workout-planner/client/src/pages/OnboardingPage.tsx', '\nexport { QUESTIONS };').QUESTIONS;
const goals = questions.find(q => q.id === 'goal').options;
assert.equal(questions.length, 6);
assert.equal(questions.some(q => q.id === 'equipment'), false);
assert.equal(JSON.stringify(questions.find(q => q.id === 'recentConsistency').options.map(o => o.value)), JSON.stringify(['3 days per week', '4 days per week', '5 days per week']));
const kinds = ['weight-loss', 'muscle', 'stamina', 'flexibility', 'general'];
goals.forEach((goal, index) => {
    assert(generator.isGoal({ goal }, kinds[index]), goal);
    for (const days of [3, 4, 5]) {
        const schedule = generator.buildWeeklySchedule(days, { goal });
        assert.equal(schedule.length, 7);
        assert.equal(schedule.filter(d => d !== 'Rest').length, days);
        if (goal === 'Improve flexibility') assert(schedule.includes('Mobility + Recovery'));
    }
});
const filter = load('api/workout/focus.ts', '\nexport { filterExercisesForProfile };').filterExercisesForProfile;
const base = { name: 'Dumbbell bench press', externalId: 'gym-db-bench-press', workoutType: 'Strength', movementPattern: 'Push', notes: 'location:gym', equipmentTags: '["Dumbbells","Bench"]', avoidModifyFlags: '[]', preferenceExclusionFlags: '[]' };
const profile = { painAreas: '["None"]', movementRestrictions: '["None"]', preferenceExclusions: '["None"]' };
function eligible(equipment, exercise = base) {
    return filter([exercise], { ...profile, equipment: JSON.stringify(equipment) }).length;
}
assert.equal(eligible(['Dumbbells']), 0, 'A bench must not be assumed');
assert.equal(eligible(['Dumbbells', 'Bench']), 1);
assert.equal(eligible(['Full gym access']), 1);
assert.equal(eligible(['No equipment']), 0);
assert.equal(eligible(['No equipment'], { ...base, equipmentTags: '["No equipment"]', notes: '' }), 1);
console.log('Passed: onboarding questions, all 15 goal/frequency combinations, and equipment regression checks.');
