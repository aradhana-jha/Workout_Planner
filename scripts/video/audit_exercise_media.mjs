import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { COMMON_GYM_EXERCISES } from '../../prisma/gym-exercise-library.mjs';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, '../..');
const libraryPath = path.resolve(repoRoot, 'prisma/exercise-library.json');
const publicRoot = path.resolve(repoRoot, 'workout-planner/client/public');
const strict = process.argv.includes('--strict');

const videoExtensions = new Set(['.mp4', '.webm', '.ogg', '.mov', '.m4v']);

function isExternalUrl(value) {
    return /^https?:\/\//i.test(value);
}

function isVideoUrl(value) {
    const withoutQuery = value.split('?')[0].split('#')[0];
    return videoExtensions.has(path.extname(withoutQuery).toLowerCase());
}

function getLocalPublicPath(value) {
    if (!value.startsWith('/')) return null;
    return path.join(publicRoot, value.slice(1));
}

const exercises = [
    ...JSON.parse(fs.readFileSync(libraryPath, 'utf8')),
    ...COMMON_GYM_EXERCISES,
];

const audit = exercises.map((exercise) => {
    const videoUrl = exercise.videoUrl ? String(exercise.videoUrl) : null;
    const localPath = videoUrl ? getLocalPublicPath(videoUrl) : null;
    const localFileExists = localPath ? fs.existsSync(localPath) : false;

    let status = 'missing';
    let issue = 'No videoUrl set';

    if (videoUrl) {
        if (!isVideoUrl(videoUrl)) {
            status = 'invalid';
            issue = 'videoUrl is not a supported video file URL';
        } else if (isExternalUrl(videoUrl)) {
            status = 'external';
            issue = null;
        } else if (!localPath) {
            status = 'invalid';
            issue = 'Local videoUrl must start with /';
        } else if (!localFileExists) {
            status = 'missing-file';
            issue = `Missing public asset: ${path.relative(repoRoot, localPath)}`;
        } else {
            status = 'ready';
            issue = null;
        }
    }

    return {
        externalId: exercise.externalId ?? null,
        name: exercise.name,
        phaseTags: exercise.phaseTags ?? [],
        workoutType: exercise.workoutType ?? null,
        movementPattern: exercise.movementPattern ?? null,
        videoUrl,
        status,
        issue,
    };
});

const summary = audit.reduce(
    (acc, item) => {
        acc.total += 1;
        acc[item.status] = (acc[item.status] ?? 0) + 1;
        return acc;
    },
    { total: 0 }
);

const uncovered = audit.filter((item) => item.status !== 'ready' && item.status !== 'external');

console.log(JSON.stringify({ summary, uncovered }, null, 2));

if (strict && uncovered.length > 0) {
    process.exitCode = 1;
}
