# Epic 9: Code Quality — SonarQube Remediation

> **Source:** SonarQube analysis of the `Resume-Enhancer` project run after Epic 4 completion.
> **Total issues:** 255 (18 CRITICAL · 49 MAJOR · 184 MINOR · 4 INFO)
> **Quality gate status:** FAILING — new coverage 0 % (threshold ≥ 80 %), new duplication density 11.4 % (threshold ≤ 3 %), new violations 7 (threshold 0).
> **Stories are ordered strictly by severity** — CRITICAL issues first, then MAJOR, then MINOR — so the most impactful quality debt is retired before lower-priority cleanup begins.

---

### Story 9.1: Reduce Critical TypeScript Cognitive Complexity & Remove Void Operator (11 CRITICAL issues)

As a developer,
I want complex TypeScript functions to be broken into smaller, focused units and void-operator misuse to be removed,
So that the codebase is easier to read, maintain, and reason about, and the 9 CRITICAL cognitive-complexity violations are resolved.

**Affected rules:** `typescript:S3776` (cognitive complexity > 15), `typescript:S2004` (function nesting depth > 4), `typescript:S3735` (use of void operator)

**Affected files:** `frontend/src/pages/ProfilePage.tsx`, `frontend/src/pages/LoginPage.tsx`, `frontend/src/pages/SignupPage.tsx`, `frontend/src/pages/EditorPage.tsx`, `frontend/src/stores/useResumeStore.ts`

**Acceptance Criteria:**

**Given** `ProfilePage.tsx`, `LoginPage.tsx`, `SignupPage.tsx`, and `EditorPage.tsx` contain functions with a cognitive complexity score above 15 (SonarQube rule S3776)
**When** refactoring is complete
**Then** every function in those files has a cognitive complexity score ≤ 15; complex conditional blocks are extracted into named helper functions or custom hooks with descriptive names; no logic changes are made — only structural extraction

**Given** `ProfilePage.tsx` and `useResumeStore.ts` contain functions nested more than 4 levels deep (S2004)
**When** refactoring is complete
**Then** no function is nested more than 4 levels deep; inner functions are extracted to module-level helpers or custom hooks where appropriate

**Given** the void operator is used in two locations (S3735)
**When** refactoring is complete
**Then** all `void expression` patterns are replaced with proper `return;` statements or ignored-promise patterns using `// eslint-disable-next-line` where a fire-and-forget is genuinely intentional and that intent is documented with a comment

**Given** the story is implemented
**When** tests are run
**Then** all existing tests continue to pass without modification; no regressions are introduced in ProfilePage, LoginPage, SignupPage, EditorPage, or useResumeStore behaviour; SonarQube re-scan shows 0 remaining S3776, S2004, and S3735 violations

---

### Story 9.2: Resolve Critical Java Issues — String Constants & Empty Test Method (7 CRITICAL issues)

As a developer,
I want duplicate Java string literals extracted to named constants and any empty test methods implemented or removed,
So that the 7 CRITICAL Java violations are eliminated and the codebase follows the DRY principle.

**Affected rules:** `java:S1192` (string literal duplicated ≥ 4 times), `java:S1186` (empty method body)

**Affected files:** `src/main/java/.../upload/parsers/LlmSectionExtractor.java`, `src/main/java/.../export/TemplateDefinition.java`, plus the test file containing the empty method

**Acceptance Criteria:**

**Given** `LlmSectionExtractor.java` and `TemplateDefinition.java` contain string literals (`"startDate"`, `"endDate"`, `"isCurrent"`, and others) that are duplicated 4 or more times (S1192)
**When** refactoring is complete
**Then** each duplicated string literal is extracted to a `private static final String` constant named in `UPPER_SNAKE_CASE` at the top of its class; all usages reference the constant; the string value appears in exactly one place per class

**Given** a test class contains an empty method body with no comment explaining the intent (S1186)
**When** the fix is applied
**Then** the method is either (a) implemented with at minimum a `assertTrue(true)` placeholder and a `// TODO:` comment explaining what the test should verify, or (b) deleted if it represents dead scaffolding with no planned assertion; no empty method bodies without explanatory comments remain

**Given** the story is implemented
**When** tests are compiled and run
**Then** all existing tests pass; SonarQube re-scan shows 0 remaining S1192 and S1186 violations in the affected files

---

### Story 9.3: Accessibility & ARIA Compliance — Interactive Element Semantics (35 MAJOR issues)

As a user of the application (including users relying on assistive technology),
I want all interactive elements to use proper semantic HTML and ARIA roles,
So that the application meets WCAG 2.1 AA accessibility requirements and keyboard/screen-reader users can interact with all resume section controls.

**Affected rules:** `typescript:S6848` (non-native interactive element, 30 issues), `typescript:S6819` (use native `<button>` not `role="button"`, 2 issues), `typescript:S6842` (interactive role on non-interactive element, 1 issue), `typescript:S1082` (click handler without keyboard listener, 1 issue), `typescript:S6853` (form label not associated with control, 1 issue)

**Affected files:** All section renderer components (`CertificationsSectionRenderer.tsx`, `EducationSectionRenderer.tsx`, `WorkExperienceSectionRenderer.tsx`, `ProjectsSectionRenderer.tsx`, `LanguagesSectionRenderer.tsx`, `SkillsSectionRenderer.tsx`, `VolunteeringSectionRenderer.tsx`, `SummarySectionRenderer.tsx`), and any page component with unassociated form labels

**Acceptance Criteria:**

**Given** non-native elements (e.g., `<div>`, `<span>`) are used as interactive controls without proper ARIA roles (S6848)
**When** the fix is applied
**Then** every such element is replaced with a semantically correct HTML element (`<button>`, `<a>`, etc.) or is given an explicit `role` attribute plus `tabIndex={0}` and both `onClick` and `onKeyDown` handlers; no interactive behaviour is accessible only via mouse

**Given** elements use `role="button"` instead of a native `<button>` element (S6819)
**When** the fix is applied
**Then** `role="button"` is removed and the element is replaced with `<button type="button">`; existing styles are preserved via `className`

**Given** an interactive ARIA role is assigned to an inherently non-interactive element (S6842)
**When** the fix is applied
**Then** the element is restructured so the interactive role is on a natively interactive element or the non-interactive element is replaced entirely

**Given** a click handler exists on a non-interactive element without a corresponding keyboard handler (S1082)
**When** the fix is applied
**Then** an `onKeyDown` handler is added that triggers the same action on `Enter` and `Space` keypress; or the element is replaced with a `<button>` as above

**Given** a form label is not programmatically associated with its input control (S6853)
**When** the fix is applied
**Then** the `<label>` uses an `htmlFor` attribute matching the input's `id`, or the input is nested inside the `<label>`; no orphaned labels remain

**Given** the story is implemented
**When** tests are run
**Then** all section renderer tests pass; keyboard navigation through section items works without mouse; SonarQube re-scan shows 0 remaining S6848, S6819, S6842, S1082, and S6853 violations

---

### Story 9.4: Java Backend Code Quality — LlmSectionExtractor & Exception Handling (15 MAJOR/MINOR issues)

As a developer,
I want Java backend code in `LlmSectionExtractor` and related classes to follow clean-code practices — no nested try blocks, no commented-out code, proper `InterruptedException` handling, no unused fields, no `Thread.sleep` in tests, and lambdas replaced with method references where applicable,
So that the backend is easier to maintain and the 15 Java code-quality violations are eliminated.

**Affected rules:** `java:S1141` (nested try blocks, 2 MAJOR), `java:S125` (commented-out code, 1 MAJOR), `java:S2142` (InterruptedException swallowed, 1 MAJOR), `java:S1068` (unused private field, 1 MAJOR), `java:S2925` (Thread.sleep in test, 1 MAJOR), `java:S1612` (lambda → method reference, 9 MINOR), `java:S2147` (combine identical catch blocks, 2 MINOR)

**Affected files:** `src/main/java/.../upload/parsers/LlmSectionExtractor.java`, `src/main/java/.../ai/OllamaHealthGuard.java`, `src/main/java/.../auth/JwtAuthenticationFilter.java`, and associated test files

**Acceptance Criteria:**

**Given** `LlmSectionExtractor.java` or `OllamaHealthGuard.java` contains nested try-catch blocks (S1141)
**When** the refactoring is complete
**Then** nested try blocks are extracted into separate private methods with descriptive names; each method handles one responsibility; the calling code delegates cleanly

**Given** commented-out code blocks exist in any of the affected files (S125)
**When** the fix is applied
**Then** all commented-out code is removed entirely; if the code represents future intent, a `// TODO:` comment describing the intent replaces the dead code

**Given** `InterruptedException` is caught and swallowed or logged without re-interrupting the thread (S2142)
**When** the fix is applied
**Then** every `catch (InterruptedException e)` block calls `Thread.currentThread().interrupt()` before any other action, and then either re-throws or handles the interruption gracefully per the method's contract

**Given** unused private fields exist in any of the affected classes (S1068)
**When** the fix is applied
**Then** all private fields that are declared but never read are deleted; if a field was intended for future use, a `// TODO:` comment explains the intent without retaining the unused field

**Given** a test uses `Thread.sleep()` to wait for async results (S2925)
**When** the fix is applied
**Then** `Thread.sleep()` is replaced with a proper await mechanism: Awaitility `await().atMost(...)`, `CompletableFuture.get()`, or Testcontainers wait strategies as appropriate

**Given** lambda expressions can be replaced by equivalent method references (S1612)
**When** the refactoring is applied
**Then** all lambdas of the form `x -> SomeClass.method(x)` or `x -> x.method()` are replaced with the corresponding method reference (`SomeClass::method` or `ClassName::method`)

**Given** multiple catch blocks catch different exception types but execute identical code (S2147)
**When** the fix is applied
**Then** the duplicate catch blocks are merged using the multi-catch syntax: `catch (ExceptionA | ExceptionB e)`

**Given** the story is implemented
**When** tests are compiled and run
**Then** all existing backend tests pass; no behaviour changes occur; SonarQube re-scan shows 0 remaining S1141, S125, S2142, S1068, S2925, S1612, and S2147 violations in the affected files

---

### Story 9.5: Eliminate Duplicate & Redundant Code — Nested Ternaries & Dead Assignments (8 MAJOR/MINOR issues)

As a developer,
I want nested ternary expressions extracted into readable conditional logic and redundant variable assignments removed,
So that the code is immediately comprehensible and the 8 duplication/redundancy violations are resolved.

**Affected rules:** `typescript:S3358` (nested ternary, 5 MAJOR), `typescript:S4165` (redundant assignment, 1 MAJOR), `typescript:S3863` (duplicate import, 2 MINOR)

**Affected files:** `frontend/src/components/resume/ResumeCanvas.tsx`, `frontend/src/pages/ProfilePage.tsx`, `frontend/src/hooks/useResumeUpload.ts`, and others flagged by SonarQube

**Acceptance Criteria:**

**Given** a nested ternary expression exists (e.g., `a ? b : c ? d : e`) in any flagged file (S3358)
**When** the fix is applied
**Then** the expression is rewritten as an `if/else` block or extracted into a clearly named variable or helper function; the resulting code fits on ≤ 2 lines or is extracted to a named constant; no nested ternaries remain in the affected files

**Given** a variable is assigned a value that is immediately overwritten on all subsequent code paths, making the first assignment dead (S4165)
**When** the fix is applied
**Then** the dead first assignment is removed; the variable is initialised at the point where the actual value is first known, or declared with `let` and assigned in each conditional branch

**Given** a module is imported twice from the same path in a single file (S3863)
**When** the fix is applied
**Then** the two import statements are merged into a single import that covers all the named or default imports; no duplicate `import` lines remain for the same module path

**Given** the story is implemented
**When** tests are run
**Then** all existing tests pass; SonarQube re-scan shows 0 remaining S3358, S4165, and S3863 violations

---

### Story 9.6: Fix Application Configuration — Content Length Threshold & ProfileService Decomposition (3 MAJOR/INFO issues)

As a developer,
I want the file upload content-length limit to stay within the safe threshold and `ProfileService` to be decomposed so it no longer exceeds the 20-dependency ceiling,
So that the application configuration is safe and the service layer remains maintainable as the codebase grows.

**Affected rules:** `java:S5693` (content length limit > 8 MB, 2 MAJOR), `java:S6539` (monster class with > 20 dependencies, 1 INFO)

**Affected files:** `src/main/resources/application.yml`, `src/main/java/.../profile/ProfileService.java`

**Acceptance Criteria:**

**Given** `application.yml` configures a multipart or request content-length limit of 10 MB (S5693)
**When** the fix is applied
**Then** both `spring.servlet.multipart.max-file-size` and `spring.servlet.multipart.max-request-size` are reduced to `8MB`; `FileValidator` already enforces ≤ 10 MB at the application level — that threshold is also updated to ≤ 8 MB to stay consistent; the change is reflected in the existing file-upload integration test

**Given** `ProfileService` has more than 20 injected dependencies, violating the single-responsibility heuristic (S6539)
**When** the refactoring is complete
**Then** `ProfileService` is decomposed into at minimum two focused services: one handling profile CRUD and field mapping, and one handling the profile-to-resume content projection; each resulting class has ≤ 20 injected dependencies; existing API contracts (`PUT /api/v1/profile`, profile read endpoints) are unchanged; all existing `ProfileServiceTest` and `ProfileController` integration tests pass without modification

**Given** the story is implemented
**When** tests are run
**Then** all existing profile-domain tests pass; the upload integration test rejects a file > 8 MB with HTTP 400; SonarQube re-scan shows 0 remaining S5693 violations and the S6539 flag is resolved

---

### Story 9.7: Type Safety — Remove Unnecessary Assertions & Deprecated APIs (29 MINOR issues)

As a developer,
I want unnecessary TypeScript type assertions removed and deprecated `FormEvent` usage replaced with the current API,
So that the type system is authoritative (not bypassed) and deprecated APIs do not accumulate as technical debt.

**Affected rules:** `typescript:S4325` (unnecessary type assertion, 22 MINOR), `typescript:S6571` (union type string override, 3 MINOR), `typescript:S1874` (deprecated `FormEvent` usage, 4 MINOR)

**Affected files:** `frontend/src/components/resume/ResumeCanvas.test.tsx`, `frontend/src/test/setup.ts`, `frontend/src/pages/SettingsPage.tsx`, and any other flagged file

**Acceptance Criteria:**

**Given** a type assertion `as T` is applied to an expression that is already of type `T` or assignable to the receiving type without casting (S4325)
**When** the fix is applied
**Then** the redundant `as T` cast is removed; where the type inference gap was hiding a genuine mismatch the type at the declaration site is corrected instead

**Given** a TypeScript union type contains a `string` member alongside specific string literals (e.g., `"foo" | "bar" | string`), causing the literals to be absorbed and providing no type narrowing (S6571)
**When** the fix is applied
**Then** either the `string` member is removed (if only the literal values are valid) or the literals are removed (if any string is accepted); the resulting type accurately describes the domain

**Given** `FormEvent` from React is used directly in event handlers (S1874, deprecated)
**When** the fix is applied
**Then** `FormEvent` is replaced with `React.FormEvent` (the fully qualified form) or with `React.SyntheticEvent` where the specific form-event shape is not required; no direct `FormEvent` bare import remains from the deprecated path

**Given** the story is implemented
**When** TypeScript strict-mode compilation and all tests run
**Then** 0 type errors are introduced; all tests pass; SonarQube re-scan shows 0 remaining S4325, S6571, and S1874 violations

---

### Story 9.8: Java Test Quality — Time Constants & Deterministic Clock (25 MINOR/INFO issues)

As a developer,
I want Java tests to use `java.time.Month` enum constants instead of magic integer literals, inject a deterministic fixed clock instead of the system clock, and replace `java.util.Date` with the modern `java.time` API,
So that test behaviour is predictable, readable, and free of time-dependent flakiness.

**Affected rules:** `java:S8694` (use `Month` enum, not int, 21 MINOR), `java:S8692` (don't use system clock in tests, 2 INFO), `java:S2143` (use `java.time` instead of `java.util.Date`, 1 INFO)

**Affected files:** `src/test/java/.../resume/ResumeItemSerializationTest.java`, `src/test/java/.../resume/ResumeServiceTest.java`, `src/test/java/.../upload/LlmSectionExtractorTest.java`, `src/test/java/.../profile/ProfileServiceTest.java`, `src/main/java/.../auth/TokenService.java`

**Acceptance Criteria:**

**Given** Java test code passes integer literals as month arguments (e.g., `LocalDate.of(2024, 3, 15)`) in the affected test files (S8694)
**When** the fix is applied
**Then** every integer month argument is replaced with the corresponding `java.time.Month` enum value (e.g., `LocalDate.of(2024, Month.MARCH, 15)`); the `java.time.Month` import is added where absent

**Given** test code relies on `LocalDate.now()`, `Instant.now()`, or `Clock.systemDefaultZone()` so test results vary by the real wall-clock time (S8692)
**When** the fix is applied
**Then** a `Clock.fixed(Instant.parse("..."), ZoneOffset.UTC)` is injected into the system under test via constructor parameter or a test-specific factory; the fixed instant is a plausible date (not epoch 0); test assertions are written against known deterministic values

**Given** `TokenService.java` uses `java.util.Date` for JWT expiry or issuance timestamps (S2143)
**When** the fix is applied
**Then** `java.util.Date` is replaced with `java.time.Instant`; the jjwt API accepts `Date` in some places — use `Date.from(instant)` only at the jjwt boundary; internal logic uses `Instant` exclusively

**Given** the story is implemented
**When** tests are compiled and run
**Then** all tests pass and produce the same result regardless of when they are run; SonarQube re-scan shows 0 remaining S8694, S8692, and S2143 violations

---

### Story 9.9: Frontend Code Style — Simplified Conditionals & Modern Idioms (37 MINOR issues)

As a developer,
I want negated conditions simplified, null-default ternaries replaced with nullish coalescing, `.find()` existence checks replaced with `.some()`, and legacy import and escaping patterns modernised,
So that code is idiomatic TypeScript/JavaScript and the 37 style violations are eliminated.

**Affected rules:** `typescript:S7735` (simplify negated condition, 22 MINOR), `typescript:S6606` (use `??` instead of ternary for null defaults, 7 MINOR), `typescript:S7754` (use `.some()` not `.find()` for existence check, 4 MINOR), `typescript:S7776` (use `Set.has()` not array/object check, 1 MINOR), `typescript:S7772` (use `node:` prefix for Node built-ins, 1 MINOR), `typescript:S7780` (use `String.raw` to avoid backslash escaping, 2 MINOR)

**Affected files:** `frontend/src/pages/ProfilePage.tsx` (21 issues), `frontend/src/lib/resumeItemFactory.ts`, `frontend/src/components/resume/ResumeSection.tsx`, and others flagged by SonarQube

**Acceptance Criteria:**

**Given** a condition is written as `!a ? x : y` where `a ? y : x` is equivalent and less cognitive overhead (S7735)
**When** the fix is applied
**Then** negated conditions are inverted so the positive branch comes first; the `!` operator is removed; no logic change occurs

**Given** a ternary is used solely to substitute a null/undefined default (e.g., `x !== null ? x : defaultValue`) (S6606)
**When** the fix is applied
**Then** the ternary is replaced with the nullish coalescing operator: `x ?? defaultValue`

**Given** `array.find(predicate)` is used only to check whether a matching element exists — the return value is then coerced to boolean or compared to `undefined` (S7754)
**When** the fix is applied
**Then** `array.find(predicate) !== undefined` is replaced with `array.some(predicate)`

**Given** an array or object is used to check membership where a `Set` would be semantically correct and more efficient (S7776)
**When** the fix is applied
**Then** the membership check is rewritten using a `Set` with `.has()`

**Given** a Node.js built-in module is imported without the `node:` protocol prefix (e.g., `import path from 'path'`) (S7772)
**When** the fix is applied
**Then** the import is updated to use the `node:` prefix: `import path from 'node:path'`

**Given** a string literal contains manually escaped backslashes that could be expressed more clearly with `String.raw` (S7780)
**When** the fix is applied
**Then** the string is rewritten as a `String.raw` tagged template literal; no double-backslash sequences remain in the affected expressions

**Given** the story is implemented
**When** TypeScript strict-mode compilation and all tests run
**Then** 0 type errors are introduced; all tests pass; SonarQube re-scan shows 0 remaining S7735, S6606, S7754, S7776, S7772, and S7780 violations

---

### Story 9.10: Replace window/global References with globalThis (11 MINOR issues)

As a developer,
I want all direct `window` (browser) and `global` (Node.js) global object references replaced with the environment-agnostic `globalThis`,
So that shared code running in both the Vite browser environment and the Vitest Node.js test runner does not break and SonarQube rule S7764 is cleared.

**Affected rules:** `typescript:S7764` (use `globalThis` instead of `window` or `global`, 11 MINOR)

**Affected files:** `frontend/src/components/theme-provider.tsx` (7 issues), `frontend/src/lib/apiClient.ts` (3 issues), `frontend/src/test/setup.ts` (1 issue)

**Acceptance Criteria:**

**Given** `theme-provider.tsx` references `window` to read or write global properties (S7764)
**When** the fix is applied
**Then** all `window.xxx` references are replaced with `globalThis.xxx`; the component's theme persistence behaviour is unchanged in the browser

**Given** `apiClient.ts` references `window` to read environment variables or global config (S7764)
**When** the fix is applied
**Then** all `window.xxx` references are replaced with `globalThis.xxx`; API calls continue to work correctly in the browser and in test environments

**Given** `test/setup.ts` references `global` to configure test globals (S7764)
**When** the fix is applied
**Then** `global.xxx` references are replaced with `globalThis.xxx`; the Vitest test setup continues to initialise mocks correctly

**Given** the story is implemented
**When** all frontend tests run
**Then** all tests pass in both browser (Vite) and Node (Vitest) environments; SonarQube re-scan shows 0 remaining S7764 violations

---

### Story 9.11: Enforce Read-Only Component Props Across All React Components (72 MINOR issues)

As a developer,
I want all React component prop interfaces to declare their properties as `readonly`,
So that props are protected from accidental mutation inside components, TypeScript strict mode is fully leveraged, and all 72 S6759 violations are cleared.

**Affected rules:** `typescript:S6759` (React component props should be read-only, 72 MINOR)

**Affected files:** `frontend/src/components/resume/ResumeCanvas.tsx` and all section renderer components, plus any page or component flagged by SonarQube (systematic pass required)

**Acceptance Criteria:**

**Given** a React component defines a props interface (e.g., `interface Props { ... }` or `type Props = { ... }`) without `readonly` modifiers on its properties (S6759)
**When** the fix is applied
**Then** every property in the interface is prefixed with `readonly`, or the interface is replaced with `Readonly<{ ... }>`; components that already use `React.FC<Props>` are unchanged beyond the interface update

**Given** a component's props include array or object-typed fields
**When** `readonly` is added
**Then** array fields are typed as `readonly T[]` or `ReadonlyArray<T>` and object fields use `Readonly<T>` recursively where the component does not mutate them; no `as Mutable<T>` escape hatches are introduced

**Given** the props change touches shared interfaces imported by multiple components
**When** the fix propagates
**Then** all consuming components compile without type errors; no runtime behaviour changes

**Given** the story is implemented
**When** TypeScript strict-mode compilation and all tests run
**Then** 0 type errors are introduced; all tests pass; SonarQube re-scan shows 0 remaining S6759 violations across the entire frontend

---

## Epic Summary

| Story | Title | Issues | Max Severity |
|-------|-------|--------|--------------|
| 9.1 | TypeScript Cognitive Complexity & Void Operator | 11 | CRITICAL |
| 9.2 | Java String Constants & Empty Test Method | 7 | CRITICAL |
| 9.3 | Accessibility & ARIA Compliance | 35 | MAJOR |
| 9.4 | Java Backend Code Quality — LlmSectionExtractor | 15 | MAJOR |
| 9.5 | Duplicate & Redundant Code | 8 | MAJOR |
| 9.6 | Configuration — Content Length & ProfileService | 3 | MAJOR |
| 9.7 | Type Safety & Deprecated APIs | 29 | MINOR |
| 9.8 | Java Test Quality — Time Constants & Clock | 25 | MINOR |
| 9.9 | Code Style — Simplified Conditionals & Idioms | 37 | MINOR |
| 9.10 | Replace window/global with globalThis | 11 | MINOR |
| 9.11 | Read-Only Component Props | 72 | MINOR |
| **Total** | | **253** | |

> Two issues (configuration/architecture INFO items) are addressed within Story 9.6; all 255 reported issues are covered across the 11 stories.
