import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export const dynamic = 'force-dynamic';

interface CronEntry {
  cron_id: string;
  module: string;
  args: string[];
  description: string;
  owner: string;
  output_channel: string | null;
  schedule: string | null;
  last_run: string | null;
  last_status: string | null;
  last_duration_ms: number | null;
}

function loadManifest(): CronEntry[] {
  // Look for manifest in XCITE_Studio repo
  const studioRoot = process.env.XCITE_STUDIO_ROOT || join(process.env.HOME || '', 'xcite', 'XCITE_Studio');
  const manifestPath = join(studioRoot, 'Services', 'Integrations', 'mission_control', 'cron_manifest.json');

  if (!existsSync(manifestPath)) {
    return [];
  }

  try {
    const content = readFileSync(manifestPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return [];
  }
}

function enrichWithStatus(entries: CronEntry[]): CronEntry[] {
  const statusDir = join(process.env.HOME || '', '.xcite', 'crons', 'status');

  return entries.map(entry => {
    const statusPath = join(statusDir, `${entry.cron_id}.json`);
    if (existsSync(statusPath)) {
      try {
        const status = JSON.parse(readFileSync(statusPath, 'utf-8'));
        return {
          ...entry,
          last_run: status.timestamp || entry.last_run,
          last_status: status.exit_code === 0 ? 'success' : 'error',
          last_duration_ms: status.duration_ms || entry.last_duration_ms,
        };
      } catch {
        return entry;
      }
    }
    return entry;
  });
}

// GET /api/crons - List all crons with metadata and status
export async function GET(request: NextRequest) {
  try {
    const owner = request.nextUrl.searchParams.get('owner');
    const status = request.nextUrl.searchParams.get('status');

    let entries = enrichWithStatus(loadManifest());

    if (owner) {
      entries = entries.filter(e => e.owner === owner);
    }
    if (status) {
      entries = entries.filter(e => e.last_status === status);
    }

    return NextResponse.json({
      total: entries.length,
      crons: entries,
    });
  } catch (error) {
    console.error('Failed to fetch crons:', error);
    return NextResponse.json({ error: 'Failed to fetch crons' }, { status: 500 });
  }
}
