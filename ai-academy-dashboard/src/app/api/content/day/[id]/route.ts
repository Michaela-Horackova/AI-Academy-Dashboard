import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import fs from 'fs/promises';
import path from 'path';

// In-memory cache for content
const contentCache = new Map<string, { data: ContentResponse; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// GitHub configuration
const GITHUB_OWNER = process.env.GITHUB_CONTENT_OWNER || 'luborfedak';
const GITHUB_REPO = process.env.GITHUB_CONTENT_REPO || 'ai-academy';
const GITHUB_BRANCH = process.env.GITHUB_CONTENT_BRANCH || 'main';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

// Local content path for development
const LOCAL_CONTENT_PATH = process.env.LOCAL_CONTENT_PATH || '/Users/luborfedak/Documents/GitHub/ai-academy';

interface ContentResponse {
  day: number;
  situation: string | null;
  resources: string | null;
  mentorNotes: string | null;
  source: 'local' | 'github' | 'database';
  cached: boolean;
}

// Helper to format day number with leading zero
function formatDay(day: number): string {
  return day.toString().padStart(2, '0');
}

// Try to read file from local filesystem
async function readLocalFile(filePath: string): Promise<string | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return content;
  } catch {
    return null;
  }
}

// Try to fetch file from GitHub API
async function fetchFromGitHub(filePath: string): Promise<string | null> {
  if (!GITHUB_TOKEN) {
    return null;
  }

  try {
    const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filePath}?ref=${GITHUB_BRANCH}`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3.raw',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (!response.ok) {
      return null;
    }

    return await response.text();
  } catch {
    return null;
  }
}

// Get content from local filesystem
async function getLocalContent(day: number, isAdmin: boolean): Promise<ContentResponse | null> {
  const dayFolder = `Day-${formatDay(day)}`;
  const basePath = path.join(LOCAL_CONTENT_PATH, '01-Common-Foundations', dayFolder);

  const situationPath = path.join(basePath, 'SITUATION.md');
  const resourcesPath = path.join(basePath, 'RESOURCES.md');
  const mentorPath = path.join(basePath, 'MENTOR-NOTES.md');

  const situation = await readLocalFile(situationPath);
  const resources = await readLocalFile(resourcesPath);
  const mentorNotes = isAdmin ? await readLocalFile(mentorPath) : null;

  // Only return if at least situation file exists
  if (situation) {
    return {
      day,
      situation,
      resources,
      mentorNotes,
      source: 'local',
      cached: false,
    };
  }

  return null;
}

// Get content from GitHub API
async function getGitHubContent(day: number, isAdmin: boolean): Promise<ContentResponse | null> {
  const dayFolder = `Day-${formatDay(day)}`;
  const basePath = `01-Common-Foundations/${dayFolder}`;

  const situation = await fetchFromGitHub(`${basePath}/SITUATION.md`);
  const resources = await fetchFromGitHub(`${basePath}/RESOURCES.md`);
  const mentorNotes = isAdmin ? await fetchFromGitHub(`${basePath}/MENTOR-NOTES.md`) : null;

  // Only return if at least situation file exists
  if (situation) {
    return {
      day,
      situation,
      resources,
      mentorNotes,
      source: 'github',
      cached: false,
    };
  }

  return null;
}

// Get content from database as fallback
async function getDatabaseContent(day: number): Promise<ContentResponse | null> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from('mission_days')
      .select('briefing_content, resources_content')
      .eq('day', day)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      day,
      situation: data.briefing_content,
      resources: data.resources_content,
      mentorNotes: null,
      source: 'database',
      cached: false,
    };
  } catch {
    return null;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const day = parseInt(id, 10);

  if (isNaN(day) || day < 1 || day > 25) {
    return NextResponse.json(
      { error: 'Invalid day. Must be between 1 and 25.' },
      { status: 400 }
    );
  }

  // Check if user is admin/instructor
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  let isAdmin = false;
  if (user) {
    const { data: participant } = await supabase
      .from('participants')
      .select('is_admin')
      .eq('email', user.email)
      .single();
    isAdmin = participant?.is_admin ?? false;
  }

  // Check cache first
  const cacheKey = `day-${day}-admin-${isAdmin}`;
  const cached = contentCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return NextResponse.json({ ...cached.data, cached: true });
  }

  // Try sources in order: local, GitHub, database
  let content: ContentResponse | null = null;

  // 1. Try local filesystem (development)
  content = await getLocalContent(day, isAdmin);

  // 2. Try GitHub API
  if (!content) {
    content = await getGitHubContent(day, isAdmin);
  }

  // 3. Fallback to database
  if (!content) {
    content = await getDatabaseContent(day);
  }

  // Return error if no content found
  if (!content) {
    return NextResponse.json(
      { error: 'Content not found for this day.' },
      { status: 404 }
    );
  }

  // Cache the result
  contentCache.set(cacheKey, { data: content, timestamp: Date.now() });

  return NextResponse.json(content);
}
