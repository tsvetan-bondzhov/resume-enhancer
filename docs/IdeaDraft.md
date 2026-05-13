## Idea Draft

### Application

An AI driven resume enhancer application.

### Features

- Resume parsing - user uploads a resume (PDF, DOCX) and the application parses it.
- Resume enhancement - the application enhances the resume by adding missing information, correcting typos, etc.
- Resume optimization - the application optimizes the resume for a specific job.
- Resume export - the application exports the resume in PDF and DOCX format.
- Template management - user can create, update, and delete templates. There will be a list of prebuilt templates.
- Experience form - user can fill in their experience, education, and skills. This information is stored in the user's profile and can be edited at any time.
- Resume management - user can create, clone, upload, download, delete, and view their resumes.
- User authentication - user can sign in and sign up.
- Admin panel - admin users can manage users and templates.

### Workflows

- Create a resume
  - A user logs in and fills in the experience form
  - The user then selects a template
  - The application creates a new resume based on the experience form and the selected template
  - The application suggests enhancements for the resume. The application can ask additional questions to provide better enhancements.
  - The user can accept or reject the enhancements
  - The user can provide job description to optimize the resume. The application then enhances the resume based on the job description.
  - The user can save the resume (a name must be provided).
  - The user can export the resume in PDF and DOCX format
- Upload a resume
  - A user logs in and uploads an existing resume (PDF or DOCX)
  - The application automatically extracts experience, education, and skills
  - The user selects a template
  - The application creates a new resume based on the experience form and the selected template
  - The application suggests enhancements for the resume. The application can ask additional questions to provide better enhancements.
  - The user can accept or reject the enhancements
  - The user can provide job description to optimize the resume. The application then enhances the resume based on the job description.
  - The user can save the resume (a name must be provided).
  - The user can export the resume in PDF and DOCX format
- Edit a resume
  - A user logs in and edits an existing saved resume
  - The user can show/hide sections
  - The user can edit the experience, education, and skills
  - The user can provide job description to optimize the resume. The application then enhances the resume based on the job description.
  - The user can save the resume or save as a new resume (new name must be provided).
  - The user can export the resume in PDF and DOCX format
- Chat
  - A user logs in and chats with the application
  - The user can ask questions about the resume enhancement process
  - The user can request specific enhancements for the resume
  - The application can ask for clarification or additional information
- Admin panel
  - An admin user logs in
  - The admin user can manage users
  - The admin user can manage templates

### Technologies

- Spring Boot
- Ollama
- Grafana
- PostgreSQL
- Spring Data JPA
- Spring Security
- Spring AI
- Docker
- Docker Compose
- PostgreSQL
- Testcontainers
- OpenTelemetry
- Lombok
- Mockito
- JUnit
- JWT
- React JS
- Tailwind CSS
- Vite

### Development

- This is a new project with generated Spring Boot skeleton
- The project uses docker compose to run all dependencies (PostgreSQL, Grafana, Ollama)
- The project uses Testcontainers for integration testing
- The project uses OpenTelemetry for tracing and logging
- The project uses JWT for authentication
- The project uses Lombok for reducing boilerplate code
- The project uses Mockito for unit testing
- The project uses JUnit for unit testing
- The project uses React JS and TypeScript for the frontend
- The project uses Tailwind CSS for styling
- The project uses Vite for the frontend build tool
- Everything must be unit tested