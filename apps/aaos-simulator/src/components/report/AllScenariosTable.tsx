import { formatOverallScore, verdictEmoji, verdictLabel } from "@/lib/formatters";
import type { SimulateAllResultEntry } from "@/types/simulator.types";

import { GradeChip } from "../ui/GradeChip";

export interface AllScenariosTableProps {
  readonly results: ReadonlyArray<SimulateAllResultEntry>;
  readonly personaNames: Readonly<Record<string, string>>;
}

/** Summary of all 10 personas (spec "components/report/AllScenariosTable.tsx"). */
export function AllScenariosTable({
  results,
  personaNames,
}: AllScenariosTableProps): React.ReactElement {
  return (
    <div className="overflow-x-auto rounded-card border border-hairline bg-surface-card shadow-card">
      <table data-testid="all-scenarios-table" className="w-full min-w-[480px] text-left text-sm">
        <thead>
          <tr className="border-b border-hairline text-xs uppercase tracking-wide text-ink-muted">
            <th className="px-4 py-2 font-medium">Skenario</th>
            <th className="px-4 py-2 font-medium">Score</th>
            <th className="px-4 py-2 font-medium">Grade</th>
            <th className="px-4 py-2 font-medium">Verdict</th>
          </tr>
        </thead>
        <tbody>
          {results.map((entry) => (
            <tr
              key={entry.personaId}
              data-testid="all-scenarios-row"
              className="border-b border-hairline last:border-b-0"
            >
              <td className="px-4 py-2 text-ink">
                {personaNames[entry.personaId] ?? entry.personaId}
              </td>
              <td className="px-4 py-2 text-ink">
                {formatOverallScore(entry.judgementResult.overallScore)}
              </td>
              <td className="px-4 py-2">
                <GradeChip grade={entry.judgementResult.grade} />
              </td>
              <td className="px-4 py-2 text-ink">
                <span aria-hidden="true">{verdictEmoji(entry.judgementResult.verdict)}</span>{" "}
                {verdictLabel(entry.judgementResult.verdict)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
