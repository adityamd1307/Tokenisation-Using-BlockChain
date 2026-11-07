# Singapore application time

User request: “There is a timing issue in the code. Match the application time to real world time (Singapore).”

1. All displayed dates and naive date/time form values use Asia/Singapore (SGT, UTC+08:00), independent of browser timezone. Explicitly offset ISO inputs retain their instant for service integrations. Reject invalid calendar inputs; preserve existing expiry seconds on renewal.
2. Defaults use actual wall-clock time in Singapore. Contract timestamps stay Unix seconds; never add eight hours to on-chain time. Contracts remain authoritative for stage/credential verification.
3. Persistent local demonstration nodes mine periodically when idle, while isolated contract tests retain deterministic mining. Repair an existing behind-clock local node without resetting contracts. Do not move a chain backward or reset it automatically if it is ahead.
4. Time-travel integration tests run on an isolated local node, not the user's demo chain. Any time-forward scenario remains simulation-only.
5. Record reproducible timezone regressions, build/test outcomes, local-clock verification and limitations. No commits or deployment resets are required.
