import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import {
  AdaptiveLearningEngine,
  UserProfile,
  LearningInsight,
} from '../services/adaptive-learning-engine.js';
import { PersonalizationSystem, SmartRecommendation } from '../services/personalization-system.js';
import chalk from 'chalk';

export interface AdaptiveDashboardProps {
  isVisible: boolean;
  onClose: () => void;
  onApplyRecommendation?: (recommendationId: string) => void;
}

interface DashboardStats {
  totalCommands: number;
  successRate: number;
  achievements: number;
  learningProgress: number;
  productivityPeaks: number[];
}

export function AdaptiveDashboard({ isVisible, onApplyRecommendation }: AdaptiveDashboardProps) {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [recommendations, setRecommendations] = useState<SmartRecommendation[]>([]);
  const [insights, setInsights] = useState<LearningInsight[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalCommands: 0,
    successRate: 1,
    achievements: 0,
    learningProgress: 0,
    productivityPeaks: [],
  });
  const [selectedTab, setSelectedTab] = useState<
    'overview' | 'recommendations' | 'insights' | 'achievements'
  >('overview');

  useEffect(() => {
    if (!isVisible) return;

    const learningEngine = AdaptiveLearningEngine.getInstance();
    const personalizationSystem = PersonalizationSystem.getInstance();

    // Load initial data
    const profile = learningEngine.getUserProfile();
    setUserProfile(profile);

    const learningStats = learningEngine.getLearningStats();
    setStats({
      ...learningStats,
      productivityPeaks: learningStats.productivityPeaks || [],
    });

    const learningInsights = learningEngine.getRecommendations();
    setInsights(learningInsights);

    // Load recommendations
    personalizationSystem.generateRecommendations().then((recs) => {
      setRecommendations(recs);
    });

    // Set up event listeners
    const handleProfileUpdate = () => {
      const updatedProfile = learningEngine.getUserProfile();
      setUserProfile(updatedProfile);
      const updatedStats = learningEngine.getLearningStats();
      setStats({
        ...updatedStats,
        productivityPeaks: updatedStats.productivityPeaks || [],
      });
    };

    const handleRecommendationsUpdate = (newRecommendations: SmartRecommendation[]) => {
      setRecommendations(newRecommendations);
    };

    learningEngine.on('commandLearned', handleProfileUpdate);
    learningEngine.on('achievementUnlocked', handleProfileUpdate);
    personalizationSystem.on('recommendationsUpdated', handleRecommendationsUpdate);

    return () => {
      learningEngine.removeListener('commandLearned', handleProfileUpdate);
      learningEngine.removeListener('achievementUnlocked', handleProfileUpdate);
      personalizationSystem.removeListener('recommendationsUpdated', handleRecommendationsUpdate);
    };
  }, [isVisible]);

  if (!isVisible) {
    return null;
  }

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="blue" padding={1}>
      {/* Header */}
      <Box justifyContent="space-between" marginBottom={1}>
        <Text bold color="blue">
          🧠 Adaptive Learning Dashboard
        </Text>
        <Text color="gray">Press ESC to close</Text>
      </Box>

      {/* Tab Navigation */}
      <Box marginBottom={1}>
        <TabButton
          label="Overview"
          isSelected={selectedTab === 'overview'}
          onClick={() => setSelectedTab('overview')}
        />
        <TabButton
          label="Recommendations"
          isSelected={selectedTab === 'recommendations'}
          onClick={() => setSelectedTab('recommendations')}
        />
        <TabButton
          label="Insights"
          isSelected={selectedTab === 'insights'}
          onClick={() => setSelectedTab('insights')}
        />
        <TabButton
          label="Achievements"
          isSelected={selectedTab === 'achievements'}
          onClick={() => setSelectedTab('achievements')}
        />
      </Box>

      {/* Tab Content */}
      <Box flexDirection="column" minHeight={15}>
        {selectedTab === 'overview' && <OverviewTab userProfile={userProfile} stats={stats} />}

        {selectedTab === 'recommendations' && (
          <RecommendationsTab recommendations={recommendations} onApply={onApplyRecommendation} />
        )}

        {selectedTab === 'insights' && <InsightsTab insights={insights} />}

        {selectedTab === 'achievements' && <AchievementsTab userProfile={userProfile} />}
      </Box>
    </Box>
  );
}

interface TabButtonProps {
  label: string;
  isSelected: boolean;
  onClick: () => void;
}

function TabButton({ label, isSelected }: TabButtonProps) {
  return (
    <Box
      marginRight={2}
      borderStyle={isSelected ? 'single' : undefined}
      borderColor={isSelected ? 'blue' : undefined}
      paddingX={1}
    >
      <Text color={isSelected ? 'blue' : 'gray'}>{label}</Text>
    </Box>
  );
}

function OverviewTab({
  userProfile,
  stats,
}: {
  userProfile: UserProfile | null;
  stats: DashboardStats;
}) {
  if (!userProfile) {
    return (
      <Box>
        <Text>Loading user profile...</Text>
      </Box>
    );
  }

  const progressBar =
    '█'.repeat(Math.floor(stats.learningProgress / 5)) +
    '░'.repeat(20 - Math.floor(stats.learningProgress / 5));

  return (
    <Box flexDirection="column">
      {/* User Stats */}
      <Box flexDirection="column" marginBottom={2}>
        <Text bold color="green">
          📊 Your Progress
        </Text>
        <Box marginTop={1}>
          <Text>Total Commands: </Text>
          <Text color="cyan">{stats.totalCommands}</Text>
        </Box>
        <Box>
          <Text>Success Rate: </Text>
          <Text
            color={stats.successRate > 0.8 ? 'green' : stats.successRate > 0.6 ? 'yellow' : 'red'}
          >
            {(stats.successRate * 100).toFixed(1)}%
          </Text>
        </Box>
        <Box>
          <Text>Achievements: </Text>
          <Text color="yellow">{stats.achievements}</Text>
        </Box>
        <Box>
          <Text>Learning Progress: </Text>
          <Text color="blue">
            [{chalk.blue(progressBar)}] {stats.learningProgress.toFixed(1)}%
          </Text>
        </Box>
      </Box>

      {/* Preferences */}
      <Box flexDirection="column" marginBottom={2}>
        <Text bold color="magenta">
          ⚙️ Your Preferences
        </Text>
        <Box marginTop={1}>
          <Text>Coding Style: </Text>
          <Text color="cyan">{userProfile.preferences.codingStyle}</Text>
        </Box>
        <Box>
          <Text>Primary Languages: </Text>
          <Text color="cyan">
            {userProfile.preferences.primaryLanguages.length > 0
              ? userProfile.preferences.primaryLanguages.join(', ')
              : 'Learning...'}
          </Text>
        </Box>
        <Box>
          <Text>Working Hours: </Text>
          <Text color="cyan">
            {userProfile.preferences.workingHours.start}:00 -{' '}
            {userProfile.preferences.workingHours.end}:00
          </Text>
        </Box>
      </Box>

      {/* Productivity Peaks */}
      {stats.productivityPeaks.length > 0 && (
        <Box flexDirection="column">
          <Text bold color="yellow">
            ⏰ Your Peak Hours
          </Text>
          <Box marginTop={1}>
            <Text>
              Most productive at: {stats.productivityPeaks.map((h) => `${h}:00`).join(', ')}
            </Text>
          </Box>
        </Box>
      )}
    </Box>
  );
}

function RecommendationsTab({
  recommendations,
  onApply,
}: {
  recommendations: SmartRecommendation[];
  onApply?: (id: string) => void;
}) {
  if (recommendations.length === 0) {
    return (
      <Box>
        <Text color="gray">
          No recommendations available. Keep using MARIA to get personalized suggestions!
        </Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color="green">
          💡 Smart Recommendations
        </Text>
      </Box>

      {recommendations.slice(0, 6).map((rec, index) => (
        <RecommendationItem key={rec.id} recommendation={rec} index={index + 1} onApply={onApply} />
      ))}
    </Box>
  );
}

function RecommendationItem({
  recommendation,
  index,
  onApply,
}: {
  recommendation: SmartRecommendation;
  index: number;
  onApply?: (id: string) => void;
}) {
  const confidenceColor =
    recommendation.confidence > 0.8 ? 'green' : recommendation.confidence > 0.6 ? 'yellow' : 'gray';

  const confidenceBar =
    '●'.repeat(Math.floor(recommendation.confidence * 5)) +
    '○'.repeat(5 - Math.floor(recommendation.confidence * 5));

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor="gray"
      padding={1}
      marginBottom={1}
    >
      <Box justifyContent="space-between">
        <Text bold>
          {index}. {getTypeIcon(recommendation.type)} {recommendation.title}
        </Text>
        <Text color={confidenceColor}>
          {confidenceBar} {(recommendation.confidence * 100).toFixed(0)}%
        </Text>
      </Box>

      <Box marginTop={1}>
        <Text color="gray">{recommendation.description}</Text>
      </Box>

      {onApply && (
        <Box marginTop={1}>
          <Text color="blue">Press Enter to apply • Context: {recommendation.context}</Text>
        </Box>
      )}
    </Box>
  );
}

function InsightsTab({ insights }: { insights: LearningInsight[] }) {
  if (insights.length === 0) {
    return (
      <Box>
        <Text color="gray">No insights available yet. Keep using MARIA to generate insights!</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color="blue">
          🔍 Learning Insights
        </Text>
      </Box>

      {insights.map((insight, index) => (
        <InsightItem key={index} insight={insight} index={index + 1} />
      ))}
    </Box>
  );
}

function InsightItem({ insight, index }: { insight: LearningInsight; index: number }) {
  const priorityColor =
    insight.priority === 'high' ? 'red' : insight.priority === 'medium' ? 'yellow' : 'gray';

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={priorityColor}
      padding={1}
      marginBottom={1}
    >
      <Box>
        <Text bold color={priorityColor}>
          {index}. {getInsightIcon(insight.type)} {insight.title}
        </Text>
      </Box>

      <Box marginTop={1}>
        <Text>{insight.description}</Text>
      </Box>

      <Box marginTop={1} justifyContent="space-between">
        <Text color="gray">Category: {insight.category}</Text>
        <Text color={priorityColor}>Priority: {insight.priority}</Text>
      </Box>
    </Box>
  );
}

function AchievementsTab({ userProfile }: { userProfile: UserProfile | null }) {
  if (!userProfile || userProfile.achievements.length === 0) {
    return (
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text bold color="yellow">
            🏆 Achievements
          </Text>
        </Box>
        <Text color="gray">No achievements yet. Keep using MARIA to unlock achievements!</Text>
        <Box marginTop={2}>
          <Text color="gray">Upcoming achievements:</Text>
          <Text>🚀 First Steps - Execute your first command</Text>
          <Text>⭐ Regular User - Execute 50 commands</Text>
          <Text>🎯 Command Master - Execute 100 commands</Text>
          <Text>💎 Perfectionist - Maintain 95% success rate</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color="yellow">
          🏆 Your Achievements ({userProfile.achievements.length})
        </Text>
      </Box>

      {userProfile.achievements
        .sort((a, b) => b.unlockedAt - a.unlockedAt)
        .map((achievement, index) => (
          <AchievementItem key={achievement.id} achievement={achievement} index={index + 1} />
        ))}
    </Box>
  );
}

function AchievementItem({
  achievement,
  index,
}: {
  achievement: {
    id: string;
    title: string;
    description: string;
    icon: string;
    unlockedAt: number;
    category: string;
  };
  index: number;
}) {
  const unlockedDate = new Date(achievement.unlockedAt);

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor="yellow"
      padding={1}
      marginBottom={1}
    >
      <Box justifyContent="space-between">
        <Text bold color="yellow">
          {index}. {achievement.icon} {achievement.title}
        </Text>
        <Text color="gray">{unlockedDate.toLocaleDateString()}</Text>
      </Box>

      <Box marginTop={1}>
        <Text>{achievement.description}</Text>
      </Box>

      <Box marginTop={1}>
        <Text color="gray">Category: {achievement.category}</Text>
      </Box>
    </Box>
  );
}

function getTypeIcon(type: string): string {
  const icons = {
    command: '⚡',
    shortcut: '⌨️',
    workflow: '🔄',
    setting: '⚙️',
  };
  return icons[type as keyof typeof icons] || '💡';
}

function getInsightIcon(type: string): string {
  const icons = {
    recommendation: '💡',
    warning: '⚠️',
    tip: '💭',
    achievement: '🏆',
  };
  return icons[type as keyof typeof icons] || '🔍';
}

export default AdaptiveDashboard;
