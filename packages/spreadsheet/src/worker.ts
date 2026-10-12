import { FormulaEngine } from "./engine";
import type { WorkbookSnapshot } from "./formula";
const engine = new FormulaEngine();
const worker = self as unknown as {
  onmessage: (
    event: MessageEvent<{ id: number; snapshot: WorkbookSnapshot }>,
  ) => void;
  postMessage: (data: unknown) => void;
};
worker.onmessage = (event) => {
  try {
    worker.postMessage({
      id: event.data.id,
      result: engine.calculate(event.data.snapshot),
    });
  } catch (error) {
    worker.postMessage({
      id: event.data.id,
      error: error instanceof Error ? error.message : "Calculation failed",
    });
  }
};
