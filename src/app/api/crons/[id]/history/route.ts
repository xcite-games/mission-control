import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

export const dynamic = 'force-dynamic';

interface CronExecution {
  cron_id: string;
  started_at: string;
  exit_code: number;
  duration_ms: number;
  output_snippet?: string;
}

// GET /api/crons/[id]/history - Get execution history for a cron
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '20', 10);

    const logDir = join(process.env.HOME || '', '.xcite', 'crons', 'log', id);

    if (!existsSync(logDir)) {
      return NextResponse.json({ cron_id: id, executions: [], total: 0 });
    }

    const files = readdirSync(logDir)
      .filter(f => f.endsWith('.json'))
      .sort()
      .reverse()
      .slice(0, limit);

    const executions: CronExecution[] = [];

    for (const file of files) {
      try {
        const content = readFileSync(join(logDir, file), 'utf-8').trim();
        if (!content) continue;

        for (const line of content.split('\n')) {
          if (!line.trim()) continue;
          const record = JSON.parse(line.trim());
          executions.push({
            cron_id: record.cron_id || id,
            started_at: record.started_at || record.timestamp || '',
            exit_code: record.exit_code ?? -1,
            duration_ms: record.duration_ms ?? 0,
            output_snippet: record.output_snippet,
          });
          if (executions.length >= limit) break;
        }
      } catch { /* skip malformed files */ }

      if (executions.length >= limit) break;
    }

    return NextResponse.json({
      cron_id: id,
      executions: executions.slice(0, limit),
      total: executions.length,
    });
  } catch (error) {
    console.error('Failed to fetch cron history:', error);
    return NextResponse.json({ error: 'Failed to fetch cron history' }, { status: 500 });
  }
}
