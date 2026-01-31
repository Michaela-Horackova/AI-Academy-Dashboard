'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { useLiveSession } from '@/hooks/useLiveSession';
import type { LiveSession, MissionDay } from '@/lib/types';
import {
  Radio,
  Pause,
  Play,
  ArrowLeft,
  Users,
  Clock,
  FileText,
  BookOpen,
  Beaker,
  MessageSquare,
  Wifi,
  WifiOff,
  Eye,
  EyeOff,
} from 'lucide-react';
import { toast } from 'sonner';

interface StudentSessionViewProps {
  session: LiveSession;
  missionDay: MissionDay;
  instructor: { name: string; avatar_url: string | null };
  participantName: string;
}

const SECTIONS = [
  { id: 'briefing', name: 'Briefing', icon: FileText },
  { id: 'resources', name: 'Resources', icon: BookOpen },
  { id: 'lab', name: 'Lab', icon: Beaker },
  { id: 'debrief', name: 'Debrief', icon: MessageSquare },
];

export function StudentSessionView({
  session,
  missionDay,
  instructor,
  participantName,
}: StudentSessionViewProps) {
  const router = useRouter();
  const [isSyncPaused, setIsSyncPaused] = useState(false);
  const [localStep, setLocalStep] = useState(session.current_step);
  const [localSection, setLocalSection] = useState(session.current_section);
  const [elapsedTime, setElapsedTime] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);

  const {
    sessionState,
    participants,
    isConnected,
    error,
  } = useLiveSession({
    code: session.join_code || '',
    isInstructor: false,
    onStateChange: (state) => {
      if (!isSyncPaused) {
        setLocalStep(state.currentStep);
        setLocalSection(state.currentSection);
        // Auto-scroll to content
        contentRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    },
    onSessionEnd: () => {
      toast.info('Session has ended');
      router.push('/live-session');
    },
  });

  // Timer
  useEffect(() => {
    const startTime = new Date(session.started_at).getTime();
    const timer = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(timer);
  }, [session.started_at]);

  // Format elapsed time
  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Toggle sync
  const toggleSync = () => {
    if (isSyncPaused) {
      // Rejoin sync
      if (sessionState) {
        setLocalStep(sessionState.currentStep);
        setLocalSection(sessionState.currentSection);
      }
      toast.success('Synced with instructor');
    } else {
      toast.info('Sync paused - browse at your own pace');
    }
    setIsSyncPaused(!isSyncPaused);
  };

  // Rejoin sync
  const rejoinSync = () => {
    if (sessionState) {
      setLocalStep(sessionState.currentStep);
      setLocalSection(sessionState.currentSection);
      setIsSyncPaused(false);
      toast.success('Synced with instructor');
      contentRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Get current instructor position
  const instructorStep = sessionState?.currentStep ?? session.current_step ?? 1;
  const instructorSection = sessionState?.currentSection ?? session.current_section ?? 'briefing';

  // Calculate section progress
  const sectionIndex = SECTIONS.findIndex((s) => s.id === localSection);
  const sectionProgress = ((sectionIndex + 1) / SECTIONS.length) * 100;

  // Check if out of sync
  const isOutOfSync = isSyncPaused || localStep !== instructorStep || localSection !== instructorSection;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/live-session"
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-2"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Leave Session</span>
          </Link>
          <div className="flex items-center gap-2 mb-1">
            <Radio className="h-5 w-5 text-green-500 animate-pulse" />
            <span className="text-sm font-medium text-green-500">LIVE</span>
            {isConnected ? (
              <Badge variant="outline" className="text-green-500 border-green-500">
                <Wifi className="h-3 w-3 mr-1" />
                Connected
              </Badge>
            ) : (
              <Badge variant="outline" className="text-red-500 border-red-500">
                <WifiOff className="h-3 w-3 mr-1" />
                Reconnecting...
              </Badge>
            )}
          </div>
          <h1 className="text-2xl font-bold">Day {missionDay.day}: {missionDay.title}</h1>
        </div>

        <div className="flex items-center gap-4">
          {/* Timer */}
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span className="font-mono">{formatTime(elapsedTime)}</span>
          </div>

          {/* Participants count */}
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>{participants.length}</span>
          </div>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <Card className="border-red-500 bg-red-500/10">
          <CardContent className="pt-6 text-red-500">
            {error}
          </CardContent>
        </Card>
      )}

      {/* Sync Status Banner */}
      {isOutOfSync && (
        <Card className={`border-amber-500/50 ${isSyncPaused ? 'bg-amber-500/10' : 'bg-blue-500/10 border-blue-500/50'}`}>
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isSyncPaused ? (
                  <>
                    <Pause className="h-5 w-5 text-amber-500" />
                    <span className="font-medium text-amber-500">Sync Paused</span>
                    <span className="text-sm text-muted-foreground">
                      Instructor is on Step {instructorStep} ({instructorSection})
                    </span>
                  </>
                ) : (
                  <>
                    <EyeOff className="h-5 w-5 text-blue-500" />
                    <span className="text-sm text-muted-foreground">
                      You&apos;re viewing different content than the instructor
                    </span>
                  </>
                )}
              </div>
              <Button size="sm" onClick={rejoinSync}>
                <Eye className="mr-2 h-4 w-4" />
                Rejoin Sync
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Instructor Info */}
      <Card className="border-blue-500/30 bg-blue-500/5">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-12 w-12">
                <AvatarImage src={instructor.avatar_url || undefined} />
                <AvatarFallback>
                  {instructor.name?.split(' ').map((n) => n[0]).join('') || 'I'}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm text-muted-foreground">Instructor</p>
                <p className="font-medium">{instructor.name}</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Current Position</p>
                <p className="font-medium">
                  Step {instructorStep} - {SECTIONS.find((s) => s.id === instructorSection)?.name}
                </p>
              </div>

              <Button
                variant={isSyncPaused ? 'default' : 'outline'}
                onClick={toggleSync}
              >
                {isSyncPaused ? (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Resume Sync
                  </>
                ) : (
                  <>
                    <Pause className="mr-2 h-4 w-4" />
                    Pause Sync
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>Section Progress</span>
          <span>{SECTIONS.find((s) => s.id === localSection)?.name}</span>
        </div>
        <Progress value={sectionProgress} className="h-2" />
        <div className="flex justify-between">
          {SECTIONS.map((section) => {
            const Icon = section.icon;
            const isActive = section.id === localSection;
            const isPast = SECTIONS.findIndex((s) => s.id === section.id) < sectionIndex;

            return (
              <button
                key={section.id}
                onClick={() => {
                  setLocalSection(section.id);
                  if (!isSyncPaused && section.id !== instructorSection) {
                    setIsSyncPaused(true);
                    toast.info('Sync paused - browse at your own pace');
                  }
                }}
                className={`flex items-center gap-1 text-xs transition-colors ${
                  isActive
                    ? 'text-blue-500 font-medium'
                    : isPast
                    ? 'text-green-500'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="h-3 w-3" />
                {section.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content Area */}
      <div ref={contentRef}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {SECTIONS.map((s) => {
                if (s.id === localSection) {
                  const Icon = s.icon;
                  return (
                    <span key={s.id} className="flex items-center gap-2">
                      <Icon className="h-5 w-5" />
                      {s.name}
                    </span>
                  );
                }
                return null;
              })}
              <Badge variant="outline" className="ml-2">Step {localStep}</Badge>
            </CardTitle>
            <CardDescription>
              {isSyncPaused
                ? 'Browsing independently'
                : 'Following instructor in real-time'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {localSection === 'briefing' && (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <h3>{missionDay.title}</h3>
                {missionDay.subtitle && <p className="lead">{missionDay.subtitle}</p>}
                <div className="whitespace-pre-wrap">
                  {missionDay.briefing_content || 'Briefing content will be displayed here.'}
                </div>
                {missionDay.tech_skills_focus && missionDay.tech_skills_focus.length > 0 && (
                  <div className="mt-4">
                    <h4>Today&apos;s Focus Areas</h4>
                    <div className="flex flex-wrap gap-2 not-prose">
                      {missionDay.tech_skills_focus.map((skill, i) => (
                        <Badge key={i} variant="secondary">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {localSection === 'resources' && (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <div className="whitespace-pre-wrap">
                  {missionDay.resources_content || 'Resources will be shared here during the session.'}
                </div>
              </div>
            )}

            {localSection === 'lab' && (
              <div className="space-y-4">
                <div className="p-6 border-2 border-dashed rounded-lg text-center">
                  <Beaker className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="font-medium mb-2">Hands-on Lab Exercise</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Follow along with the instructor to complete today&apos;s practical exercise.
                  </p>
                  <Button variant="outline">
                    Open Lab Environment
                  </Button>
                </div>
              </div>
            )}

            {localSection === 'debrief' && (
              <div className="space-y-4">
                <div className="p-6 border-2 border-dashed rounded-lg text-center">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="font-medium mb-2">Session Debrief</h3>
                  <p className="text-sm text-muted-foreground">
                    Wrap-up discussion, Q&A, and next steps.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Your Info */}
      <Card className="bg-muted/30">
        <CardContent className="py-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Joined as: <span className="font-medium text-foreground">{participantName}</span></span>
            <span className="text-muted-foreground">Session Code: <span className="font-mono font-medium text-foreground">{session.join_code}</span></span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
