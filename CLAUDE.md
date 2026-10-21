@AGENTS.md

# Keep SPEC.md in step with the code

`SPEC.md` describes the game as it is implemented. Any change the player can see, or that changes what is stored (play, generation, the screen, high scores, backup, sync), updates `SPEC.md` in the same pull request. The PR description names the spec sections that changed, or says why none needed to.

# Test every spec rule

A pull request that adds or changes a rule in `SPEC.md` adds or updates the unit tests for it (`src/lib/*.test.ts`) in the same pull request. Put the rule's logic in a plain function in `src/lib` so it can be tested; React hooks and components should only call it. A rule that can't be unit-tested (timers, page events, the network, layout) gets a row in `untested-requirements.md` saying where it lives and why. Remove a row from that file when its rule gains a test.
