// The step finder's public face. Importing "@/lib/steps" (or "./steps")
// resolves to this file, the way a library's public header gathers the
// declarations callers need; the rest of the folder is internal.

export { boardCandidates } from "./board";
export { describeFound, finders, nextStep } from "./finder";
export type { Advice, Removal, Step, Technique, Unit, UnitKind } from "./types";
export { cellsName } from "./wording";
