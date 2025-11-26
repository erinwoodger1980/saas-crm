// web/src/components/tasks/TaskCelebration.tsx
"use client";

import { useEffect, useState } from "react";
import confetti from "canvas-confetti";
import { Trophy, Flame, Star, Zap, Target, Award, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type CelebrationType = "standard" | "streak" | "milestone" | "perfect-day" | "speedrun";

interface TaskCelebrationProps {
  show: boolean;
  onClose: () => void;
  taskTitle: string;
  celebrationType?: CelebrationType;
  streakDays?: number;
  totalCompleted?: number;
  pointsEarned?: number;
}

const CELEBRATION_MESSAGES = {
  standard: [
    "Awesome work! 🎉",
    "You crushed it! 💪",
    "Task completed! ⚡",
    "Well done! 🌟",
    "Great job! 🎯",
    "You're on fire! 🔥",
    "Keep it up! 🚀",
    "Fantastic! ✨",
    "Outstanding! 🏆",
    "Excellent! 👏",
  ],
  streak: [
    "🔥 Streak master!",
    "🔥 You're unstoppable!",
    "🔥 On fire!",
    "🔥 Consistency king!",
    "🔥 Streak legend!",
  ],
  milestone: [
    "🏆 Milestone achieved!",
    "🎯 Major progress!",
    "⭐ Amazing milestone!",
    "💎 You're a superstar!",
    "🚀 Incredible achievement!",
  ],
  "perfect-day": [
    "✨ Perfect day completed!",
    "🌟 All tasks done today!",
    "💯 100% completion!",
    "🎊 You cleared everything!",
  ],
  speedrun: [
    "⚡ Lightning fast!",
    "🏃 Speed demon!",
    "⏱️ Record time!",
    "💨 Blazing speed!",
  ],
};

const ENCOURAGEMENT_PHRASES = [
  "You're building momentum! 💪",
  "Every task brings you closer! 🎯",
  "Small wins add up to big victories! 🏆",
  "You're making great progress! 📈",
  "Keep this energy going! ⚡",
  "Your future self will thank you! 🌟",
  "One step at a time! 🚶",
  "You're doing amazing! ✨",
  "Productivity champion! 👑",
  "That's how it's done! 🎉",
];

export function TaskCelebration({
  show,
  onClose,
  taskTitle,
  celebrationType = "standard",
  streakDays = 0,
  totalCompleted = 0,
  pointsEarned = 10,
}: TaskCelebrationProps) {
  const [message, setMessage] = useState("");
  const [encouragement, setEncouragement] = useState("");
  const [showAnimation, setShowAnimation] = useState(false);

  useEffect(() => {
    if (show) {
      // Select random messages
      const messages = CELEBRATION_MESSAGES[celebrationType];
      setMessage(messages[Math.floor(Math.random() * messages.length)]);
      setEncouragement(
        ENCOURAGEMENT_PHRASES[Math.floor(Math.random() * ENCOURAGEMENT_PHRASES.length)]
      );

      // Trigger confetti
      triggerConfetti(celebrationType);

      // Show animation
      setShowAnimation(true);

      // Auto-close after 5 seconds
      const timer = setTimeout(() => {
        handleClose();
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [show, celebrationType]);

  const triggerConfetti = (type: CelebrationType) => {
    const duration = type === "milestone" || type === "perfect-day" ? 3000 : 2000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: type === "milestone" ? 7 : 3,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.6 },
        colors: ["#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981"],
      });
      confetti({
        particleCount: type === "milestone" ? 7 : 3,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.6 },
        colors: ["#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981"],
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };

    frame();
  };

  const handleClose = () => {
    setShowAnimation(false);
    setTimeout(onClose, 300);
  };

  if (!show) return null;

  const getIcon = () => {
    switch (celebrationType) {
      case "streak":
        return <Flame className="w-16 h-16 text-orange-500" />;
      case "milestone":
        return <Trophy className="w-16 h-16 text-yellow-500" />;
      case "perfect-day":
        return <Star className="w-16 h-16 text-purple-500" />;
      case "speedrun":
        return <Zap className="w-16 h-16 text-blue-500" />;
      default:
        return <Target className="w-16 h-16 text-green-500" />;
    }
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
        showAnimation ? "opacity-100" : "opacity-0"
      }`}
      onClick={handleClose}
    >
      <Card
        className={`relative max-w-md p-8 text-center transform transition-all duration-500 ${
          showAnimation ? "scale-100 rotate-0" : "scale-50 rotate-12"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Animated icon */}
        <div className="flex justify-center mb-6 animate-bounce">{getIcon()}</div>

        {/* Main message */}
        <h2 className="text-3xl font-bold mb-3 bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent animate-pulse">
          {message}
        </h2>

        {/* Task title */}
        <p className="text-lg text-gray-700 mb-4 font-medium line-clamp-2">"{taskTitle}"</p>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 my-6">
          {streakDays > 0 && (
            <div className="bg-orange-50 rounded-lg p-3">
              <Flame className="w-6 h-6 mx-auto mb-1 text-orange-500" />
              <div className="text-2xl font-bold text-orange-600">{streakDays}</div>
              <div className="text-xs text-orange-700">day streak</div>
            </div>
          )}
          
          <div className="bg-blue-50 rounded-lg p-3">
            <Star className="w-6 h-6 mx-auto mb-1 text-blue-500" />
            <div className="text-2xl font-bold text-blue-600">+{pointsEarned}</div>
            <div className="text-xs text-blue-700">points</div>
          </div>

          {totalCompleted > 0 && (
            <div className="bg-green-50 rounded-lg p-3">
              <Award className="w-6 h-6 mx-auto mb-1 text-green-500" />
              <div className="text-2xl font-bold text-green-600">{totalCompleted}</div>
              <div className="text-xs text-green-700">total done</div>
            </div>
          )}
        </div>

        {/* Encouragement */}
        <p className="text-sm text-gray-600 mb-6 italic">{encouragement}</p>

        {/* Action button */}
        <Button onClick={handleClose} className="w-full" size="lg">
          <PartyPopper className="w-4 h-4 mr-2" />
          Continue
        </Button>

        {/* Celebration badge animation */}
        <div className="absolute -top-4 -right-4 animate-spin-slow">
          <div className="bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full p-3 shadow-lg">
            <Trophy className="w-6 h-6 text-white" />
          </div>
        </div>
      </Card>
    </div>
  );
}
