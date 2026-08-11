import type {
  ProgressCalculationInput,
  ProgressCalculationOutput,
} from "../types/ObjectiveTypes.js";

/** Strategy-Pattern-adjacent port for computing an `ObjectiveProgress` snapshot's derived metrics — implemented by `calculators/ProgressCalculator.ts`. */
export interface IProgressCalculator {
  calculate(input: ProgressCalculationInput): ProgressCalculationOutput;
}
