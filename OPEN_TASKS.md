# 11th Edition Open Tasks

Status (June 2026)

| Category | Task | Status | Notes |
| :--- | :--- | :--- | :--- |
| **Parser Expansion** | Monitor and gather real-world 11th Edition army list formats (e.g., GW App v11, New Recruit v11, WTC v11) | ⏳ Waiting | Waiting on other apps to update. |
| **Parser Expansion** | Implement individual format parsers (e.g., `wtc_compact.js`, `gwapp.js`, `nrgw.js`) matching 11th Edition structure | ⏳ Waiting | Waiting on other apps to update. |
| **Validation & Quality** | Gather text samples from users and players to test parser edge cases | ✅ Complete | |
| **Validation & Quality** | Expand validation suite with additional unit combinations and corner cases | ✅ Complete | |
| **Validation & Quality** | Rebuild `samples/` and `test/v11_parser.test.mjs` fixtures using fresh exports — GW App changed its export formatting (detachment line now precedes bare Force Disposition line, battle size moved to last) and existing samples/assertions (e.g. World Eaters points total) are stale | ⏳ Waiting | Waiting on Jared to export fresh sample lists from each app (GW App, New Recruit, War Organ). |
| **Future Improvements** | Refine JSON structure and schema when implementing support for hiding mandatory/constant wargear | ✅ Complete | |
