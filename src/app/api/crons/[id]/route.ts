import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export const dynamic = 'force-dynamic';

// GET /api/crons/[id] - Get a single cron entry
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const studioRoot = process.env.XCITE_STUDIO_ROOT || join(process.env.HOME || '', 'xcite', 'XCITE_Studio');
    const manifestPath = join(studioRoot, 'Services', 'Integrations', 'mission_control', 'cron_manifest.json');

    if (!existsSync(manifestPath)) {
      return NextResponse.json({ error: 'Cron manifest not found' }, { status: 404 });
    }

    const entries = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    const entry = entries.find((e: { cron_id: string }) => e.cron_id === id);

    if (!entry) {
      return NextResponse.json({ error: 'Cron not found' }, { status: 404 });
    }

    // Enrich with latest status
    const statusPath = join(process.env.HOME || '', '.xcite', 'crons', 'status', `${id}.json`);
    if (existsSync(statusPath)) {
      try {
        const status = JSON.parse(readFileSync(statusPath, 'utf-8'));
        entry.last_run = status.timestamp || entry.last_run;
        entry.last_status = status.exit_code === 0 ? 'success' : 'error';
        entry.last_duration_ms = status.duration_ms || entry.last_duration_ms;
      } catch { /* ignore parse errors */ }
    }

    return NextResponse.json(entry);
  } catch (error) {
    console.error('Failed to fetch cron:', error);
    return NextResponse.json({ error: 'Failed to fetch cron' }, { status: 500 });
  }
}
