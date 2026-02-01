'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { getSupabaseClient } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  Github,
  User,
  Mail,
  Users,
  Briefcase,
  Link as LinkIcon,
  CheckCircle,
  Loader2,
  ExternalLink,
  Copy,
  Webhook,
  Trash2,
  AlertTriangle,
  Save,
  Target,
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import type { RoleType, TeamType, StreamType } from '@/lib/types';

const ROLES: RoleType[] = ['FDE', 'AI-SE', 'AI-PM', 'AI-DA', 'AI-DS', 'AI-SEC', 'AI-FE'];
const TEAMS: TeamType[] = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta'];
const STREAMS: StreamType[] = ['Tech', 'Business'];

const ROLE_DESCRIPTIONS: Record<RoleType, string> = {
  'FDE': 'Forward Deployed Engineer',
  'AI-SE': 'AI Software Engineer',
  'AI-PM': 'AI Product Manager',
  'AI-DA': 'AI Data Analyst',
  'AI-DS': 'AI Data Scientist',
  'AI-SEC': 'AI Security Consultant',
  'AI-FE': 'AI Front-End Developer',
};

export default function ProfilePage() {
  const { participant, isLoading, signOut, refreshParticipant } = useAuth();
  const router = useRouter();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSavingAssignment, setIsSavingAssignment] = useState(false);
  const [showWebhookSetup, setShowWebhookSetup] = useState(false);

  // Academy assignment state
  const [assignmentData, setAssignmentData] = useState({
    role: '' as RoleType | '',
    team: '' as TeamType | '',
    stream: '' as StreamType | '',
  });

  // Initialize assignment data from participant
  useEffect(() => {
    if (participant) {
      setAssignmentData({
        role: participant.role || '',
        team: participant.team || '',
        stream: participant.stream || '',
      });
    }
  }, [participant]);

  const hasAssignmentChanges = participant && (
    assignmentData.role !== participant.role ||
    assignmentData.team !== participant.team ||
    assignmentData.stream !== participant.stream
  );

  const handleSaveAssignment = async () => {
    if (!participant || !assignmentData.role || !assignmentData.team || !assignmentData.stream) {
      toast.error('Please select all fields');
      return;
    }

    setIsSavingAssignment(true);
    const supabase = getSupabaseClient();

    try {
      const { error } = await supabase
        .from('participants')
        .update({
          role: assignmentData.role,
          team: assignmentData.team,
          stream: assignmentData.stream,
        })
        .eq('id', participant.id);

      if (error) throw error;

      await refreshParticipant();
      toast.success('Assignment updated successfully');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update assignment');
    } finally {
      setIsSavingAssignment(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch('/api/account/delete', {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete account');
      }

      toast.success('Account deleted successfully');
      await signOut();
      router.push('/');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete account');
      setIsDeleting(false);
    }
  };

  const handleConnectGitHub = async () => {
    setIsConnecting(true);
    const supabase = getSupabaseClient();

    // Link GitHub account to existing user
    const { error } = await supabase.auth.linkIdentity({
      provider: 'github',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/profile`,
        scopes: 'read:user user:email',
      },
    });

    if (error) {
      toast.error(error.message);
      setIsConnecting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const webhookUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/webhook/github`
    : 'https://your-app.vercel.app/api/webhook/github';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-[#0062FF]" />
      </div>
    );
  }

  if (!participant) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <Alert>
          <AlertDescription>
            Please complete your profile first.{' '}
            <Link href="/onboarding" className="text-[#0062FF] hover:underline">
              Go to onboarding
            </Link>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">My Profile</h1>
          <p className="text-muted-foreground">Manage your account settings</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Profile Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Profile Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20 border-2 border-border">
                <AvatarImage src={participant.avatar_url || undefined} alt={participant.nickname} />
                <AvatarFallback className="text-xl">
                  {participant.nickname?.substring(0, 2).toUpperCase() || 'AI'}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="text-xl font-semibold">{participant.name}</h3>
                <p className="text-muted-foreground">@{participant.nickname}</p>
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>{participant.email}</span>
              </div>
              <div className="flex items-center gap-2 text-sm flex-wrap">
                <Briefcase className="h-4 w-4 text-muted-foreground" />
                <span>{participant.role || <span className="text-muted-foreground italic">No role</span>}</span>
                {participant.stream ? (
                  <Badge variant="outline">{participant.stream}</Badge>
                ) : (
                  <Badge variant="outline" className="border-dashed text-muted-foreground">No stream</Badge>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-muted-foreground" />
                {participant.team ? (
                  <span>Team {participant.team}</span>
                ) : (
                  <span className="text-muted-foreground italic">No team assigned</span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* GitHub Connection Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Github className="h-5 w-5" />
              GitHub Connection
            </CardTitle>
            <CardDescription>
              Connect your GitHub account to submit assignments
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {participant.github_username ? (
              <>
                <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                  <CheckCircle className="h-8 w-8 text-green-500" />
                  <div>
                    <p className="font-medium text-green-600 dark:text-green-400">
                      GitHub Connected
                    </p>
                    <p className="text-sm text-muted-foreground">
                      @{participant.github_username}
                    </p>
                  </div>
                </div>

                {participant.repo_url && (
                  <div className="flex items-center gap-2">
                    <LinkIcon className="h-4 w-4 text-muted-foreground" />
                    <a
                      href={participant.repo_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-[#0062FF] hover:underline flex items-center gap-1"
                    >
                      View Repository
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}

                <Separator />

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowWebhookSetup(!showWebhookSetup)}
                >
                  <Webhook className="mr-2 h-4 w-4" />
                  {showWebhookSetup ? 'Hide' : 'Show'} Webhook Setup
                </Button>

                {showWebhookSetup && (
                  <div className="bg-muted/50 rounded-lg p-4 space-y-3 text-sm">
                    <p className="font-medium">Set up webhook for automatic submissions:</p>
                    <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                      <li>Go to your repository Settings → Webhooks</li>
                      <li>Click &quot;Add webhook&quot;</li>
                      <li>
                        Payload URL:
                        <div className="flex items-center gap-2 mt-1">
                          <code className="flex-1 bg-background px-2 py-1 rounded text-xs truncate">
                            {webhookUrl}
                          </code>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(webhookUrl)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </li>
                      <li>Content type: application/json</li>
                      <li>Select &quot;Just the push event&quot;</li>
                    </ol>
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-muted/50 rounded-lg text-center">
                  <Github className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mb-4">
                    Connect your GitHub account to submit code assignments and track your progress.
                  </p>
                  <Button
                    onClick={handleConnectGitHub}
                    disabled={isConnecting}
                    className="bg-[#24292e] hover:bg-[#1b1f23] text-white"
                  >
                    {isConnecting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Github className="mr-2 h-4 w-4" />
                    )}
                    Connect GitHub
                  </Button>
                </div>

                <p className="text-xs text-center text-muted-foreground">
                  Optional - You can still access all learning materials without GitHub.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Academy Assignment */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Academy Assignment
          </CardTitle>
          <CardDescription>
            Set your role, team, and learning stream
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            {/* Role Selection */}
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select
                value={assignmentData.role}
                onValueChange={(value: RoleType) => setAssignmentData({ ...assignmentData, role: value })}
              >
                <SelectTrigger id="role">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      <div className="flex flex-col">
                        <span className="font-medium">{role}</span>
                        <span className="text-xs text-muted-foreground">
                          {ROLE_DESCRIPTIONS[role]}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Team Selection */}
            <div className="space-y-2">
              <Label htmlFor="team">Team</Label>
              <Select
                value={assignmentData.team}
                onValueChange={(value: TeamType) => setAssignmentData({ ...assignmentData, team: value })}
              >
                <SelectTrigger id="team">
                  <SelectValue placeholder="Select team" />
                </SelectTrigger>
                <SelectContent>
                  {TEAMS.map((team) => (
                    <SelectItem key={team} value={team}>
                      Team {team}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Stream Selection */}
            <div className="space-y-2">
              <Label htmlFor="stream">Stream</Label>
              <Select
                value={assignmentData.stream}
                onValueChange={(value: StreamType) => setAssignmentData({ ...assignmentData, stream: value })}
              >
                <SelectTrigger id="stream">
                  <SelectValue placeholder="Select stream" />
                </SelectTrigger>
                <SelectContent>
                  {STREAMS.map((stream) => (
                    <SelectItem key={stream} value={stream}>
                      {stream}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {hasAssignmentChanges && (
            <div className="flex justify-end pt-2">
              <Button
                onClick={handleSaveAssignment}
                disabled={isSavingAssignment}
                className="bg-[#0062FF] hover:bg-[#0052D9]"
              >
                {isSavingAssignment ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save Changes
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Account Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Account Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Email Notifications</p>
              <p className="text-sm text-muted-foreground">
                Receive updates about assignments and announcements
              </p>
            </div>
            <Badge variant={participant.email_notifications ? 'default' : 'secondary'}>
              {participant.email_notifications ? 'Enabled' : 'Disabled'}
            </Badge>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Account Status</p>
              <p className="text-sm text-muted-foreground">
                Your current account status
              </p>
            </div>
            <Badge
              variant={participant.status === 'approved' ? 'default' : 'secondary'}
              className={participant.status === 'approved' ? 'bg-green-500' : ''}
            >
              {participant.status}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-red-500/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <AlertTriangle className="h-5 w-5" />
            Danger Zone
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Delete Account</p>
              <p className="text-sm text-muted-foreground">
                Permanently delete your account and all associated data. This action cannot be undone.
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={isDeleting}>
                  {isDeleting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="mr-2 h-4 w-4" />
                  )}
                  Delete Account
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete your account
                    and remove all your data including submissions, achievements, and progress.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteAccount}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    Yes, delete my account
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
