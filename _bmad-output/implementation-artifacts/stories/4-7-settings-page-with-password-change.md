# Story 4.7: Settings Page with Password Change

**Status:** backlog
**Epic:** 4 — Resume Experience Polish & Foundations
**Story Key:** 4-7-settings-page-with-password-change
**Dependencies:** Story 1.4 (done), Story 1.5 (done)

---

## Story

As an authenticated user,
I want a dedicated settings page where I can change my password,
So that I can manage my account security without contacting support.

---

## Acceptance Criteria

**AC1 — Settings route and navigation**
**Given** an authenticated user is using the application
**When** they look at the AppShell header navigation
**Then** a "Settings" `<NavLink>` is present and navigates to `/settings`; the `/settings` route is protected (redirects to `/login` if unauthenticated); `SettingsPage` renders within `AppShell`

**AC2 — SettingsPage layout**
**Given** the user navigates to `/settings`
**When** `SettingsPage` renders
**Then** the page shows a heading "Settings" and contains at least one `<Card>` component (from `@/components/ui/card`) with title "Security" housing the password change form; the card-based layout allows future setting categories to be added as additional `<Card>` elements

**AC3 — Password change form fields**
**Given** the Settings page is open
**When** the Security card is visible
**Then** the form contains three `<input type="password">` fields labeled "Current password", "New password", and "Confirm new password"; a "Change Password" submit button is present

**AC4 — Client-side validation: passwords must match**
**Given** the user fills in the form
**When** "New password" and "Confirm new password" values differ
**Then** an inline error message "Passwords do not match" is shown beneath the "Confirm new password" field; no API call is made; the error clears when the two fields are brought into agreement

**AC5 — Backend endpoint**
**Given** an authenticated user sends `PUT /api/v1/users/me/password`
**When** the request body is `{ "currentPassword": "...", "newPassword": "..." }` with a valid JWT
**Then** the endpoint is handled by a new `UserController` in the `auth` package (or added to `AuthController`); the endpoint does not require `@PreAuthorize` — JWT filter authentication is sufficient; `SecurityConfig` permits all `/api/v1/users/**` paths for authenticated requests

**AC6 — Backend validation and error responses**
**Given** the endpoint is called
**When** the current password is wrong
**Then** HTTP 400 is returned with `ProblemDetail` `detail: "Current password is incorrect"`
**When** the new password is shorter than 8 characters
**Then** HTTP 400 is returned with standard Spring validation `ProblemDetail` (from `@Size(min=8)` on `newPassword`)

**AC7 — Password update logic**
**Given** the request passes validation
**When** `UserService.changePassword()` is called
**Then** `BCryptPasswordEncoder.matches(currentPassword, user.getPasswordHash())` is called to verify the current password; if it returns `false`, a custom `InvalidCurrentPasswordException` (or similar) is thrown and mapped to HTTP 400 by `GlobalExceptionHandler`; if it matches, `user.setPasswordHash(encoder.encode(newPassword))` is called and the user is saved; the endpoint returns HTTP 204 No Content on success

**AC8 — Success UX**
**Given** the API returns 204
**When** `SettingsPage` receives the response
**Then** a toast notification "Password changed successfully" is shown (via `toast.success` from `sonner`); all three form fields are reset to empty strings

**AC9 — Tests**
**Given** the story is implemented
**When** tests run
**Then**:
- `UserServiceTest.java`: correct current password → user's passwordHash is updated; wrong current password → `InvalidCurrentPasswordException` thrown; new password length < 8 → Spring validation exception
- `SettingsPage.test.tsx`: mismatch between new/confirm passwords shows error and no API call; successful form submit calls `PUT /api/v1/users/me/password` and shows toast "Password changed successfully"

---

## Tasks / Subtasks

### Task 1: Backend — `ChangePasswordRequest` DTO (AC: 5, 6)

- [ ] Create `src/main/java/com/tsvetanbondzhov/resumeenhancer/auth/dto/ChangePasswordRequest.java`:
  ```java
  package com.tsvetanbondzhov.resumeenhancer.auth.dto;

  import jakarta.validation.constraints.NotBlank;
  import jakarta.validation.constraints.Size;

  public record ChangePasswordRequest(
          @NotBlank String currentPassword,
          @NotBlank @Size(min = 8, message = "New password must be at least 8 characters") String newPassword
  ) {}
  ```

### Task 2: Backend — `InvalidCurrentPasswordException` (AC: 6, 7)

- [ ] Create `src/main/java/com/tsvetanbondzhov/resumeenhancer/auth/InvalidCurrentPasswordException.java`:
  ```java
  package com.tsvetanbondzhov.resumeenhancer.auth;

  public class InvalidCurrentPasswordException extends RuntimeException {
      public InvalidCurrentPasswordException() {
          super("Current password is incorrect");
      }
  }
  ```
- [ ] Add a handler for `InvalidCurrentPasswordException` in `GlobalExceptionHandler`:
  ```java
  @ExceptionHandler(InvalidCurrentPasswordException.class)
  public ProblemDetail handleInvalidCurrentPassword(InvalidCurrentPasswordException ex) {
      ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, ex.getMessage());
      problem.setTitle("Bad Request");
      return problem;
  }
  ```
  Find `GlobalExceptionHandler` at `src/main/java/com/tsvetanbondzhov/resumeenhancer/common/GlobalExceptionHandler.java` (or equivalent location — verify with a glob search before editing)

### Task 3: Backend — `UserService` (AC: 7)

- [ ] Create `src/main/java/com/tsvetanbondzhov/resumeenhancer/auth/UserService.java`:
  ```java
  package com.tsvetanbondzhov.resumeenhancer.auth;

  import com.tsvetanbondzhov.resumeenhancer.auth.domain.User;
  import org.springframework.security.crypto.password.PasswordEncoder;
  import org.springframework.stereotype.Service;
  import org.springframework.transaction.annotation.Transactional;

  @Service
  public class UserService {

      private final UserRepository userRepository;
      private final PasswordEncoder passwordEncoder;

      public UserService(UserRepository userRepository, PasswordEncoder passwordEncoder) {
          this.userRepository = userRepository;
          this.passwordEncoder = passwordEncoder;
      }

      @Transactional
      public void changePassword(User user, String currentPassword, String newPassword) {
          if (!passwordEncoder.matches(currentPassword, user.getPasswordHash())) {
              throw new InvalidCurrentPasswordException();
          }
          user.setPasswordHash(passwordEncoder.encode(newPassword));
          userRepository.save(user);
      }
  }
  ```

### Task 4: Backend — `UserController` (AC: 5, 7)

- [ ] Create `src/main/java/com/tsvetanbondzhov/resumeenhancer/auth/UserController.java`:
  ```java
  package com.tsvetanbondzhov.resumeenhancer.auth;

  import com.tsvetanbondzhov.resumeenhancer.auth.domain.User;
  import com.tsvetanbondzhov.resumeenhancer.auth.dto.ChangePasswordRequest;
  import io.swagger.v3.oas.annotations.tags.Tag;
  import jakarta.validation.Valid;
  import org.springframework.http.ResponseEntity;
  import org.springframework.security.core.annotation.AuthenticationPrincipal;
  import org.springframework.web.bind.annotation.PutMapping;
  import org.springframework.web.bind.annotation.RequestBody;
  import org.springframework.web.bind.annotation.RequestMapping;
  import org.springframework.web.bind.annotation.RestController;

  @RestController
  @RequestMapping("/api/v1/users")
  @Tag(name = "Users")
  public class UserController {

      private final UserService userService;

      public UserController(UserService userService) {
          this.userService = userService;
      }

      @PutMapping("/me/password")
      public ResponseEntity<Void> changePassword(
              @AuthenticationPrincipal User user,
              @Valid @RequestBody ChangePasswordRequest request
      ) {
          userService.changePassword(user, request.currentPassword(), request.newPassword());
          return ResponseEntity.noContent().build();
      }
  }
  ```
  Note: `@AuthenticationPrincipal User user` works because `JwtAuthenticationFilter` sets the `Authentication` principal as the `User` entity. Verify the filter's `UsernamePasswordAuthenticationToken` principal type before relying on this — if it stores a `String` (email) instead of `User`, load the user from `UserRepository` using the principal email.

### Task 5: Backend — Update `SecurityConfig` (AC: 5)

- [ ] Open `src/main/java/com/tsvetanbondzhov/resumeenhancer/config/SecurityConfig.java`
- [ ] The current config uses `.anyRequest().authenticated()` which already secures `/api/v1/users/**` — no explicit `requestMatchers` entry is needed since the catch-all covers it
- [ ] No change required to `SecurityConfig.java` unless the endpoint returns 403 in tests — in that case add:
  ```java
  .requestMatchers("/api/v1/users/**").authenticated()
  ```
  before the `.anyRequest().authenticated()` line (though it is redundant with the catch-all)

### Task 6: Backend — `UserServiceTest.java` (AC: 9)

- [ ] Create `src/test/java/com/tsvetanbondzhov/resumeenhancer/auth/UserServiceTest.java`:
  ```java
  @ExtendWith(MockitoExtension.class)
  class UserServiceTest {

      @Mock UserRepository userRepository;
      @Mock PasswordEncoder passwordEncoder;

      @InjectMocks UserService userService;

      @Test
      void changePassword_correctCurrentPassword_updatesHash() {
          User user = new User();
          user.setPasswordHash("$2a$10$old-hash");
          when(passwordEncoder.matches("oldpass", "$2a$10$old-hash")).thenReturn(true);
          when(passwordEncoder.encode("newpass123")).thenReturn("$2a$10$new-hash");

          userService.changePassword(user, "oldpass", "newpass123");

          assertThat(user.getPasswordHash()).isEqualTo("$2a$10$new-hash");
          verify(userRepository).save(user);
      }

      @Test
      void changePassword_wrongCurrentPassword_throwsException() {
          User user = new User();
          user.setPasswordHash("$2a$10$old-hash");
          when(passwordEncoder.matches("wrongpass", "$2a$10$old-hash")).thenReturn(false);

          assertThatThrownBy(() -> userService.changePassword(user, "wrongpass", "newpass123"))
                  .isInstanceOf(InvalidCurrentPasswordException.class);
          verify(userRepository, never()).save(any());
      }
  }
  ```
  Note: `@Size(min=8)` validation is enforced by Spring at the controller layer (Bean Validation), not in `UserService` — no unit test needed for that in `UserServiceTest`. Controller-layer validation is covered by integration tests if they exist, otherwise accepted as Spring Boot default behaviour.

### Task 7: Frontend — `SettingsPage.tsx` (AC: 2, 3, 4, 8)

- [ ] Create `frontend/src/pages/SettingsPage.tsx`:
  ```tsx
  import { useState } from "react"
  import { toast } from "sonner"
  import { apiClient } from "@/lib/apiClient"
  import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
  import { Input } from "@/components/ui/input"
  import { Button } from "@/components/ui/button"

  export default function SettingsPage() {
    const [currentPassword, setCurrentPassword] = useState("")
    const [newPassword, setNewPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [confirmError, setConfirmError] = useState<string | null>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)

    async function handleChangePassword(e: React.FormEvent) {
      e.preventDefault()
      if (newPassword !== confirmPassword) {
        setConfirmError("Passwords do not match")
        return
      }
      setConfirmError(null)
      setIsSubmitting(true)
      try {
        await apiClient.put("/api/v1/users/me/password", {
          currentPassword,
          newPassword,
        })
        toast.success("Password changed successfully")
        setCurrentPassword("")
        setNewPassword("")
        setConfirmPassword("")
      } catch {
        toast.error("Failed to change password — please try again")
      } finally {
        setIsSubmitting(false)
      }
    }

    return (
      <div className="mx-auto max-w-2xl p-6 space-y-6">
        <h1 className="text-2xl font-semibold">Settings</h1>

        <Card>
          <CardHeader>
            <CardTitle>Security</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="currentPassword" className="text-sm font-medium">
                  Current password
                </label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="newPassword" className="text-sm font-medium">
                  New password
                </label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="confirmPassword" className="text-sm font-medium">
                  Confirm new password
                </label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value)
                    if (confirmError) setConfirmError(null)
                  }}
                  autoComplete="new-password"
                />
                {confirmError && (
                  <p className="text-sm text-red-600" role="alert">{confirmError}</p>
                )}
              </div>

              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Change Password"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }
  ```
- [ ] Check that `@/components/ui/card` exists; if the `Card` component is not yet in `frontend/src/components/ui/card.tsx`, add it via shadcn/ui: `npx shadcn@latest add card` (from `frontend/` directory)

### Task 8: Frontend — Register `/settings` route and nav link (AC: 1)

- [ ] Open `frontend/src/router/index.tsx`
- [ ] Import `SettingsPage`: `import SettingsPage from "@/pages/SettingsPage"`
- [ ] Add route inside the `ProtectedRoute` children array:
  ```tsx
  {
    path: "/settings",
    element: <SettingsPage />,
  },
  ```
- [ ] Open `frontend/src/components/layout/AppShell.tsx`
- [ ] Add a `<NavLink to="/settings">` in the nav alongside Dashboard and Profile:
  ```tsx
  <NavLink
    to="/settings"
    className={({ isActive }) =>
      isActive
        ? "text-sm font-medium text-blue-600"
        : "text-sm text-zinc-600 hover:text-zinc-900"
    }
  >
    Settings
  </NavLink>
  ```

### Task 9: Frontend — `SettingsPage.test.tsx` (AC: 9)

- [ ] Create `frontend/src/pages/SettingsPage.test.tsx`:
  ```tsx
  import { describe, it, expect, vi, beforeEach } from "vitest"
  import { render, screen, waitFor } from "@testing-library/react"
  import userEvent from "@testing-library/user-event"
  import SettingsPage from "./SettingsPage"

  vi.mock("@/lib/apiClient", () => ({
    apiClient: {
      put: vi.fn(),
    },
  }))
  vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

  import { apiClient } from "@/lib/apiClient"
  import { toast } from "sonner"

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("shows mismatch error and makes no API call when passwords differ", async () => {
    render(<SettingsPage />)
    await userEvent.type(screen.getByLabelText(/Current password/i), "myoldpass")
    await userEvent.type(screen.getByLabelText(/^New password/i), "newpass123")
    await userEvent.type(screen.getByLabelText(/Confirm new password/i), "different123")
    await userEvent.click(screen.getByRole("button", { name: /Change Password/i }))
    expect(screen.getByRole("alert")).toHaveTextContent("Passwords do not match")
    expect(apiClient.put).not.toHaveBeenCalled()
  })

  it("calls API and shows success toast on valid submission", async () => {
    vi.mocked(apiClient.put).mockResolvedValueOnce(undefined)
    render(<SettingsPage />)
    await userEvent.type(screen.getByLabelText(/Current password/i), "myoldpass")
    await userEvent.type(screen.getByLabelText(/^New password/i), "newpass123")
    await userEvent.type(screen.getByLabelText(/Confirm new password/i), "newpass123")
    await userEvent.click(screen.getByRole("button", { name: /Change Password/i }))
    await waitFor(() => {
      expect(apiClient.put).toHaveBeenCalledWith(
        "/api/v1/users/me/password",
        { currentPassword: "myoldpass", newPassword: "newpass123" }
      )
      expect(toast.success).toHaveBeenCalledWith("Password changed successfully")
    })
  })
  ```

---

## Developer Context & Guardrails

### Files to Modify (UPDATE)

| File | Change |
|------|--------|
| `frontend/src/router/index.tsx` | Add `/settings` route inside ProtectedRoute children |
| `frontend/src/components/layout/AppShell.tsx` | Add Settings NavLink in header nav |
| `src/main/java/com/tsvetanbondzhov/resumeenhancer/common/GlobalExceptionHandler.java` | Add handler for `InvalidCurrentPasswordException` |
| `src/main/java/com/tsvetanbondzhov/resumeenhancer/config/SecurityConfig.java` | Add `/api/v1/users/**` matcher if `.anyRequest().authenticated()` is insufficient (likely no change needed) |

### Files to Create (NEW)

| File | Notes |
|------|-------|
| `frontend/src/pages/SettingsPage.tsx` | Settings page with Security card + password change form |
| `frontend/src/pages/SettingsPage.test.tsx` | Vitest + RTL tests |
| `src/main/java/com/tsvetanbondzhov/resumeenhancer/auth/dto/ChangePasswordRequest.java` | Validation record |
| `src/main/java/com/tsvetanbondzhov/resumeenhancer/auth/InvalidCurrentPasswordException.java` | Custom exception |
| `src/main/java/com/tsvetanbondzhov/resumeenhancer/auth/UserService.java` | Password change logic |
| `src/main/java/com/tsvetanbondzhov/resumeenhancer/auth/UserController.java` | `PUT /api/v1/users/me/password` endpoint |
| `src/test/java/com/tsvetanbondzhov/resumeenhancer/auth/UserServiceTest.java` | Unit tests for UserService |

### No Flyway Migration

No database schema change required. `passwordHash` column already exists on the `users` table (see `V1__create_users_table.sql`). This story only adds a runtime code path to update that column.

---

## Critical Implementation Details

### `@AuthenticationPrincipal` Principal Type — Must Verify Before Using

`JwtAuthenticationFilter` sets the `Authentication` principal during JWT validation. Inspect `JwtAuthenticationFilter.java` to confirm what object is set as the principal:

- If it sets `new UsernamePasswordAuthenticationToken(user, null, authorities)` where `user` is a `User` entity: `@AuthenticationPrincipal User user` works directly
- If it sets the email string as principal: inject `UserRepository` into `UserController` and load the user:
  ```java
  @AuthenticationPrincipal String email,
  // then:
  User user = userRepository.findByEmail(email).orElseThrow();
  ```

Read `JwtAuthenticationFilter.java` at task start to determine which pattern applies.

### `GlobalExceptionHandler` Location

Find the handler with:
```
Glob: src/main/java/com/tsvetanbondzhov/resumeenhancer/**/*GlobalException*.java
```
The handler file may be in `common/` or `config/` package. Add `InvalidCurrentPasswordException` handler alongside the existing `InvalidCredentialsException` handler pattern.

### `Card` Component Availability

`frontend/src/components/ui/card.tsx` may not exist yet (it was not in the glob results). If absent, run `npx shadcn@latest add card` from the `frontend/` directory before writing `SettingsPage.tsx`. Do NOT create the card component file manually — use the shadcn CLI to ensure it matches the project's theme configuration.

### `apiClient.put` Return Type

`apiClient.put<void>(url, body)` returns `Promise<void>` on a 204 response. The existing `apiClient.ts` handles 204 by returning `undefined`. Confirm the client does not throw on 204 before testing.

### SecurityConfig — `.anyRequest().authenticated()` Already Covers `/api/v1/users/**`

The current `SecurityConfig.filterChain` has:
```java
.authorizeHttpRequests(auth -> auth
    .requestMatchers(HttpMethod.POST, "/api/v1/auth/signup").permitAll()
    .requestMatchers(HttpMethod.POST, "/api/v1/auth/login").permitAll()
    .requestMatchers("/swagger-ui/**", "/v3/api-docs/**").permitAll()
    .anyRequest().authenticated()
)
```
The `.anyRequest().authenticated()` catch-all already requires authentication for `/api/v1/users/**`. No explicit matchers need to be added unless Spring Security version or configuration causes issues.

---

## Dev Notes

A new `UserService` is created rather than extending `AuthService` to keep concerns separate: `AuthService` handles token-based login/signup (stateless session establishment), while `UserService` handles user account management (password change, future profile settings). Both live in the `auth` package.

The frontend `SettingsPage` uses component-local `useState` — no Zustand store is needed because password change state is purely transient (entered, submitted, and cleared; never shared across components).

The `Card` shadcn component is used from the start (even though there is only one card) to establish the extensible layout pattern described in AC2. A future "Notifications" or "Account" card can be added below the Security card with no structural refactoring.

---

## File List

### To Create
- `frontend/src/pages/SettingsPage.tsx`
- `frontend/src/pages/SettingsPage.test.tsx`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/auth/dto/ChangePasswordRequest.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/auth/InvalidCurrentPasswordException.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/auth/UserService.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/auth/UserController.java`
- `src/test/java/com/tsvetanbondzhov/resumeenhancer/auth/UserServiceTest.java`

### To Modify
- `frontend/src/router/index.tsx`
- `frontend/src/components/layout/AppShell.tsx`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/common/GlobalExceptionHandler.java` (or wherever GlobalExceptionHandler lives)
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/config/SecurityConfig.java` (verify first — likely no change needed)

---

## Change Log
- 2026-06-10: Story created
