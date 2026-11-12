/**
 * A dialog waiting on the player: the new-puzzle chooser, "Clear entries?",
 * or checking a puzzle read from a photo.
 */
export type Pending = { kind: "new" } | { kind: "restart" } | { kind: "photo" };
