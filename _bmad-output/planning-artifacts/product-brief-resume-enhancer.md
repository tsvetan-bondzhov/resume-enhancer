---
title: "Product Brief: Resume Enhancer"
status: "complete"
created: "2026-05-13"
updated: "2026-05-13"
inputs: ["docs/IdeaDraft.md"]
---

# Product Brief: Resume Enhancer

## Executive Summary

Job seekers today don't just need a good resume — they need the *right* resume for every role they apply to. With AI-powered applicant tracking systems (ATS) screening candidates before any human reads their CV, a generic resume is functionally invisible. The modern job hunt demands targeted, tailored applications at scale — a task that is exhausting, error-prone, and deeply discouraging when done manually. A 2025 survey found 57% of applicants abandon applications mid-process due to the effort involved.

Resume Enhancer is an AI-driven web application built on a simple but powerful insight: **write your career story once, then tailor it to any job in seconds.** Users build a persistent experience profile, select a template, and paste a job description — the AI rewrites their resume using their own words and achievements, optimized for that specific role. A conversational AI assistant guides every step, and the result exports as a polished PDF or DOCX.

Built as a full-stack portfolio project on Spring Boot and Spring AI — a framework at the frontier of enterprise Java AI integration, reaching general availability in 2024 — Resume Enhancer demonstrates production-grade engineering at every layer: Ollama for zero-cost local LLM inference, JWT authentication, Spring Security, OpenTelemetry distributed tracing, Grafana dashboards, Testcontainers integration testing against a live PostgreSQL instance, and a React/TypeScript/Tailwind frontend. It is fully self-hostable via Docker Compose, with no external API dependencies in v1.

## The Problem

Tailoring a resume to a specific job description is the single most impactful thing a candidate can do to improve their chances — and widely acknowledged as the most painful part of the job search. ATS software, used by 83% of companies by 2025, filters on keyword matching before any human review. To pass screening, every application needs to reflect the specific language and priorities of that role. Doing this thoughtfully for dozens of applications per week is a significant cognitive burden.

Current tools address this only partially:

- **Pure builders** (Kickresume, Zety) help create polished documents but produce generic, template-driven output that doesn't adapt to individual roles.
- **Pure ATS analyzers** (Jobscan, $50/month) score keyword alignment but don't help users improve their content — they tell you what's wrong, not how to fix it.
- **Tailoring-focused tools** (Reztune, TailoredCV) optimize existing resumes against a job description but provide no integrated creation or profile management workflow.

No mainstream open-source solution exists. Every tool in the space is cloud-only, sending user career data to external LLM providers.

## The Solution

Resume Enhancer handles the entire workflow in one place:

1. **Persistent experience profile** — Users enter their experience, education, and skills once. This profile persists, can be edited at any time, and serves as the foundation for every resume they create. The value compounds with each new application.
2. **Upload & parse** — Users who already have a resume upload a PDF or DOCX. The application extracts structured data automatically, populating the profile without manual re-entry.
3. **Template selection** — Choose from a library of prebuilt templates or manage custom ones. Templates use clean, single-column layouts with semantic structure to ensure reliable ATS parsing — no skill bars, graphics, or complex multi-column designs that confuse automated screening software.
4. **AI enhancement** — The AI reviews the assembled resume, suggests targeted improvements for impact and clarity, and asks follow-up questions when it needs more context to help.
5. **Job tailoring** — Paste a job description. The AI rewrites and restructures resume content to align with the role's priorities, language, and keywords — using the user's own words and real achievements.
6. **Conversational AI** — A persistent chat panel lets users request specific changes, ask for rationale, or explore alternatives in natural language at any step. Chat messages translate directly into document edits — the AI updates the resume in response and explains what it changed.
7. **Export & manage** — Export finished resumes as PDF or DOCX. Save, clone, and version resumes for different roles or iterations.

## What Makes This Different

**Full lifecycle, one tool.** Competitors specialize in either creation or optimization. Resume Enhancer covers the entire journey — from raw career data to a tailored, exported document — removing the friction of juggling multiple tools and transferring data between them.

**Write once, tailor infinitely.** The persistent experience profile is the core insight: a user's career history lives in the application. Every subsequent job application requires only selecting a template and pasting a job description — the AI handles the rest. Value compounds with every new application.

**Conversational experience.** Rather than a rigid form-fill workflow, users interact with the AI at every step — requesting specific rewrites, asking for reasoning, or steering the output in natural language. This mirrors how people actually think about their careers.

**Spring AI on the JVM.** Built on Spring AI (GA 1.0, 2024) — the primary framework for AI integration in the enterprise Java ecosystem — Resume Enhancer demonstrates an architecture pattern Java engineering teams are actively hiring for. The application uses Ollama for local LLM inference: zero external API cost during development and demonstration, no user data sent to third-party LLM providers. The abstraction layer is designed for future multi-model support — OpenAI, Anthropic, or user-provided endpoints — without rewriting application logic. Note: local LLM quality is meaningfully below frontier cloud models; the trade-off is cost and privacy over peak output quality.

**Production engineering standards.** Full OpenTelemetry tracing and Grafana dashboards, Testcontainers integration tests against a real PostgreSQL instance, and Docker Compose orchestration across four services set this apart from typical portfolio projects.

## Who This Serves

**Primary users — Job seekers at any career stage.** Recent graduates building their first professional resume, mid-career professionals pivoting to new roles, and experienced candidates applying to competitive positions all share the same frustration: the gap between having strong experience and getting that experience noticed. Resume Enhancer meets users wherever they are — with or without an existing resume, regardless of industry.

The **"aha moment"** arrives when a user pastes a job description and sees their resume rewritten — in seconds — using their own words and real achievements, reshaped to match exactly what the employer is looking for. For the first time, tailoring feels effortless.

**Secondary users — Administrators.** Administrators manage user accounts and the shared template library, ensuring template quality and system health.

## Success Criteria

**As a portfolio project, success operates on two dimensions:**

*Technical depth:*
- End-to-end working implementation across the full stack: Spring Boot, Spring AI, Ollama, PostgreSQL, JWT, Spring Security, React/TypeScript, Tailwind CSS, Docker Compose, and OpenTelemetry
- Unit test coverage via JUnit and Mockito; integration test coverage via Testcontainers
- Observable system with distributed tracing and Grafana dashboards — demonstrating production-readiness beyond tutorial quality

*Product utility:*
- A user can create or upload a resume, receive AI-generated enhancements, tailor it to a job description via both the UI workflow and chat, and export a finished document — end to end
- AI suggestions are coherent, contextually relevant, and grounded in the user's actual experience
- Template output is ATS-compatible and visually professional

## Scope (Version 1)

**In scope:**
- User authentication (sign up / sign in via JWT, Spring Security)
- Persistent experience profile (experience, education, skills — editable at any time)
- Resume management (create, clone, upload, download, delete, view, name and save)
- Resume parsing from PDF/DOCX upload
- Template management (prebuilt library + user-created templates)
- AI enhancement (AI-suggested improvements with follow-up questions)
- Job description tailoring (AI rewrites resume against provided JD)
- Conversational AI chat interface
- Show/hide resume sections
- PDF and DOCX export
- Admin panel (user management, template management)
- Containerized deployment via Docker Compose (app, PostgreSQL, Ollama, Grafana)
- Full observability (OpenTelemetry, Grafana)

**Out of scope for v1:**
- Multiple LLM provider selection (Ollama only; planned for v2)
- Cover letter generation
- ATS match score / keyword gap visualization
- Job board integrations or browser extensions
- LinkedIn profile import
- Mobile native applications
- Team or organizational accounts

## Vision

If Resume Enhancer succeeds as a portfolio demonstrator, the natural evolution is a real product. The architecture is built for it: adding external LLM providers (OpenAI, Anthropic, Gemini) via user-supplied API keys makes quality configurable without changing application logic.

Two high-value adjacent features sit just beyond v1: **cover letter generation** (the JD analysis already done for resume tailoring yields a matching cover letter with minimal additional work) and **ATS match scoring** (a visual keyword-match percentage against the job description, closing the feedback loop that tools like Jobscan charge $50/month to provide).

Longer term, the persistent experience profile becomes increasingly powerful as it accumulates history: learning which phrasings land interviews, suggesting which past projects to highlight for a given role type, and eventually acting as a personalized career intelligence layer — not just a document generator.
