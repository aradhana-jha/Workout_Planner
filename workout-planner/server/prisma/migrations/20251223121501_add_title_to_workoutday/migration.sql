/*
  Warnings:

  - You are about to drop the column `difficulty` on the `Exercise` table. All the data in the column will be lost.
  - You are about to drop the column `muscleGroup` on the `Exercise` table. All the data in the column will be lost.
  - You are about to drop the column `activityLevel` on the `Profile` table. All the data in the column will be lost.
  - You are about to drop the column `age` on the `Profile` table. All the data in the column will be lost.
  - You are about to drop the column `gender` on the `Profile` table. All the data in the column will be lost.
  - You are about to drop the column `targetWeight` on the `Profile` table. All the data in the column will be lost.
  - You are about to drop the column `weight` on the `Profile` table. All the data in the column will be lost.
  - Added the required column `avoidModifyFlags` to the `Exercise` table without a default value. This is not possible if the table is not empty.
  - Added the required column `difficultyMax` to the `Exercise` table without a default value. This is not possible if the table is not empty.
  - Added the required column `difficultyMin` to the `Exercise` table without a default value. This is not possible if the table is not empty.
  - Added the required column `equipmentTags` to the `Exercise` table without a default value. This is not possible if the table is not empty.
  - Added the required column `focusAreaTags` to the `Exercise` table without a default value. This is not possible if the table is not empty.
  - Added the required column `impactLevel` to the `Exercise` table without a default value. This is not possible if the table is not empty.
  - Added the required column `movementPattern` to the `Exercise` table without a default value. This is not possible if the table is not empty.
  - Added the required column `phaseTags` to the `Exercise` table without a default value. This is not possible if the table is not empty.
  - Added the required column `preferenceExclusionFlags` to the `Exercise` table without a default value. This is not possible if the table is not empty.
  - Added the required column `workoutType` to the `Exercise` table without a default value. This is not possible if the table is not empty.
  - Added the required column `equipment` to the `Profile` table without a default value. This is not possible if the table is not empty.
  - Added the required column `experienceLevel` to the `Profile` table without a default value. This is not possible if the table is not empty.
  - Added the required column `focusAreas` to the `Profile` table without a default value. This is not possible if the table is not empty.
  - Added the required column `intensityPreference` to the `Profile` table without a default value. This is not possible if the table is not empty.
  - Added the required column `movementRestrictions` to the `Profile` table without a default value. This is not possible if the table is not empty.
  - Added the required column `painAreas` to the `Profile` table without a default value. This is not possible if the table is not empty.
  - Added the required column `preferenceExclusions` to the `Profile` table without a default value. This is not possible if the table is not empty.
  - Added the required column `recentConsistency` to the `Profile` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sleepBucket` to the `Profile` table without a default value. This is not possible if the table is not empty.
  - Added the required column `timePerWorkout` to the `Profile` table without a default value. This is not possible if the table is not empty.
  - Added the required column `workoutStylePreference` to the `Profile` table without a default value. This is not possible if the table is not empty.
  - Added the required column `dayType` to the `WorkoutDay` table without a default value. This is not possible if the table is not empty.
  - Added the required column `estimatedMinutes` to the `WorkoutDay` table without a default value. This is not possible if the table is not empty.
  - Added the required column `weekNumber` to the `WorkoutDay` table without a default value. This is not possible if the table is not empty.
  - Added the required column `role` to the `WorkoutExercise` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sortOrder` to the `WorkoutExercise` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Exercise" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "externalId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "videoUrl" TEXT,
    "difficultyMin" TEXT NOT NULL,
    "difficultyMax" TEXT NOT NULL,
    "equipmentTags" TEXT NOT NULL,
    "workoutType" TEXT NOT NULL,
    "movementPattern" TEXT NOT NULL,
    "focusAreaTags" TEXT NOT NULL,
    "impactLevel" TEXT NOT NULL,
    "avoidModifyFlags" TEXT NOT NULL,
    "preferenceExclusionFlags" TEXT NOT NULL,
    "phaseTags" TEXT NOT NULL,
    "easierVariationId" TEXT,
    "harderVariationId" TEXT,
    "notes" TEXT
);
INSERT INTO "new_Exercise" ("description", "id", "name", "videoUrl") SELECT "description", "id", "name", "videoUrl" FROM "Exercise";
DROP TABLE "Exercise";
ALTER TABLE "new_Exercise" RENAME TO "Exercise";
CREATE TABLE "new_ExerciseLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workoutExerciseId" TEXT NOT NULL,
    "setNumber" INTEGER NOT NULL,
    "reps" INTEGER,
    "seconds" INTEGER,
    "weight" REAL,
    "isDone" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "ExerciseLog_workoutExerciseId_fkey" FOREIGN KEY ("workoutExerciseId") REFERENCES "WorkoutExercise" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ExerciseLog" ("id", "isDone", "reps", "setNumber", "weight", "workoutExerciseId") SELECT "id", "isDone", "reps", "setNumber", "weight", "workoutExerciseId" FROM "ExerciseLog";
DROP TABLE "ExerciseLog";
ALTER TABLE "new_ExerciseLog" RENAME TO "ExerciseLog";
CREATE TABLE "new_Plan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'active',
    CONSTRAINT "Plan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Plan" ("id", "startDate", "status", "userId") SELECT "id", "startDate", "status", "userId" FROM "Plan";
DROP TABLE "Plan";
ALTER TABLE "new_Plan" RENAME TO "Plan";
CREATE TABLE "new_Profile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "equipment" TEXT NOT NULL,
    "timePerWorkout" INTEGER NOT NULL,
    "experienceLevel" TEXT NOT NULL,
    "recentConsistency" TEXT NOT NULL,
    "painAreas" TEXT NOT NULL,
    "movementRestrictions" TEXT NOT NULL,
    "workoutStylePreference" TEXT NOT NULL,
    "focusAreas" TEXT NOT NULL,
    "intensityPreference" TEXT NOT NULL,
    "startingAbilityPushups" TEXT,
    "startingAbilitySquats" TEXT,
    "startingAbilityPlank" TEXT,
    "sleepBucket" TEXT NOT NULL,
    "preferenceExclusions" TEXT NOT NULL,
    CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Profile" ("goal", "id", "userId") SELECT "goal", "id", "userId" FROM "Profile";
DROP TABLE "Profile";
ALTER TABLE "new_Profile" RENAME TO "Profile";
CREATE UNIQUE INDEX "Profile_userId_key" ON "Profile"("userId");
CREATE TABLE "new_WorkoutDay" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "planId" TEXT NOT NULL,
    "dayNumber" INTEGER NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "dayType" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Workout Day',
    "isOptional" BOOLEAN NOT NULL DEFAULT false,
    "estimatedMinutes" INTEGER NOT NULL,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" DATETIME,
    CONSTRAINT "WorkoutDay_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_WorkoutDay" ("completedAt", "dayNumber", "id", "isCompleted", "planId", "title") SELECT "completedAt", "dayNumber", "id", "isCompleted", "planId", "title" FROM "WorkoutDay";
DROP TABLE "WorkoutDay";
ALTER TABLE "new_WorkoutDay" RENAME TO "WorkoutDay";
CREATE TABLE "new_WorkoutExercise" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workoutDayId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "targetSets" INTEGER,
    "targetReps" INTEGER,
    "targetSeconds" INTEGER,
    "targetRestSeconds" INTEGER,
    "sortOrder" INTEGER NOT NULL,
    CONSTRAINT "WorkoutExercise_workoutDayId_fkey" FOREIGN KEY ("workoutDayId") REFERENCES "WorkoutDay" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WorkoutExercise_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_WorkoutExercise" ("exerciseId", "id", "targetReps", "targetSets", "workoutDayId") SELECT "exerciseId", "id", "targetReps", "targetSets", "workoutDayId" FROM "WorkoutExercise";
DROP TABLE "WorkoutExercise";
ALTER TABLE "new_WorkoutExercise" RENAME TO "WorkoutExercise";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
