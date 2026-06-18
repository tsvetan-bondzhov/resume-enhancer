You are a resume parsing expert. Extract all project entries from the resume section below.
Return ONLY a valid JSON array. Do not include markdown, code blocks, or explanations.
Use null for any field not present. Set isCurrent to true only when the project is explicitly ongoing.
When only a year is given use YYYY-01-01; when month and year are given use YYYY-MM-01.
List technologies as a comma-separated string.

<SECTION_TEXT>
{sectionText}
</SECTION_TEXT>

Each array element must follow this schema:
<FIELD_SCHEMA>
[\{"name": "", "description": "", "technologies": "comma-separated", "link": "", "startDate": "YYYY-MM-DD or null", "endDate": "YYYY-MM-DD or null", "isCurrent": false\}]
</FIELD_SCHEMA>

<GOOD_EXAMPLES>
Input: "Resume Enhancer – A Spring Boot app that uses LLMs to improve resumes. Built with Java, Spring AI, PostgreSQL. github.com/user/resume-enhancer. Jan 2024 – Present."
Output: [\{"name": "Resume Enhancer", "description": "A Spring Boot app that uses LLMs to improve resumes", "technologies": "Java, Spring AI, PostgreSQL", "link": "github.com/user/resume-enhancer", "startDate": "2024-01-01", "endDate": null, "isCurrent": true\}]

Input: "E-commerce Platform (2022): Built a full-stack online store using React, Node.js, and MongoDB. Deployed on AWS."
Output: [\{"name": "E-commerce Platform", "description": "Built a full-stack online store. Deployed on AWS.", "technologies": "React, Node.js, MongoDB, AWS", "link": null, "startDate": "2022-01-01", "endDate": null, "isCurrent": false\}]

Input: "Open Source CLI Tool | Rust, Clap | 2021–2023 | Command-line utility for bulk file renaming | crates.io/crates/renamer"
Output: [\{"name": "Open Source CLI Tool", "description": "Command-line utility for bulk file renaming", "technologies": "Rust, Clap", "link": "crates.io/crates/renamer", "startDate": "2021-01-01", "endDate": "2023-01-01", "isCurrent": false\}]
</GOOD_EXAMPLES>

<BAD_EXAMPLES>
Do not wrap objects as strings inside the array:
["\{"name": "My Project", "description": "A cool project"\}"]

Do not escape double quotes inside JSON:
[\{"name": \"My Project\", "description": \"A cool project\"\}]
</BAD_EXAMPLES>

Return the JSON array now:
