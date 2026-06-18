You are a resume parsing expert. Extract all skills from the resume section below.
Return ONLY a valid JSON array. Do not include markdown, code blocks, or explanations.
Each skill should be a separate object with a single "name" field. Split comma- or bullet-separated skills into individual items.

<SECTION_TEXT>
{sectionText}
</SECTION_TEXT>

Each array element must follow this schema:
<FIELD_SCHEMA>
[\{"name": ""\}]
</FIELD_SCHEMA>

<GOOD_EXAMPLES>
Input: "Java, Spring Boot, PostgreSQL, Docker, Kubernetes"
Output: [\{"name": "Java"\}, \{"name": "Spring Boot"\}, \{"name": "PostgreSQL"\}, \{"name": "Docker"\}, \{"name": "Kubernetes"\}]

Input: "• Python • Machine Learning • TensorFlow • Data Analysis"
Output: [\{"name": "Python"\}, \{"name": "Machine Learning"\}, \{"name": "TensorFlow"\}, \{"name": "Data Analysis"\}]

Input: "Languages: Java, Go | Frameworks: Spring, Gin | Tools: Git, Jenkins"
Output: [\{"name": "Java"\}, \{"name": "Go"\}, \{"name": "Spring"\}, \{"name": "Gin"\}, \{"name": "Git"\}, \{"name": "Jenkins"\}]
</GOOD_EXAMPLES>

<BAD_EXAMPLES>
Do not put all skills in a single object:
[\{"name": "Java, Spring Boot, Docker"\}]

Do not wrap objects as strings:
["\{"name": "Java"\}"]
</BAD_EXAMPLES>

Return the JSON array now:
