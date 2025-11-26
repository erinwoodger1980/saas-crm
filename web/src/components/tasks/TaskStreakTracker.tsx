// web/src/components/tasks/TaskStreakTracker.tsx
"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { getAuthIdsFromJwt } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Flame, Trophy, Star, Zap, Target, Award, Crown, Rocket } from "lucide-react";

type Achievement = {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlockedAt?: string;
  progress?: number;
  target?: number;
};

type UserStats = {
  currentStreak: number;
  longestStreak: number;
  totalTasksCompleted: number;
  totalPoints: number;
  tasksCompletedToday: number;
  achievements: Achievement[];
  level: number;
  nextLevelPoints: number;
};

export function TaskStreakTracker() {
  const ids = getAuthIdsFromJwt();
  const tenantId = ids?.tenantId || "";
  const userId = ids?.userId || "";

  const [stats, setStats] = useState<UserStats>({
    currentStreak: 0,
    longestStreak: 0,
    totalTasksCompleted: 0,
    totalPoints: 0,
    tasksCompletedToday: 0,
    achievements: [],
    level: 1,
    nextLevelPoints: 100,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, [tenantId, userId]);

  const loadStats = async () => {
    if (!tenantId || !userId) return;

    setLoading(true);
    try {
      const response = await apiFetch<UserStats>(`/tasks/stats/${userId}`, {
        headers: { "x-tenant-id": tenantId },
      });
      setStats(response);
    } catch (error) {
      console.error("Failed to load task stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const progressToNextLevel = ((stats.totalPoints % 100) / stats.nextLevelPoints) * 100;

  if (loading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/2"></div>
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Level and Progress */}
      <Card className="p-6 bg-gradient-to-br from-purple-50 to-blue-50">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-2xl font-bold flex items-center gap-2">
              <Crown className="w-6 h-6 text-yellow-500" />
              Level {stats.level}
            </h3>
            <p className="text-sm text-gray-600">
              {stats.totalPoints} / {stats.level * 100} XP
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-purple-600">{stats.totalPoints}</div>
            <div className="text-xs text-gray-500">Total Points</div>
          </div>
        </div>
        
        {/* Progress bar */}
        <div className="relative h-4 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500 transition-all duration-500 ease-out"
            style={{ width: `${progressToNextLevel}%` }}
          >
            <div className="absolute inset-0 bg-white/30 animate-pulse"></div>
          </div>
        </div>
        <p className="text-xs text-gray-600 mt-2 text-center">
          {stats.nextLevelPoints - (stats.totalPoints % 100)} XP to level {stats.level + 1}
        </p>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Current Streak */}
        <Card className="p-4 relative overflow-hidden">
          <div className={`absolute inset-0 ${stats.currentStreak >= 7 ? 'bg-gradient-to-br from-orange-100 to-red-100' : 'bg-gray-50'}`}></div>
          <div className="relative">
            <Flame className={`w-8 h-8 mb-2 ${stats.currentStreak >= 7 ? 'text-orange-500 animate-pulse' : 'text-gray-400'}`} />
            <div className="text-3xl font-bold">{stats.currentStreak}</div>
            <div className="text-xs text-gray-600">Day Streak</div>
            {stats.currentStreak >= 7 && (
              <Badge className="mt-2 bg-orange-500">On Fire! 🔥</Badge>
            )}
          </div>
        </Card>

        {/* Today's Tasks */}
        <Card className="p-4 bg-gradient-to-br from-green-50 to-emerald-50">
          <Target className="w-8 h-8 mb-2 text-green-500" />
          <div className="text-3xl font-bold text-green-600">{stats.tasksCompletedToday}</div>
          <div className="text-xs text-gray-600">Completed Today</div>
        </Card>

        {/* Total Completed */}
        <Card className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50">
          <Trophy className="w-8 h-8 mb-2 text-blue-500" />
          <div className="text-3xl font-bold text-blue-600">{stats.totalTasksCompleted}</div>
          <div className="text-xs text-gray-600">All Time Total</div>
        </Card>

        {/* Longest Streak */}
        <Card className="p-4 bg-gradient-to-br from-yellow-50 to-amber-50">
          <Zap className="w-8 h-8 mb-2 text-yellow-500" />
          <div className="text-3xl font-bold text-yellow-600">{stats.longestStreak}</div>
          <div className="text-xs text-gray-600">Best Streak</div>
        </Card>
      </div>

      {/* Achievements */}
      <Card className="p-6">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Award className="w-5 h-5 text-purple-500" />
          Achievements
        </h3>
        
        {stats.achievements.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Trophy className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-sm">Complete tasks to unlock achievements!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {stats.achievements.map((achievement) => (
              <div
                key={achievement.id}
                className={`relative p-4 rounded-lg border-2 transition-all ${
                  achievement.unlockedAt
                    ? "bg-gradient-to-br from-yellow-50 to-amber-50 border-yellow-400 shadow-lg"
                    : "bg-gray-50 border-gray-200 opacity-50"
                }`}
              >
                <div className="text-4xl mb-2">{achievement.icon}</div>
                <div className="font-semibold text-sm">{achievement.name}</div>
                <div className="text-xs text-gray-600 mt-1">{achievement.description}</div>
                
                {!achievement.unlockedAt && achievement.progress !== undefined && achievement.target && (
                  <div className="mt-2">
                    <div className="text-xs text-gray-500 mb-1">
                      {achievement.progress} / {achievement.target}
                    </div>
                    <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-yellow-400 transition-all"
                        style={{
                          width: `${(achievement.progress / achievement.target) * 100}%`,
                        }}
                      ></div>
                    </div>
                  </div>
                )}

                {achievement.unlockedAt && (
                  <div className="absolute -top-2 -right-2 bg-yellow-400 rounded-full p-1 shadow-lg animate-bounce">
                    <Star className="w-4 h-4 text-white fill-white" />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Motivational Message */}
      {stats.currentStreak > 0 && (
        <Card className="p-4 bg-gradient-to-r from-purple-100 via-pink-100 to-blue-100 border-2 border-purple-300">
          <div className="flex items-center gap-3">
            <Rocket className="w-8 h-8 text-purple-600" />
            <div>
              <p className="font-semibold text-purple-900">Keep it up!</p>
              <p className="text-sm text-purple-700">
                {stats.currentStreak >= 30
                  ? "You're a productivity legend! 🏆"
                  : stats.currentStreak >= 14
                  ? "Two weeks strong! Amazing consistency! 🌟"
                  : stats.currentStreak >= 7
                  ? "One week streak! You're crushing it! 🔥"
                  : `${7 - stats.currentStreak} more days to reach a week!`}
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
