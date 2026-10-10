# Data layer bug hunt

An acknowledged change can disappear from this store. I reproduced successful queued updates overwriting one another, a migration retry restoring old data over a newer successful save, and two open copies replacing each other's check-in history. A failed replace-import can also erase the existing record before its replacement is committed.

Reviewed on 8 October 2026 against [BOARD.md](BOARD.md), particularly D10, D13, D16 and D17, and [PLAN.md, Task 1](PLAN.md#task-1--data-layer-srcstore-srchealth--blocks-everything). The working tree was at Git HEAD `f21db7a`. The adjacent settings type acquired `weeklyMovementGoalMinutes` and `statusPeriods` during the review; I checked their persistence too. The nine requested storage, observation and hook implementations remained unchanged during the probes.

I read the requested implementations, their tests, the v4 storage model, and the session consumers that discard saved progress. I executed the actual TypeScript functions in memory against synthetic records, the existing fake IndexedDB, and controlled failure/interleaving wrappers. There were **53 labelled probe observations**, including controls and variants, not 53 independent acceptance tests. I did not run the Vitest suite or exercise a real iPhone. Browser lifecycle findings identify the exact source path or simulated event sequence; remaining Safari questions are separated below. ARCC was unavailable in this session.

Only this review file was written. No application code, test files or real health records were changed.

## Findings index

Severity uses the requested categories. **Data loss** includes a saved field disappearing, an observation being overwritten, or a recovery copy being discarded before persistence. **Wrong data** includes disagreement between the published state and disk. An intentional deletion is classified by its incorrect result or reporting, rather than treating the requested deletion itself as unintended loss.

| ID | Severity | Reproduced issue |
|---|---|---|
| F01 | data loss | Replace-import clears the existing database before replacement writes succeed |
| F02 | data loss | Successful queued adapter updates overwrite a preceding successful change |
| F03 | wrong data | A failed optimistic predecessor reappears after its successor succeeds |
| F04 | data loss | Two open store instances overwrite whole documents from stale snapshots |
| F05 | data loss | An incomplete migration permits saves that its next retry overwrites |
| F06 | data loss | A failed legacy read is marked permanently migrated as an empty device |
| F07 | data loss | Importing an old schema marker causes retained v4 data to overwrite the import |
| F08 | data loss | Merge-import overwrites a newer correction with an older backup |
| F09 | data loss | Guided progress is deleted before the session's asynchronous save succeeds |
| F10 | data loss | Same-day check-ins overwrite distinct glucose readings |
| F11 | data loss | Editing an observation removes its timing tag and meal-start time |
| F12 | data loss | Export/import omits the entire `content-state` store |
| F13 | wrong data | Logical saves across stores commit partially and remain out of sync |
| F14 | wrong data | Live body/session measurements do not update their migrated observation series |
| F15 | wrong data | Migrated BP identities differ from live identities, so a correction shows old BP |
| F16 | wrong data | Adding to a source's day total loses that source's previous total |
| F17 | wrong data | String ordering of timestamps chooses the wrong chronological reading/statement |
| F18 | wrong data | A queued increment crossing midnight carries yesterday's total into today |
| F19 | wrong data | Day grouping hides overlapping intervals across midnight |
| F20 | wrong data | A historical local date can move to the next day during projection |
| F21 | wrong data | Import validation admits illegal scopes and intervals, allowing fabricated totals |
| F22 | crash | Corrupt non-observation records pass preview and enter the live store |
| F23 | wrong data | Reusing an observation ID overwrites disk but appends a duplicate in memory |
| F24 | crash | Clear-all can delete disk data, retain old published data and throw without a failure |
| F25 | crash | Clone/updater/encoding exceptions bypass `StoreResult` and `state.failure` |
| F26 | wrong data | Export reads can assemble a record that never existed as a consistent snapshot |
| F27 | minor | Blocked opens leak eventual connections; version changes and retries are unhandled |
| F28 | minor | A failed direct theme write leaves the synchronous mirror ahead of stored settings |
| F29 | minor | The test fake accepts invalid keys, miscounts overwrites and cannot reopen |

## Reproductions and fixes

### F01. Failed replace-import destroys the previous record

**Severity: data loss.** Sources: [transfer.ts:264](../../src/store/transfer.ts#L264), [transfer.ts:348](../../src/store/transfer.ts#L348), [useStore.ts:911](../../src/store/useStore.ts#L911).

**Trigger and result:** Save session `saved-session` and glucose `saved-glucose`. Import a valid replacement containing a new observation. Let `db.clear(STORE_NAMES)` succeed, then fail the observation write with `QuotaExceededError`. `importRecord` returns `{ok:false}`, but both original stores are empty. The published state still contains `saved-session`, because the failure path calls `fail`, not `resync`. A reload reveals the deletion. Failure later in `write` similarly leaves whichever preceding batches committed. Closing the tab between clear and write has the same destructive boundary.

**Expected and suggested fix:** A failed replacement must leave the old database intact. Validate the entire file before mutation, then clear and populate all affected stores in one transaction. Queue the requests synchronously inside that transaction. Publish the committed result only after completion; reconcile any failure with actual storage.

### F02. Successful queued updates lose an acknowledged setting

**Severity: data loss.** Sources: [useStore.ts:807](../../src/store/useStore.ts#L807), [useStore.ts:819](../../src/store/useStore.ts#L819), [useStore.ts:837](../../src/store/useStore.ts#L837).

**Trigger and result:**

1. Call adapter `update` to set `startDate`.
2. Before it finishes, call another `update` setting `defaultRestSeconds=111`.
3. Let the first persist. Its success republishes its earlier settings slice, including the original rest value `90`.
4. While the second write is waiting for completion, call a third updater changing only `theme`.
5. Complete the second and third writes.

All three return success. The third updater was built from the first operation's republished snapshot, so its whole settings document restores `defaultRestSeconds=90`. Disk and memory both lose the successful `111` change. A simpler reproduction calls `setSettings({theme:'dark'})`, immediately followed by adapter `update` changing only `useMetric`; both succeed, but the final theme is `system`.

**Expected and suggested fix:** Serialise mutation computation as well as persistence. Keep committed state separate from pending mutations, derive each operation from the appropriate current base, and recompute the optimistic projection without publishing an older whole slice over newer pending changes.

### F03. Rollback followed by success republishes a record never saved

**Severity: wrong data.** Sources: [useStore.ts:296](../../src/store/useStore.ts#L296), [useStore.ts:745](../../src/store/useStore.ts#L745), [useStore.ts:838](../../src/store/useStore.ts#L838).

**Trigger and result:** On an empty session store, call `update` adding `A`, then immediately call `update` appending `B`. Fail only the first session write. The second diff was computed against optimistic `A`, so it persists only `B`. After resync removes `A`, the second success republishes its captured `[A,B]` slice and clears `failure`. Observed results were `[false,true]`, published sessions `[A,B]`, and disk sessions `[B]`. Reload removes `A`.

**Expected and suggested fix:** The completed state must contain committed `B` and any explicitly pending work, without resurrecting failed `A`. Rebase pending mutations on committed state after failure. Do not treat an optimistic predecessor as a durable diff baseline or use a captured full slice as proof of what was persisted.

### F04. Two open copies erase each other's check-ins

**Severity: data loss.** Sources: [useStore.ts:117](../../src/store/useStore.ts#L117), [useStore.ts:229](../../src/store/useStore.ts#L229), [useStore.ts:603](../../src/store/useStore.ts#L603), [useStore.ts:941](../../src/store/useStore.ts#L941).

**Trigger and result:** Open two store instances against the same database before either writes. Instance A successfully saves the 8 October check-in. Instance B, whose `checkIns` is still empty, then successfully saves 9 October. B constructs and replaces the entire keyed check-in list from its stale state. Disk contains only 9 October. A still displays 8 October; neither detects the conflict. The lifted glucose can survive independently, but the original check-in's symptoms, news, ketones and readiness record disappear.

**Expected and suggested fix:** A queue inside one module cannot coordinate separate tabs. Store check-ins individually, or perform a transactionally protected read/apply/write with revision checking. Notify other connections to refresh. A notification mechanism alone does not prevent competing stale writes.

### F05. Retrying an incomplete migration overwrites a newer successful save

**Severity: data loss.** Sources: [migrate.ts:290](../../src/store/migrate.ts#L290), [useStore.ts:174](../../src/store/useStore.ts#L174), [useStore.ts:183](../../src/store/useStore.ts#L183).

**Trigger and result:** Migrate a v4 blob containing a session with notes `legacy original`. Allow observations, sessions and the six document rows to commit, but fail the final schema marker. Startup publishes `status='ready'` with a failure. Save a correction to that session, notes `new acknowledged correction`; `putSession` succeeds and clears the failure. Free space and restart. With no marker, migration writes the retained v4 session over the correction. The final notes are `legacy original`.

The probe used a six-row settings quota to fail the seventh marker row; that models the commit boundary, rather than Safari's byte quota.

**Expected and suggested fix:** Commit migration data and its marker atomically. Until that succeeds, prevent later saves from entering a database that the migration will overwrite, or make recovery explicitly preserve newer committed records. Deterministic IDs provide duplicate prevention, but do not establish safe conflict resolution.

### F06. A failed legacy read is treated as an empty, completed migration

**Severity: data loss.** Sources: [migrate.ts:218](../../src/store/migrate.ts#L218), [migrate.ts:245](../../src/store/migrate.ts#L245), [migrate.ts:236](../../src/store/migrate.ts#L236).

**Trigger and result:** IndexedDB opens, but the legacy `localStorage.getItem` throws `SecurityError`. `readLocalV4` returns `null`; migration writes the v5 marker and reports success with zero records and `unreadable=false`. Restore access to the original v4 blob and retry. Migration returns `alreadyDone=true`, and its session is never copied. The old bytes remain in localStorage, but the app and new export exclude them.

This was reproduced with an injected storage read failure and recovery, not a claim that every Safari private mode allows IndexedDB while denying localStorage.

**Expected and suggested fix:** Distinguish “no legacy key” from “could not read the key”. Surface a read failure and leave migration retryable. Do not mark an inaccessible source as successfully migrated.

### F07. An imported schema marker causes v4 history to overwrite the import

**Severity: data loss.** Sources: [transfer.ts:193](../../src/store/transfer.ts#L193), [transfer.ts:269](../../src/store/transfer.ts#L269), [migrate.ts:236](../../src/store/migrate.ts#L236).

**Trigger and result:** On a migrated device that still retains its v4 blob, replace-import a file with the accepted transfer format/version, `schemaVersion=4`, corrected session notes and a newer start date. Import stores the file's marker verbatim and succeeds. On the next startup, migration sees a marker different from `5`, rereads the old localStorage blob and overwrites those session/document fields. The probe's imported start date `2026-09-01` became legacy `2026-01-01`. An unsupported newer schema marker is also accepted by the current validation.

**Expected and suggested fix:** Validate transfer and schema versions separately. Convert supported older payloads to the current schema and write the current marker. Reject unsupported newer schemas before clearing or merging; a file's source schema must not become the destination's migration-completion marker.

### F08. Merge-import silently reverts a newer correction

**Severity: data loss.** Sources: [transfer.ts:259](../../src/store/transfer.ts#L259), [transfer.ts:327](../../src/store/transfer.ts#L327), [transfer.ts:361](../../src/store/transfer.ts#L361).

**Trigger and result:** Disk holds glucose ID `g`, value `155`, with `editedAt='2026-10-09T07:00:00+05:30'`. Merge an 8 October backup containing the same ID, value `110`, without that correction. Import succeeds and replaces disk value `155` with `110`, removing `editedAt`. Sessions, check-ins, body metrics and focus overrides also favour incoming conflicts without a freshness check.

Incoming-wins is explicitly documented at line 247, so this is a destructive merge policy rather than an accidental operator error.

**Expected and suggested fix:** Preserve the newer observation revision using unrounded instant comparisons. Preview differing conflicts and require an explicit resolution for records with no reliable revision metadata. File export time is not the edit time of each record. Reimporting an old backup should not silently undo later corrections.

### F09. Guided progress disappears before durable session acknowledgement

**Severity: data loss.** Sources: [useStore.ts:817](../../src/store/useStore.ts#L817), [SessionPage.tsx:63](../../src/pages/SessionPage.tsx#L63), [SessionPage.tsx:76](../../src/pages/SessionPage.tsx#L76), [useGuidedSession.ts:207](../../src/hooks/useGuidedSession.ts#L207).

**Trigger and result:** Finish a guided session while its progress exists in localStorage. `saveSession` ignores the asynchronous `update` result. The optimistic session appears in `data.sessions`, which causes the page effect to clear progress before IndexedDB acknowledgement. The runner also clears progress directly when status becomes `done`. Fail the session write, or reload before it commits: the final session is absent and its recovery copy has already gone.

The probe held the write, simulated the existing clear-on-publication observer, and failed persistence. Both the session store and recovery key ended empty. React effect timing was inspected, not exercised in a browser.

**Expected and suggested fix:** Retain completed progress until the actual session write returns success. Return/await that result through the caller, remove unconditional runner cleanup, and keep a retryable final record when saving fails. An optimistic `data.sessions` entry must not authorise deleting its recovery copy.

### F10. Same-day check-in rechecks overwrite real glucose history

**Severity: data loss.** Sources: [migrate.ts:108](../../src/store/migrate.ts#L108), [migrate.ts:126](../../src/store/migrate.ts#L126), [useStore.ts:602](../../src/store/useStore.ts#L602), [useStore.ts:755](../../src/store/useStore.ts#L755).

**Trigger and result:** Successfully save an 8 October check-in with glucose `50`, then successfully save its recheck with glucose `110`. The observation ID is date plus kind in both calls. IndexedDB holds only `checkIn:2026-10-08:glucose=110`; the daily check-in list also retains only the second record. With no session snapshot, the earlier reading survives in neither location. Projection also assigns both readings an artificial midday time rather than their event times.

**Expected and suggested fix:** Keep daily readiness as a replaceable summary while recording each distinct measurement with its own event ID and observed time. An explicit correction may edit a referenced observation; a new measurement must append. Use linked IDs to distinguish rechecks, corrections and repeated submission of the same event.

### F11. Editing a reading deletes its timing metadata

**Severity: data loss.** Sources: [useStore.ts:357](../../src/store/useStore.ts#L357), [observation.ts:331](../../src/health/observation.ts#L331).

**Trigger and result:** Add a glucose observation tagged `afterMeal`, with `mealStartedAt='2026-10-08T07:30:00+05:30'`, reading time `09:00`, value `152`. Call `editObservation(id,{value:151})`. The returned and stored record have neither `tag` nor `mealStartedAt`, because the rebuilding input copies context/note/coverage but omits those fields. Editing a BP half likewise removes its morning/evening tag.

**Expected and suggested fix:** A value or note edit must preserve unrelated known metadata. Pass through all retained observation fields when validating the correction, and explicitly validate any field the user changes. Test an edit on a fully populated observation, not only an untagged number.

### F12. The advertised whole-record backup omits a store

**Severity: data loss.** Sources: [db.ts:26](../../src/store/db.ts#L26), [transfer.ts:42](../../src/store/transfer.ts#L42), [transfer.ts:62](../../src/store/transfer.ts#L62), [transfer.ts:265](../../src/store/transfer.ts#L265).

**Trigger and result:** Put `{key:'saved-guidance',value:{bookmarked:true,readAt:'2026-10-08'}}` into `content-state`. Collect/export and replace-import into another database. The target's `content-state` is empty, since neither the transfer model nor collection includes it. Replacing the source from its own export also clears that row permanently.

**Expected and suggested fix:** Include every durable store in the transfer schema, preview and restore path. Define merge semantics for content keys. Extend the round-trip test's `dump`, which currently checks only observations, sessions and settings at [transfer.test.ts:56](../../src/store/transfer.test.ts#L56). That test cannot detect this loss.

### F13. Logical saves commit partially across separate transactions

**Severity: wrong data.** Sources: [useStore.ts:566](../../src/store/useStore.ts#L566), [useStore.ts:575](../../src/store/useStore.ts#L575), [useStore.ts:777](../../src/store/useStore.ts#L777).

**Trigger and result:** Initially save a check-in and its glucose observation at `110`. Change it to `150` using `putCheckIn`. Let the settings-document write succeed and fail the observation write. The method returns failure. Disk now holds check-in glucose `150` and observation glucose `110`; published check-in glucose remains `110`. A later unrelated successful action can clear the failure without repairing this disagreement.

The adapter's `persist` likewise commits session puts, deletes, observations and documents in separate transactions. A failure or reload between steps leaves a subset of an updater's change on disk.

**Expected and suggested fix:** Commit each logical mutation across its participating stores atomically. On failure, the previous coherent record should remain. If atomicity is temporarily unavailable, resync and report the actual partial commit instead of implying that nothing changed, but reconciliation alone does not provide atomicity.

### F14. Live measurements and migrated series drift apart

**Severity: wrong data.** Sources: [migrate.ts:187](../../src/store/migrate.ts#L187), [migrate.ts:192](../../src/store/migrate.ts#L192), [useStore.ts:525](../../src/store/useStore.ts#L525), [useStore.ts:617](../../src/store/useStore.ts#L617), [useStore.ts:733](../../src/store/useStore.ts#L733).

**Trigger and result:** Migrate body metrics for 8 October, weight `80`, waist `90`. Save a correction with `putBodyMetric`, weight `82`, waist `92`. The document shows the correction, but the observation series continues to show `80` and `90`. Body-metric changes through the adapter have the same problem. Similarly, migration projects `session.painAfter`, but live `putSession` and adapter session saves do not create/update that measurement.

**Expected and suggested fix:** Use shared, explicit live and migration projection functions for the measurements that both paths promise to expose. Link observations to their original record IDs and apply corrections atomically. Do not invent observations from preference fields; body measurements and an explicitly recorded post-session pain number are actual measurements.

### F15. A migrated BP correction still displays the old pair

**Severity: wrong data.** Sources: [migrate.ts:172](../../src/store/migrate.ts#L172), [migrate.ts:142](../../src/store/migrate.ts#L142), [aggregate.ts:498](../../src/health/aggregate.ts#L498), [aggregate.ts:505](../../src/health/aggregate.ts#L505).

**Trigger and result:** Migrate an 8 October BP of `140/90`, then live-save a correction for that check-in, `130/80`. Migration IDs begin `bp:checkIn:2026-10-08:...`; live IDs begin `checkIn:2026-10-08:...`. Both pairs share the same pairing context and midday time, so all four halves enter one group. `find` chooses the first half of each kind after sorting, yielding **140/90**, while the current check-in holds **130/80**. Both save paths succeed.

A separate accepted-input boundary is systolic at `09:00+05:30` and diastolic at `03:30Z`, with the same reading ID and day. These denote the same instant, but literal timestamp grouping returns two orphaned readings.

**Expected and suggested fix:** Derive migration/live IDs through the same function; record explicit event/revision identity and reject or flag ambiguous duplicate halves. Match the intended instant numerically while preserving the original recorded day/offset. Do not arbitrarily assemble the first available halves or guess an absent number.

### F16. A source's running total resets after another source becomes latest

**Severity: wrong data.** Sources: [useStore.ts:507](../../src/store/useStore.ts#L507), [aggregate.ts:178](../../src/health/aggregate.ts#L178), [aggregate.ts:202](../../src/health/aggregate.ts#L202).

**Trigger and result:** Call `addToDayTotal('steps',4000,{source:'manual'})`, then record an imported total `7800` for the same day. Add another `1000` with source `manual`. The lookup searches only `current.contributed`, which contains the latest winning imported record. It cannot find the manual baseline and starts from zero. The new manual total, and displayed total, become `1000`; the correct manual statement is `5000`.

**Expected and suggested fix:** Find the latest statement for the requested kind, day, source and unit before incrementing. The aggregate winner across competing sources is not the baseline for every source. Keep the conflicting-source flag and continue refusing to sum separate day totals.

### F17. Timestamp string ordering reverses chronology

**Severity: wrong data.** Sources: [observation.ts:412](../../src/health/observation.ts#L412), [observation.ts:429](../../src/health/observation.ts#L429), [aggregate.ts:453](../../src/health/aggregate.ts#L453), [aggregate.ts:522](../../src/health/aggregate.ts#L522).

**Trigger and result:** Record water `1000` at `2026-11-01T01:50:00-04:00`, then `1250` at `2026-11-01T01:10:00-05:00`. The second instant is 20 minutes later during the DST fall-back, but its timestamp sorts earlier as text. `sum` chooses `1000`, and the day summary's latest record is the first one. The same issue affects edited statements, timeline/series order, BP ordering and which overlapping interval is called first when offsets differ.

**Expected and suggested fix:** Compare `Date.parse(at)` and `Date.parse(editedAt)` for chronological decisions, then use documented stable ties. Keep local `day` derived from the recorded prefix; UTC instant ordering does not require moving readings into a different calendar day.

### F18. A delayed increment carries yesterday's total into today

**Severity: wrong data.** Sources: [useStore.ts:503](../../src/store/useStore.ts#L503), [useStore.ts:508](../../src/store/useStore.ts#L508), [useStore.ts:514](../../src/store/useStore.ts#L514).

**Trigger and result:** Yesterday's water total is `1000`. At `23:59:59+05:30`, call `addToDayTotal('water',250)`, then let the queue execute at `00:00:01`. `today` and `day` were captured before midnight, so the calculation uses yesterday's `1000`. The condition `day===today` remains true, and its timestamp is generated after midnight. The written record is now today's **1250**.

**Expected and suggested fix:** Choose a coherent event-time policy. Capture the tap's observation time/day and write the increment to that day, or determine both day and baseline when execution occurs. Never combine one day's baseline with another day's timestamp. Apply this to an explicit historical day queued across the same boundary too.

### F19. Midnight grouping defeats overlap protection

**Severity: wrong data.** Sources: [aggregate.ts:301](../../src/health/aggregate.ts#L301), [aggregate.ts:420](../../src/health/aggregate.ts#L420), [aggregate.ts:447](../../src/health/aggregate.ts#L447).

**Trigger and result:** Record a measured 20-minute walk starting 8 October at `23:50+05:30`, coverage `1200000` ms. Import a 10-minute interval starting 9 October at `00:00`, coverage `600000` ms. Calling `sum` on both correctly flags overlap and returns `20`. Calling `series` over both days groups them first and returns points `20` and `10`, with **no overlap flag**. `summariseDay` similarly considers only intervals whose start day matches its argument.

**Expected and suggested fix:** Detect overlap across the relevant interval timeline before partitioning by local day. Define how a spanning interval contributes to daily summaries. Time can be split at local midnight; steps/distance require recorded segment evidence or an explicit unsplittable-span presentation, rather than an invented prorating rule.

### F20. Backdating can change the requested historical day

**Severity: wrong data.** Sources: [observation.ts:223](../../src/health/observation.ts#L223), [migrate.ts:109](../../src/store/migrate.ts#L109), [useStore.ts:514](../../src/store/useStore.ts#L514).

**Trigger and result:** With the device timezone `Pacific/Apia`, call `atOnDay('2011-12-30')`. That timezone skipped this date. Constructing a local `Date` silently normalises it, and the function returns `2011-12-31T12:00:00.000+14:00`. A date-only v4 record from a place where 30 December existed is therefore projected onto 31 December when read in this timezone.

**Expected and suggested fix:** Preserve the supplied calendar date for records with unknown original clock time/zone. Do not reinterpret a date-only historical record through the importing device's timezone. Use an explicitly synthetic anchor that retains the exact day and its unknown-time provenance, or represent date-only observations separately. This is a narrow historical edge, not a claim that ordinary Indian midnight handling always fails.

### F21. Imported observations can violate the constructor's invariants

**Severity: wrong data.** Sources: [observation.ts:284](../../src/health/observation.ts#L284), [observation.ts:354](../../src/health/observation.ts#L354), [transfer.ts:259](../../src/store/transfer.ts#L259), [aggregate.ts:216](../../src/health/aggregate.ts#L216).

**Trigger and result:** Import otherwise valid glucose records with `scope='sessionObserved'`, positive coverage, non-overlapping times, values `100` and `200` mg/dL. `isObservation` accepts them because it checks the scope union, not `KINDS.glucose.scopes`. The day aggregator returns a fabricated glucose total of **300 mg/dL**. The constructor would reject these records.

Two identical 20-minute walk observations with `coverageMs=0` are also accepted and summed to **40**, with no overlap/missing-coverage flags. `interval` makes their spans zero, while `noCoverage` checks only `undefined`. Negative finite values, non-string context/note, and incompatible meal metadata also escape the external validator's corresponding constructor checks.

**Expected and suggested fix:** Share validation rules across new, edited and imported observations. For tolerated legacy records, retain them with explicit invalidity/unknown-coverage flags and exclude them from a claimed valid total. Validate allowed scope per kind, finite nonnegative values, positive intervals and metadata types/relationships.

### F22. Non-observation payloads pass preview without usable validation

**Severity: crash.** Sources: [transfer.ts:205](../../src/store/transfer.ts#L205), [transfer.ts:260](../../src/store/transfer.ts#L260), [transfer.ts:272](../../src/store/transfer.ts#L272), [useGuided.ts:45](../../src/hooks/useGuided.ts#L45).

**Trigger and result:** A file with the accepted format/version and `checkIns=[null]` passes preview, replace-import succeeds, and the live store contains `[null]` with no failure. Its ordinary check-in consumer, `checkIns.find(c=>c.date===date)`, throws `TypeError`. Arrays of sessions, personal records and body metrics are similarly cast, rather than validated. A non-string BP `context` accepted as an observation can also crash `bpReadingId` at [observation.ts:394](../../src/health/observation.ts#L394).

A second probe used `sessions=[null]` with one valid observation: preview succeeded, replacement cleared the old session, the observation committed, and the session write failed. This is F01's destructive boundary reached by a corrupt file.

**Expected and suggested fix:** Validate every record, keyed document and supported version before mutation. Reject malformed required structures without replacing the old record. For any supported partial recovery, preview the precise rejected records and obtain that mode's explicit intent; collection length alone is not validation.

### F23. Duplicate observation IDs produce different memory and disk histories

**Severity: wrong data.** Sources: [useStore.ts:320](../../src/store/useStore.ts#L320), [useStore.ts:322](../../src/store/useStore.ts#L322), [observation.ts:332](../../src/health/observation.ts#L332).

**Trigger and result:** Call `addObservation` twice with ID `same-id`: a non-overlapping 10-minute interval, then a 20-minute interval. Both calls succeed. IndexedDB's `put` overwrites the first row, but the store appends the second record to its array. The live day total is **30**, disk contains one record, and reload changes the total to **20**.

**Expected and suggested fix:** Enforce the API's intended identity semantics. Append must reject an existing ID; a deliberate upsert must replace by ID in both disk and memory. Use an explicit edit/correction operation for existing events. Caller-supplied IDs are already part of `ObservationInput`, so this requires no malformed cast.

### F24. Clear-all can delete data while retaining the old live state

**Severity: crash.** Sources: [useStore.ts:644](../../src/store/useStore.ts#L644), [useStore.ts:646](../../src/store/useStore.ts#L646), [useStore.ts:649](../../src/store/useStore.ts#L649), [storage.ts:233](../../src/services/storage.ts#L233).

**Trigger and result:** Save a session, then clear all. If database clear succeeds but the schema-marker write fails, `clearAll` returns failure and publishes no empty state: memory still lists the session, disk is empty. If `localStorage.length` throws `SecurityError` during `resetData`, the promise rejects instead of returning `StoreResult`; `state.failure` remains unset, with the same disk/memory discrepancy. Both paths were reproduced.

**Expected and suggested fix:** Commit database clear plus its empty-schema marker atomically. Catch localStorage cleanup failures and distinguish them from the completed database deletion. Publish the actual resulting empty state when deletion has happened, even if another cleanup remains unsuccessful. Never report the operation as leaving the old records intact.

### F25. Some failures escape the result and notification contract

**Severity: crash.** Sources: [useStore.ts:229](../../src/store/useStore.ts#L229), [useStore.ts:812](../../src/store/useStore.ts#L812), [useStore.ts:897](../../src/store/useStore.ts#L897), [transfer.ts:109](../../src/store/transfer.ts#L109).

**Trigger and result:** An updater that throws does so synchronously before entering `act`, with no `StoreResult` or `state.failure`. A concrete non-cloneable variant returns settings containing a transparent `Proxy` around the otherwise valid `gymDays` object and changes theme. It is optimistically published; another same-tick updater hits `structuredClone(before)` and throws `DataCloneError` before the first write failure has been reported.

Separately, let `CompressionStream` exist but fail during encoding. `exportRecord` rejects through `act` and leaves `state.failure` unset. The queue's `next.catch` only makes the next queue operation runnable; it does not convert the caller's failure or notify the UI. Throwing download creation/click code has analogous uncaught boundaries at [transfer.ts:434](../../src/store/transfer.ts#L434).

**Expected and suggested fix:** Catch exceptions at public action boundaries, validate serialisability before optimistic publication, and convert failures into the promised result/state notification. Compression failure should offer a plain JSON fallback where possible. Do not conflate the tested absence-of-CompressionStream fallback with an encoder that exists and fails.

### F26. Export is not a consistent database snapshot

**Severity: wrong data.** Sources: [transfer.ts:62](../../src/store/transfer.ts#L62), [db.ts:135](../../src/store/db.ts#L135), [useStore.ts:194](../../src/store/useStore.ts#L194).

**Trigger and result:** Start with glucose observation `110` and a check-in containing `110`. Collection creates its observation read transaction. Another connection then writes observation/check-in `150` before the later document read transaction is created. Collection exports observation `110` and check-in `150`, while the final database holds both at `150`. This mixed result was reproduced by scheduling peer writes between transaction creations.

`exportRecord` serialises its own store's actions, which is useful, but cannot serialise another connection. `readAll` uses the same separate-transaction pattern.

**Expected and suggested fix:** Read all participating stores/documents in one readonly transaction, scheduling all requests before awaiting results. Export must describe one coherent snapshot, even while another connection writes. Share this snapshot mechanism with resync/reload where coherent cross-store reads are required.

### F27. Blocked-open and connection lifecycle recovery is incomplete

**Severity: minor.** Sources: [db.ts:128](../../src/store/db.ts#L128), [db.ts:130](../../src/store/db.ts#L130), [db.ts:134](../../src/store/db.ts#L134), [useStore.ts:149](../../src/store/useStore.ts#L149).

**Trigger and result:** A database open reports `blocked`, rejecting the promise. After the other connection closes, that same request can succeed. Its `onsuccess` resolves an already rejected promise, so the newly opened connection is never wrapped or closed. The simulated blocked-then-success sequence produced failure `blocked` and zero close calls.

Normal opened connections also have no `onversionchange` handler. Another copy attempting a schema upgrade/delete remains blocked until this connection closes manually. Store `start` caches even an unsuccessful boot, so closing the blocker and calling `start` again does not retry. The unavailable banner also promises that Home Screen installation fixes the problem, although that does not close a blocking connection.

**Expected and suggested fix:** Close late successful connections after rejected opens. Handle version change by closing the old connection and informing/reopening the store safely. Make a failed boot retryable. Report blocked, denied and failed-read conditions separately; do not claim installation fixes every storage failure.

### F28. A failed theme save leaves a contradictory first-paint mirror

**Severity: minor.** Sources: [useStore.ts:588](../../src/store/useStore.ts#L588), [useTheme.ts:56](../../src/hooks/useTheme.ts#L56), [useTheme.ts:18](../../src/hooks/useTheme.ts#L18).

**Trigger and result:** Starting with theme `system`, fail the settings write for `setSettings({theme:'dark'})`. The localStorage mirror is written first, but failure leaves stored/live settings at `system`. Observed mirror is `dark` and `state.failure='quotaExceeded'`. This direct path is what `useTheme.setTheme` uses; the tested adapter rollback path's resync does not run here.

In unavailable mode, `useTheme` also keeps its initial `atBoot` value: changing the flag does not update that captured value, so an unsaved-session theme choice does not take effect through this hook.

**Expected and suggested fix:** Keep a deliberate in-memory theme choice and the durable/mirrored theme consistent with the selected failure policy. Restore the mirror after a failed durable direct write, or explicitly preserve an ephemeral choice without representing it as the stored one. Preserve synchronous first-paint reading.

### F29. The fake hides important native database failures

**Severity: minor, affects test evidence.** Sources: [fakeIdb.ts:150](../../src/store/fakeIdb.ts#L150), [fakeIdb.ts:154](../../src/store/fakeIdb.ts#L154), [fakeIdb.ts:176](../../src/store/fakeIdb.ts#L176), [fakeIdb.ts:188](../../src/store/fakeIdb.ts#L188).

**Trigger and result:**

- `db.put('sessions',[{date:'2026-10-08',sets:[]}])` succeeds under the fake and stores it under key `'undefined'`. Native inline-key IndexedDB requires a valid key for this store and rejects the missing `id`.
- With a two-record quota and one existing observation, a batch updating that row and adding one new ID fails. The fake increments `added` for the overwrite, even though the final record count would be two.
- Close a database and reopen the same fake factory. The new wrapper still points to its globally closed database; reads fail. Native reopen creates a usable new connection.

**Expected and suggested fix:** Validate key paths, count only newly introduced keys, and model separate connection lifetimes. Add blocked/upgrade/version-change coverage or run those checks against native IndexedDB. Keep the fake's usefulness for deterministic logic tests while making its unsupported behaviours explicit. Its transaction errors are Node DOMExceptions, not proof of Safari exception/event behaviour.

## Checked and found correct

These controls establish limited coverage, rather than design approval.

- **Normal v4 fidelity:** A populated v4 fixture retained all defined top-level history/profile/settings fields through migration. Sessions included sets, warmup/cooldown, supersets, exercise notes, mobility/cardio, embedded check-in, pain, symptom checkpoints and duration. The seven session/document comparisons were equal. A completed second migration returned `alreadyDone=true`. The source v4 blob is deliberately retained.
- **Ordinary adapter diffing:** Nested in-place edits of the cloned input persisted, and explicit session removal removed the IndexedDB row. Equal ordinary JSON values do not need new identity to be detected. Raw check-in removal writes an empty check-in document; the independent projection-retention question is below.
- **Settings fields:** Settings are written as whole objects, rather than selected fields. `weeklyMovementGoalMinutes`, `statusPeriods` and a nested habits object survived update/reload. The normal migrated and exported fixture preserved populated settings/profile documents.
- **Scope/unit protection for valid records:** `sum` refuses mixed kinds/scopes/units and point readings. A day summary separated `dayTotal` steps `4000` from session steps `500`; an unrecorded day had no entry. The imported-invalid-record exception is F21.
- **Interval boundaries within a coherent day:** Non-overlapping/touching valid intervals summed correctly; genuine same-day overlap was excluded and flagged. Local `00:30+05:30` retained its recorded calendar day through `dayOf`. Cross-day and chronological ordering exceptions are F17 to F20.
- **Single-transaction writes:** `db.put` queues requests synchronously, waits for transaction completion, and does not await between individual puts inside an active transaction. A failed two-half BP batch stored neither half and set a quota failure. `removeReading` likewise submits both deletions together. Preserve this scheduling when adding transactions spanning stores.
- **Normal transfer encoding:** The tested populated transfer document round-tripped exactly through gzip. With `CompressionStream` absent, encoding produced correctly labelled plain JSON and decoded exactly. Invalid gzip/JSON is wrapped in a readable `StoreFailure` by `decode`.
- **Persistence feature detection:** Missing persistence APIs return false. If `persisted()` is true, `persist()` is skipped. Refusal/exception returns false without breaking a normal database open. This does not establish an automatic grant or a durable-storage guarantee on every iPhone.
- **Existing test limitations:** The suite already tests normal nested edits, removal, same-tick successful composition, normal migration fidelity, single-store quota atomicity and gzip transfer. The later-success rollback test uses a different slice at [useStore.test.ts:502](../../src/store/useStore.test.ts#L502), so it does not cover F03's shared session slice. The import quota test starts from an empty database at [transfer.test.ts:317](../../src/store/transfer.test.ts#L317), so it cannot detect destruction of an existing record.

## Unconfirmed concerns and policies that need an explicit contract

- **Safari quota exception shape:** `isQuota`, [db.ts:57](../../src/store/db.ts#L57), first requires `error instanceof Error`. An actual cross-realm `Error` named `QuotaExceededError` was classified `unknown` in the probe. That demonstrates the classification limitation, but I did not verify whether this iPhone's native IDB DOMException has that failing prototype relationship. Check actual native synchronous and aborted writes; prefer an object/name check that survives realms and WebIDL exception shapes.
- **Transaction error-event timing:** [db.ts:158](../../src/store/db.ts#L158) settles from `tx.onerror` using `tx.error`; request errors can bubble to this handler. Verify whether Safari populates `tx.error` before that event or only upon abort, and preserve the request's quota error if it is initially null. The fake assigns transaction error first at [fakeIdb.ts:103](../../src/store/fakeIdb.ts#L103), so its tests cannot answer this.
- **Deletion versus historical retention:** Resubmitting a check-in without glucose/BP does not remove previous projected observations. Removing its raw check-in through the adapter also leaves those facts. This behaviour was reproduced, but deleting a daily readiness summary may appropriately retain independently recorded measurements. Define whether each UI action means “remove this summary” or “delete these linked measurements”; require explicit IDs for the latter. Do not erase valid history merely because a later summary omits a reading.
- **Tie resolution across connections:** Generated IDs resolve same-millisecond taps in one loaded module. Separate copies reset their sequence and add random suffixes, so equal-time conflicting totals have no guaranteed commit-order tie. Local same-tick tests do not establish ordering across copies. Define the required tie policy and a shared revision/sequence before asserting an exact later-writer rule.
- **Compressed import resource limits:** `decode` fully materialises decompressed text and parsed JSON without a byte/record/depth limit. I did not run a memory-exhaustion payload on an iPhone. Construct and measure such a test before claiming a device crash; enforce practical limits/preview before destructive work. A browser without `DecompressionStream` also cannot read another device's gzip export through this function; its exception is caught, and its own plain-JSON export remains readable.
- **Eviction and process termination:** I did not verify Home Screen versus tab persistence, private-mode behaviour, disk-pressure eviction, or termination immediately around transaction completion on real WebKit. The definite clear-before-acknowledgement loss is F09; further device durability claims need native testing. `persisted=false` must remain visible as a non-guarantee, and export must remain usable without implying that installation cures quota, blocked connections or arbitrary storage errors.

## Source snapshot

These SHA-256 values identify the implementation exercised, including uncommitted files. Final validation compared them with the files on disk.

| Source | SHA-256 |
|---|---|
| `src/store/db.ts` | `9b49982c2d41abddb936c02226feb12a9f6abd50a115fc2beef01571d33c8955` |
| `src/store/useStore.ts` | `24ac58192dab8ff6aa1d9c0b72a677e7f91cfd3d49e6557d4ea7a8c34abfbeaf` |
| `src/store/migrate.ts` | `4f1ff07c8400e8b8dcc5c12d81dbe2e5e36cf7b758dcfa1319a658d804fabd1b` |
| `src/store/transfer.ts` | `726cb80c1f714a4fbe15350201b0108e6117066a15fa885137df394c374d1d18` |
| `src/store/fakeIdb.ts` | `b50287201d53ff5acf0d5735ccfb1e47c320b4712b50b07cf950cbc15889de84` |
| `src/health/observation.ts` | `b52e187f4ce075e13e16db3b9bb30019b63a426fdc2346425bce8c63ec12d80a` |
| `src/health/aggregate.ts` | `8f063903edc1097e5a0d8320c3470af2fd02c2d5fcb7204276fa9383eb2900c8` |
| `src/hooks/useLocalStorage.ts` | `427b7309a445b40939bde8001e22f83d7df1dccef2d8bb993a6ede3c13757d54` |
| `src/hooks/useTheme.ts` | `0a8fe7f38d93946adc4af820cb568a98c645f6216cee42d56016a40af3f44967` |
