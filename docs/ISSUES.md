# Public issue status summary

This is a sanitized summary of the original issue ledger; it preserves identifiers and current status. Original detailed device evidence remains in the unchanged private development records. No tests or fixes of the five deferred/open Key Tester issues were performed during public-source preparation.

| ID | Issue | Status | Current boundary |
| --- | --- | --- | --- |
| ISSUE-01 | Keycode categories not all visible | FIXED | Existing fix retained; no new user acceptance claimed. |
| ISSUE-02 | AIR68 normal Key Tester Right Shift | DEFERRED | User-reported missing feedback remains unresolved. |
| ISSUE-03 | AIR68 Matrix Test Space | DEFERRED | Ineffective experimental mapping was removed; original JSON/Keymap coordinates retained. |
| ISSUE-04 | Save + Load naming | VERIFIED (software) | Save & Load display retained. |
| ISSUE-05 | Diagnostic version information | FIXED | Evidence and actual device values remain separate; unavailable firmware version is not guessed. |
| ISSUE-06 | Matrix rapid stop/start race | VERIFIED | Existing software and AIR68 user acceptance retained. |
| ISSUE-07 | DOS68 Matrix no feedback | BLOCKED | Pending firmware investigation; root cause not established as a confirmed firmware defect. |
| ISSUE-08 | Hidden Host Layout options focusable | FIXED | Existing fix retained. |
| ISSUE-09 | 2D keyboard focus/navigation | VERIFIED | User-accepted visible focus retained. |
| ISSUE-10 | Settings focus/accessibility names | FIXED | Existing fix and evidence retained, no new hardware acceptance claimed. |
| ISSUE-11 | Incomplete Chinese localization | VERIFIED (software) | Software validation is not hardware acceptance. |
| ISSUE-12 | Spacetime65 Matrix all keys no feedback | OPEN | Needs evidence; DOS68 data cannot establish this device's cause. |
| ISSUE-13 | DOS68 normal Right Shift no feedback | OPEN | Other keys not comprehensively confirmed; not a complete normal-tester pass. |

The user paused ISSUE-02, 03, 07, 12 and 13 investigations. See TESTING_RULES.md before future acceptance work. Do not renumber or infer that a deferred issue was fixed.
