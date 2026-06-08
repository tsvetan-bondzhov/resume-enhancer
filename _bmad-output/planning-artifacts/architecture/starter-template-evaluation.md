# Starter Template Evaluation

### Primary Technology Domain

Full-stack web application: Java/Spring Boot backend (existing skeleton) + React SPA frontend (to be scaffolded).

### Backend

No starter needed. Spring Boot 4.0.6 skeleton already initialized at project root with:
- Spring AI 2.0.0-M6 (Ollama), Flyway, Spring Data JPA, PostgreSQL, Lombok, OpenTelemetry, Testcontainers

**Additions required (not yet in pom.xml):**
- `spring-boot-starter-security`
- `jjwt-api` + `jjwt-impl` + `jjwt-jackson` (io.jsonwebtoken, latest 0.12.x)
- `poi-ooxml` (Apache POI — DOCX parsing/export)
- `pdfbox` (Apache PDFBox — PDF parsing)
- `itext7-core` (iText 7 Community) or OpenPDF for PDF generation/export

### Frontend Starter: shadcn/ui CLI (Vite template)

**Rationale:** Single command scaffolds the exact stack from the PRD and UX spec — Vite + React 18 + TypeScript + Tailwind CSS v4 + shadcn/ui — with path aliases and config pre-wired. Officially maintained by the shadcn/ui team. No manual wiring.

**Initialization Command:**

```bash
# From project root — creates frontend/ subdirectory
npx shadcn@latest init -t vite
# When prompted: project name → "frontend", base color → Zinc (matches UX spec)
```

**Post-init additions:**
```bash
cd frontend
npm install react-router-dom zustand
npx shadcn@latest add button input textarea dialog sheet toast tabs badge
```

**Architectural Decisions Provided by Starter:**

- **Language & Runtime:** TypeScript strict mode, React 18, Node via Vite dev server
- **Styling Solution:** Tailwind CSS v4 via `@tailwindcss/vite` plugin; CSS variable design tokens auto-configured
- **Build Tooling:** Vite with `@vitejs/plugin-react`; production build outputs to `dist/`
- **Component Library:** shadcn/ui on Radix UI primitives — WCAG 2.1 AA keyboard/focus handling built in
- **Code Organization:** `src/components/ui/` for shadcn components; custom components alongside using same token layer
- **Path Aliases:** `@/` → `src/` pre-configured in `tsconfig.json` and `vite.config.ts`
- **Development Experience:** HMR, TypeScript checking, ESLint pre-configured

**Additional Frontend Decisions (not from starter, decided here):**
- **Routing:** React Router v6 (`react-router-dom`) — client-side SPA routing for `/`, `/resumes/:id`, `/profile`, `/admin`
- **State Management:** Zustand — lightweight, no boilerplate, sufficient for resume/chat/profile state at this scale
- **SSE Client:** Native browser `EventSource` API — no library needed for one-directional server→client streaming
- **API Client:** Native `fetch` with a thin typed wrapper — no Axios needed; keep bundle lean

**Note:** Project initialization using this command should be one of the first implementation stories (frontend setup epic).
