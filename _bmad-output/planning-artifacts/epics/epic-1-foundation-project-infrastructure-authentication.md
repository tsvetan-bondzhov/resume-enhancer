# Epic 1: Foundation — Project Infrastructure & Authentication

Users can register, sign in, sign out, and access a secured application that runs end-to-end via Docker Compose. All project wiring is complete: missing `pom.xml` dependencies added, frontend scaffolded with shadcn/ui + Vite, design token foundation established, routing with protected routes, JWT filter chain, and Spring Security configured.

### Story 1.1: Project Dependencies & Backend Wiring

As a developer,
I want all required backend dependencies added to `pom.xml` and the Spring Boot application configured to start cleanly with Docker Compose services,
So that subsequent stories have a working, compilable foundation to build on.

**Acceptance Criteria:**

**Given** the project skeleton exists with Spring Boot 4.0.6 and Spring AI 2.0.0-M6
**When** `./mvnw spring-boot:run` is executed with `docker compose up` running
**Then** the application starts without errors and connects to PostgreSQL and Ollama

**Given** the `pom.xml` is updated
**When** the build compiles
**Then** `spring-boot-starter-security`, `jjwt-api/impl/jackson` (0.12.x), `poi-ooxml`, `pdfbox`, `itext7-core`, `springdoc-openapi-starter-webmvc-ui` 3.0.3, Caffeine, and `frontend-maven-plugin` are all present with explicit versions

**Given** Spring AI dependencies are declared
**When** any Spring AI artifact version is checked
**Then** all Spring AI artifact versions are pinned explicitly in `pom.xml` properties — no BOM-only version resolution

**Given** the application starts in the `dev` profile
**When** `/swagger-ui.html` is accessed
**Then** the Swagger UI is accessible; when started in `prod` profile, it returns 404

### Story 1.2: Frontend Scaffold & Design Token Foundation

As a developer,
I want the React/TypeScript frontend scaffolded with shadcn/ui, Vite, Tailwind CSS, and the design token foundation configured,
So that all frontend stories have a consistent visual foundation and component library to build on.

**Acceptance Criteria:**

**Given** `npx shadcn@latest init -t vite` has been run in the `frontend/` directory
**When** `cd frontend && npm run dev` is executed
**Then** the Vite dev server starts on `:5173` and the default app renders without errors

**Given** the frontend scaffold is complete
**When** the Tailwind config is inspected
**Then** the design token foundation is configured: primary accent `blue-600`, neutral palette `zinc/slate`, border radius `md`, `Inter` font family

**Given** shadcn/ui components are installed
**When** the component list is checked
**Then** `button`, `input`, `textarea`, `dialog`, `sheet`, `toast`, `tabs`, `badge`, `collapsible`, `checkbox`, `skeleton` are all present under `frontend/src/components/ui/`

**Given** Zustand and React Router are installed
**When** `frontend/package.json` is inspected
**Then** `react-router-dom` and `zustand` are listed as dependencies

**Given** the Vite config is set up
**When** a request to `/api/**` is made from the dev server
**Then** it is proxied to `http://localhost:8080`

**Given** Vitest is configured
**When** `npm run test` is executed
**Then** the test runner starts and exits cleanly with 0 failures (no tests yet, but the runner is wired)

**Given** the `@/` path alias is configured
**When** a TypeScript file uses `import { x } from '@/components/...'`
**Then** TypeScript and Vite both resolve the alias without errors

### Story 1.3: User Registration

As an unregistered user,
I want to create an account with my email address and password,
So that I can access the Resume Enhancer application.

**Acceptance Criteria:**

**Given** a user submits a valid email and password to `POST /api/v1/auth/signup`
**When** the request is processed
**Then** a new user account is created, the password is stored as a bcrypt hash, and a JWT token is returned in the response body

**Given** a user submits an email that already exists
**When** the signup request is processed
**Then** the system returns HTTP 409 with a `ProblemDetail` body explaining the conflict

**Given** a user submits an invalid email format or a blank password
**When** the signup request is processed
**Then** the system returns HTTP 400 with a `ProblemDetail` body listing the validation errors

**Given** a new user successfully registers via the `/signup` page
**When** registration completes
**Then** the user is redirected to the dashboard and their JWT token is stored in `useAuthStore` (Zustand, not localStorage)

**Given** the signup page is accessed
**When** it renders
**Then** it is accessible at `/signup`, requires no authentication, and has correct form labels and keyboard navigation (NFR19)

### Story 1.4: User Sign-In & Sign-Out

As a registered user,
I want to sign in with my email and password and sign out when I'm done,
So that my account is secure and my session is controlled.

**Acceptance Criteria:**

**Given** a registered user submits valid credentials to `POST /api/v1/auth/login`
**When** the request is processed
**Then** a JWT token is returned; the token has a 1-hour TTL (configurable via `app.jwt.expiration-ms`)

**Given** a user submits incorrect credentials
**When** the login request is processed
**Then** HTTP 401 is returned with a `ProblemDetail` body; no token is issued

**Given** a logged-in user clicks Sign Out
**When** sign-out completes
**Then** the JWT token is cleared from `useAuthStore`, the user is redirected to `/login`, and subsequent API requests using the old token receive HTTP 401

**Given** a request is made to any protected endpoint without a JWT token
**When** the JWT filter processes the request
**Then** HTTP 401 is returned with a `ProblemDetail` body

**Given** a request is made with an expired or malformed JWT
**When** the JWT filter processes the request
**Then** HTTP 401 is returned (NFR4/NFR8 satisfied)

**Given** a signed-in user navigates to `/login` directly
**When** the route is evaluated
**Then** they are redirected to the dashboard (already authenticated)

### Story 1.5: Protected Routes & Application Shell

As an authenticated user,
I want all application routes to require authentication and have a consistent navigation shell,
So that the application is secure and easy to navigate.

**Acceptance Criteria:**

**Given** an unauthenticated user attempts to navigate to any route except `/login` or `/signup`
**When** the router evaluates the route
**Then** the user is redirected to `/login`

**Given** the router configuration is inspected
**When** routes are listed
**Then** `/login` and `/signup` are public; `/`, `/resumes/:id`, `/profile`, and `/admin` are protected by `ProtectedRoute`

**Given** an authenticated user with `USER` role attempts to access `/admin`
**When** the route is evaluated
**Then** they are redirected to the dashboard (role-gated at route level)

**Given** an authenticated user is on any protected page
**When** the page renders
**Then** a consistent `AppShell` navigation is visible with links to Dashboard, Profile, and (if ADMIN) Admin panel

**Given** the application is viewed on a screen narrower than 768px
**When** the layout renders
**Then** the responsive base breakpoints are applied per UX-DR16 (no broken layouts below tablet width)

---
