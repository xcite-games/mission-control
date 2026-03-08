import { NextRequest, NextResponse } from 'next/server';
import { execFileSync } from 'child_process';
import { join } from 'path';

export const dynamic = 'force-dynamic';

// POST /api/crons/[id]/trigger - Manually trigger a cron
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Validate cron_id format (alphanumeric + hyphens only)
    if (!/^[a-z0-9-]+$/.test(id)) {
      return NextResponse.json({ error: 'Invalid cron ID format' }, { status: 400 });
    }

    const studioRoot = process.env.XCITE_STUDIO_ROOT || join(process.env.HOME || '', 'xcite', 'XCITE_Studio');
    const dispatchHook = join(studioRoot, 'openclaw', 'hooks', 'cron-dispatch.sh');

    const result = execFileSync('bash', [dispatchHook, id], {
      timeout: 120_000,
      cwd: studioRoot,
      encoding: 'utf-8',
      env: { ...process.env, XCITE_STUDIO_ROOT: studioRoot },
    });

    return NextResponse.json({
      cron_id: id,
      triggered: true,
      output: result.slice(0, 500),
    });
  } catch (error: unknown) {
    const err = error as { status?: number; stdout?: string; stderr?: string; message?: string };
    return NextResponse.json({
      cron_id: (await params).id,
      triggered: false,
      error: err.stderr?.slice(0, 500) || err.message || 'Unknown error',
      output: err.stdout?.slice(0, 500) || '',
    }, { status: 500 });
  }
}
