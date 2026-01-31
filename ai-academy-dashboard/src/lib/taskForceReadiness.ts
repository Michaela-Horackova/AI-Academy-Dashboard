import type { RoleType, ClearanceLevel } from './types';

interface MemberMastery {
  participant_id: string;
  name: string;
  role: RoleType;
  mastery_level: number;
  clearance: ClearanceLevel;
  days_completed: number;
}

interface RoleBreakdown {
  role: RoleType;
  count: number;
  totalMastery: number;
  avgMastery: number;
  readyCount: number; // Members at level 3+
  readinessPercent: number;
}

export interface TaskForceReadiness {
  taskForceId: string;
  taskForceName: string;
  totalMembers: number;
  overallReadiness: number;
  roleBreakdown: RoleBreakdown[];
  trend: 'up' | 'down' | 'stable';
  trendValue: number; // Percentage change
  targetReadiness: number; // Expected for current day
  isOnTrack: boolean;
  members: MemberMastery[];
  lowestRole: RoleType | null; // Role with lowest readiness
  highestRole: RoleType | null; // Role with highest readiness
}

// Maximum mastery level
const MAX_MASTERY_LEVEL = 4;

// Program start date for calculating expected progress
const PROGRAM_START = new Date('2026-02-02');

/**
 * Calculate the current program day
 */
export function getCurrentProgramDay(): number {
  const now = new Date();
  const diffTime = now.getTime() - PROGRAM_START.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 0;
  return Math.min(diffDays + 1, 25);
}

/**
 * Calculate expected readiness based on current program day
 * Assumes linear progression through the 25-day program
 */
export function getExpectedReadiness(programDay: number): number {
  if (programDay <= 0) return 0;
  if (programDay >= 25) return 100;

  // Expected progression:
  // Day 1-3: Level 1 (25%)
  // Day 4-10: Level 2 (50%)
  // Day 11-20: Level 3 (75%)
  // Day 21-25: Level 4 (100%)

  if (programDay <= 3) return 25;
  if (programDay <= 10) return 50;
  if (programDay <= 20) return 75;
  return 100;
}

/**
 * Calculate readiness for a single task force
 */
export function calculateTaskForceReadiness(
  taskForceId: string,
  taskForceName: string,
  members: MemberMastery[],
  previousReadiness?: number
): TaskForceReadiness {
  if (members.length === 0) {
    return {
      taskForceId,
      taskForceName,
      totalMembers: 0,
      overallReadiness: 0,
      roleBreakdown: [],
      trend: 'stable',
      trendValue: 0,
      targetReadiness: getExpectedReadiness(getCurrentProgramDay()),
      isOnTrack: false,
      members: [],
      lowestRole: null,
      highestRole: null,
    };
  }

  // Calculate total mastery sum
  const totalMasterySum = members.reduce((sum, m) => sum + m.mastery_level, 0);

  // Overall readiness: (sum of mastery levels) / (members * max level) * 100
  const overallReadiness = Math.round((totalMasterySum / (members.length * MAX_MASTERY_LEVEL)) * 100);

  // Group by role
  const roleGroups = new Map<RoleType, MemberMastery[]>();
  members.forEach((m) => {
    const group = roleGroups.get(m.role) || [];
    group.push(m);
    roleGroups.set(m.role, group);
  });

  // Calculate role breakdown
  const roleBreakdown: RoleBreakdown[] = [];
  let lowestReadiness = 101;
  let highestReadiness = -1;
  let lowestRole: RoleType | null = null;
  let highestRole: RoleType | null = null;

  roleGroups.forEach((roleMembers, role) => {
    const totalMastery = roleMembers.reduce((sum, m) => sum + m.mastery_level, 0);
    const avgMastery = totalMastery / roleMembers.length;
    const readyCount = roleMembers.filter((m) => m.mastery_level >= 3).length;
    const readinessPercent = Math.round((totalMastery / (roleMembers.length * MAX_MASTERY_LEVEL)) * 100);

    roleBreakdown.push({
      role,
      count: roleMembers.length,
      totalMastery,
      avgMastery,
      readyCount,
      readinessPercent,
    });

    // Track lowest/highest
    if (readinessPercent < lowestReadiness) {
      lowestReadiness = readinessPercent;
      lowestRole = role;
    }
    if (readinessPercent > highestReadiness) {
      highestReadiness = readinessPercent;
      highestRole = role;
    }
  });

  // Sort role breakdown by readiness (lowest first to highlight areas needing attention)
  roleBreakdown.sort((a, b) => a.readinessPercent - b.readinessPercent);

  // Calculate trend
  let trend: 'up' | 'down' | 'stable' = 'stable';
  let trendValue = 0;

  if (previousReadiness !== undefined) {
    trendValue = overallReadiness - previousReadiness;
    if (trendValue > 0) trend = 'up';
    else if (trendValue < 0) trend = 'down';
  }

  // Calculate target and track status
  const targetReadiness = getExpectedReadiness(getCurrentProgramDay());
  const isOnTrack = overallReadiness >= targetReadiness;

  return {
    taskForceId,
    taskForceName,
    totalMembers: members.length,
    overallReadiness,
    roleBreakdown,
    trend,
    trendValue,
    targetReadiness,
    isOnTrack,
    members,
    lowestRole,
    highestRole,
  };
}

/**
 * Calculate aggregate readiness across all task forces
 */
export function calculateOverallProgramReadiness(
  taskForces: TaskForceReadiness[]
): {
  overallReadiness: number;
  totalParticipants: number;
  taskForcesOnTrack: number;
  taskForcesAtRisk: number;
  roleAnalysis: Map<RoleType, { total: number; avgReadiness: number }>;
} {
  if (taskForces.length === 0) {
    return {
      overallReadiness: 0,
      totalParticipants: 0,
      taskForcesOnTrack: 0,
      taskForcesAtRisk: 0,
      roleAnalysis: new Map(),
    };
  }

  const totalParticipants = taskForces.reduce((sum, tf) => sum + tf.totalMembers, 0);

  // Weighted average based on number of members
  const weightedReadiness = taskForces.reduce(
    (sum, tf) => sum + tf.overallReadiness * tf.totalMembers,
    0
  );
  const overallReadiness = Math.round(weightedReadiness / totalParticipants);

  const taskForcesOnTrack = taskForces.filter((tf) => tf.isOnTrack).length;
  const taskForcesAtRisk = taskForces.length - taskForcesOnTrack;

  // Aggregate role analysis
  const roleAnalysis = new Map<RoleType, { total: number; sumReadiness: number }>();

  taskForces.forEach((tf) => {
    tf.roleBreakdown.forEach((rb) => {
      const existing = roleAnalysis.get(rb.role) || { total: 0, sumReadiness: 0 };
      existing.total += rb.count;
      existing.sumReadiness += rb.readinessPercent * rb.count;
      roleAnalysis.set(rb.role, existing);
    });
  });

  // Convert to average
  const roleAnalysisFinal = new Map<RoleType, { total: number; avgReadiness: number }>();
  roleAnalysis.forEach((data, role) => {
    roleAnalysisFinal.set(role, {
      total: data.total,
      avgReadiness: Math.round(data.sumReadiness / data.total),
    });
  });

  return {
    overallReadiness,
    totalParticipants,
    taskForcesOnTrack,
    taskForcesAtRisk,
    roleAnalysis: roleAnalysisFinal,
  };
}

/**
 * Get readiness level label
 */
export function getReadinessLabel(readiness: number): {
  label: string;
  color: string;
  description: string;
} {
  if (readiness >= 90) {
    return {
      label: 'Mission Ready',
      color: 'text-green-500',
      description: 'Task force is fully prepared for deployment',
    };
  }
  if (readiness >= 75) {
    return {
      label: 'Field Ready',
      color: 'text-blue-500',
      description: 'Most members are prepared for field operations',
    };
  }
  if (readiness >= 50) {
    return {
      label: 'In Training',
      color: 'text-yellow-500',
      description: 'Active skill development in progress',
    };
  }
  if (readiness >= 25) {
    return {
      label: 'Initiating',
      color: 'text-orange-500',
      description: 'Early stages of training',
    };
  }
  return {
    label: 'Mobilizing',
    color: 'text-red-500',
    description: 'Task force is being assembled',
  };
}

/**
 * Get recommendations for improving readiness
 */
export function getReadinessRecommendations(readiness: TaskForceReadiness): string[] {
  const recommendations: string[] = [];

  if (!readiness.isOnTrack) {
    recommendations.push(
      `Task force is ${readiness.targetReadiness - readiness.overallReadiness}% behind target. Consider additional support sessions.`
    );
  }

  if (readiness.lowestRole) {
    recommendations.push(
      `Focus on ${readiness.lowestRole} role members - they have the lowest readiness in the team.`
    );
  }

  const needsAttention = readiness.members.filter((m) => m.mastery_level < 2);
  if (needsAttention.length > 0) {
    recommendations.push(
      `${needsAttention.length} member(s) are still at Level 1. Pair them with advanced members.`
    );
  }

  if (readiness.trend === 'down') {
    recommendations.push(
      'Readiness has declined. Check for engagement issues or blockers.'
    );
  }

  return recommendations;
}
