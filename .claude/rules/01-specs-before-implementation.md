# Rule: Specs Before Implementation

Architectural changes must be reflected in `./project-specs/` before any implementation code is written.

## What Counts as an Architectural Change

- Adding or removing an API route
- Adding a new component not listed in SYSTEM_ARCHITECTURE.md
- Changing the HistoricalEvent data model (adding/removing fields)
- Adding a dependency with non-trivial system design impact
- Adding a new service, utility module, or data file not already listed in SYSTEM_ARCHITECTURE.md
- Changing the scoring formula

## Procedure

1. Update the relevant `project-specs/` document(s) first.
2. Confirm the change with the developer.
3. Only then write implementation code.

## Does NOT Require a Spec Update

- Bug fixes within existing, already-specified components
- Styling changes
- Writing unit tests for already-specified utilities
- Adding event records to `events.json`
