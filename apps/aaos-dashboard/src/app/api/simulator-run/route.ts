import { NextResponse, type NextRequest } from "next/server";

import { AaosSimulatorError, callAaosSimulator } from "@/lib/api";
import type { ClaraSimulationRunDto } from "@/types/dashboard.types";

/** Raw `apps/aaos-simulator` `POST /api/simulate` response shape (its own `SimulateResponse`) — only the fields this route flattens into `ClaraSimulationRunDto` are declared. */
interface AaosSimulatorRawResponse {
  readonly simulationResult: {
    readonly finalScore: number;
    readonly finalTemperature: string;
    readonly handoffTriggered: boolean;
    readonly totalTurns: number;
  };
  readonly judgementResult: {
    readonly overallScore: number;
    readonly grade: string;
    readonly verdict: string;
    readonly feedbackItems: ReadonlyArray<{ readonly dimension: string; readonly message: string }>;
  };
}

/**
 * `POST /api/simulator-run` — proxies straight to the real `apps/aaos-simulator`'s
 * `POST /api/simulate` (coordinator note #3 / deliverables checklist's "Cross-app wiring" item).
 * Distinct from `/api/simulation/*`: those proxy `aaos-api`'s own orchestrated multi-stage
 * pipeline (which itself calls `apps/aaos-simulator` server-side as one of its stages); this route
 * is a standalone "coba satu persona sekarang" shortcut Step 4 of the wizard can use to preview one
 * persona's real Clara conversation + AI Judge score without kicking off the full 6-step run.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const body: unknown = await request.json().catch(() => undefined);
  const personaId =
    typeof body === "object" && body !== null && "personaId" in body
      ? String((body as { personaId: unknown }).personaId)
      : undefined;
  if (personaId === undefined || personaId.length === 0) {
    return NextResponse.json({ error: { message: '"personaId" is required' } }, { status: 400 });
  }

  try {
    const raw = await callAaosSimulator<AaosSimulatorRawResponse>(personaId);
    const data: ClaraSimulationRunDto = {
      finalScore: raw.simulationResult.finalScore,
      finalTemperature: raw.simulationResult.finalTemperature,
      handoffTriggered: raw.simulationResult.handoffTriggered,
      totalTurns: raw.simulationResult.totalTurns,
      overallScore: raw.judgementResult.overallScore,
      grade: raw.judgementResult.grade,
      verdict: raw.judgementResult.verdict,
      feedbackItems: raw.judgementResult.feedbackItems,
    };
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof AaosSimulatorError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
