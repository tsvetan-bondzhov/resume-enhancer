import type { ResumeDocumentDto, TemplateDefinitionDto } from "@/types/api"

// All section types available in the editor (UNKNOWN intentionally excluded).
export const ALL_SECTION_TYPES = [
  "FULL_NAME",
  "SUMMARY",
  "WORK_EXPERIENCE",
  "EDUCATION",
  "SKILLS",
  "PROJECTS",
  "CERTIFICATIONS",
  "LANGUAGES",
  "VOLUNTEERING",
] as const

// Shared CSS variables used by every preset. Sized values use px/in only (no rem/em),
// as enforced by validateDefinition / the backend.
const BASE_CSS_VARIABLES = {
  "--primary-color": "#1e293b",
  "--accent-color": "#3b82f6",
  "--text-color": "#0f172a",
  "--font-family-sans": "Inter, Arial, sans-serif",
  "--font-size-base": "11px",
  "--line-height-base": "1.5",
  "--section-spacing": "16px",
  "--item-spacing": "10px",
  "--page-margin-top": "0.75in",
  "--page-margin-right": "0.75in",
  "--page-margin-bottom": "0.75in",
  "--page-margin-left": "0.75in",
} as const

// Complete, valid single-column definition seeded in create mode. Includes every
// supported CSS variable and lists ALL available section types in sectionOrder.
export const DEFAULT_DEFINITION: TemplateDefinitionDto = {
  layoutType: "single-column",
  cssVariables: { ...BASE_CSS_VARIABLES },
  layout: {
    headerFormat: "name-contact",
    sectionOrder: [...ALL_SECTION_TYPES],
    sectionStyles: {},
  },
  metadata: { version: "1.0", atsCompatible: true, pageSize: "letter" },
}

// Two-column preset: left column holds the compact/supporting sections, right column
// holds the primary narrative sections. FULL_NAME / SUMMARY render in the header.
export const TWO_COLUMN_DEFINITION: TemplateDefinitionDto = {
  layoutType: "two-column",
  cssVariables: { ...BASE_CSS_VARIABLES },
  layout: {
    headerFormat: "name-contact",
    sectionOrder: [...ALL_SECTION_TYPES],
    columns: {
      left: ["SKILLS", "LANGUAGES", "CERTIFICATIONS", "EDUCATION"],
      right: ["SUMMARY", "WORK_EXPERIENCE", "PROJECTS", "VOLUNTEERING"],
    },
    sectionStyles: {},
  },
  metadata: { version: "1.0", atsCompatible: true, pageSize: "letter" },
}

// Modern-accent preset: single column with an accent header band.
export const MODERN_ACCENT_DEFINITION: TemplateDefinitionDto = {
  layoutType: "modern-accent",
  cssVariables: {
    ...BASE_CSS_VARIABLES,
    "--accent-color": "#0d9488",
    "--primary-color": "#0f766e",
  },
  layout: {
    headerFormat: "name-contact",
    sectionOrder: [...ALL_SECTION_TYPES],
    sectionStyles: {},
  },
  metadata: { version: "1.0", atsCompatible: true, pageSize: "letter" },
}

export type LayoutPresetId = "single-column" | "two-column" | "modern-accent"

export const LAYOUT_PRESETS: Record<LayoutPresetId, TemplateDefinitionDto> = {
  "single-column": DEFAULT_DEFINITION,
  "two-column": TWO_COLUMN_DEFINITION,
  "modern-accent": MODERN_ACCENT_DEFINITION,
}

// Sample document covering EVERY section in the default sectionOrder, each with at
// least two items so --item-spacing and --section-spacing changes are visible.
export const SAMPLE_DOC: ResumeDocumentDto = {
  sections: [
    {
      sectionType: "FULL_NAME",
      title: "Name",
      visible: true,
      items: [
        { type: "FULL_NAME", id: "sample-name-1", firstName: "Jordan", lastName: "Rivera" },
        { type: "FULL_NAME", id: "sample-name-2", firstName: "Jordan A.", lastName: "Rivera" },
      ],
    },
    {
      sectionType: "SUMMARY",
      title: "Summary",
      visible: true,
      items: [
        {
          type: "SUMMARY",
          id: "sample-summary-1",
          text: "Full-stack engineer with 8+ years building scalable web platforms.",
          linkedInUrl: "https://linkedin.com/in/jordanrivera",
          personalPageUrl: "https://jordanrivera.dev",
          blogUrl: "https://blog.jordanrivera.dev",
          contactEmail: "jordan@example.com",
          locationCountry: "USA",
          locationCity: "Austin",
        },
        {
          type: "SUMMARY",
          id: "sample-summary-2",
          text: "Passionate about developer experience, performance, and clean architecture.",
          linkedInUrl: null,
          personalPageUrl: null,
          blogUrl: null,
          contactEmail: "jordan.alt@example.com",
          locationCountry: "USA",
          locationCity: "Remote",
        },
      ],
    },
    {
      sectionType: "WORK_EXPERIENCE",
      title: "Experience",
      visible: true,
      items: [
        {
          type: "WORK_EXPERIENCE",
          id: "sample-we-1",
          jobTitle: "Senior Software Engineer",
          company: "Acme Corp",
          startDate: "2021-01",
          endDate: null,
          isCurrent: true,
          description: "Led the redesign of the core platform, improving load time by 40%.",
        },
        {
          type: "WORK_EXPERIENCE",
          id: "sample-we-2",
          jobTitle: "Software Engineer",
          company: "Globex",
          startDate: "2017-06",
          endDate: "2020-12",
          isCurrent: false,
          description: "Built and shipped customer-facing billing features used by 100k+ users.",
        },
      ],
    },
    {
      sectionType: "EDUCATION",
      title: "Education",
      visible: true,
      items: [
        {
          type: "EDUCATION",
          id: "sample-edu-1",
          institution: "State University",
          degree: "BSc",
          fieldOfStudy: "Computer Science",
          startDate: "2013",
          endDate: "2017",
        },
        {
          type: "EDUCATION",
          id: "sample-edu-2",
          institution: "Online Institute",
          degree: "Certificate",
          fieldOfStudy: "Distributed Systems",
          startDate: "2019",
          endDate: "2020",
        },
      ],
    },
    {
      sectionType: "SKILLS",
      title: "Skills",
      visible: true,
      items: [
        { type: "SKILLS", id: "sample-skill-1", name: "TypeScript" },
        { type: "SKILLS", id: "sample-skill-2", name: "React" },
        { type: "SKILLS", id: "sample-skill-3", name: "Node.js" },
      ],
    },
    {
      sectionType: "PROJECTS",
      title: "Projects",
      visible: true,
      items: [
        {
          type: "PROJECTS",
          id: "sample-proj-1",
          name: "Resume Enhancer",
          description: "An AI-assisted resume builder with live template previews.",
          technologies: "React, Spring Boot, PostgreSQL",
          link: "https://github.com/example/resume-enhancer",
          startDate: "2024-01",
          endDate: null,
          isCurrent: true,
        },
        {
          type: "PROJECTS",
          id: "sample-proj-2",
          name: "OpenMetrics Dashboard",
          description: "Real-time observability dashboard for microservices.",
          technologies: "Vue, Go, Prometheus",
          link: "https://github.com/example/openmetrics",
          startDate: "2022-03",
          endDate: "2023-09",
          isCurrent: false,
        },
      ],
    },
    {
      sectionType: "CERTIFICATIONS",
      title: "Certifications",
      visible: true,
      items: [
        {
          type: "CERTIFICATIONS",
          id: "sample-cert-1",
          name: "AWS Certified Solutions Architect",
          issuer: "Amazon Web Services",
          issueDate: "2022-05",
          expirationDate: "2025-05",
        },
        {
          type: "CERTIFICATIONS",
          id: "sample-cert-2",
          name: "Certified Kubernetes Administrator",
          issuer: "CNCF",
          issueDate: "2023-02",
          expirationDate: "2026-02",
        },
      ],
    },
    {
      sectionType: "LANGUAGES",
      title: "Languages",
      visible: true,
      items: [
        { type: "LANGUAGES", id: "sample-lang-1", language: "English", proficiency: "Native" },
        { type: "LANGUAGES", id: "sample-lang-2", language: "Spanish", proficiency: "Advanced" },
      ],
    },
    {
      sectionType: "VOLUNTEERING",
      title: "Volunteering",
      visible: true,
      items: [
        {
          type: "VOLUNTEERING",
          id: "sample-vol-1",
          role: "Mentor",
          organization: "Code for Good",
          description: "Mentored aspiring developers from underrepresented backgrounds.",
          startDate: "2020-01",
          endDate: null,
          isCurrent: true,
        },
        {
          type: "VOLUNTEERING",
          id: "sample-vol-2",
          role: "Workshop Lead",
          organization: "Local Library",
          description: "Ran weekend coding workshops for high-school students.",
          startDate: "2018-09",
          endDate: "2019-12",
          isCurrent: false,
        },
      ],
    },
  ],
}
