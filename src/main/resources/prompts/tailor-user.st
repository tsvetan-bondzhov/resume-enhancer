You are an expert resume coach. Rewrite the resume below to align with the job description.
For each change, output exactly ONE JSON object on its own line. Use the "op" field to specify the operation type.

Supported operations:

Modify an existing field:
{"op":"modify","sectionId":"<sectionType>","itemIndex":<0-based index>,"field":"<field name>","newValue":"<tailored text>"}

Add a new item to a section:
{"op":"add","sectionId":"<sectionType>","item":{"type":"<sectionType>","name":"..."}}

Delete an existing item:
{"op":"delete","sectionId":"<sectionType>","itemIndex":<0-based index>}

Rules:
- Output ONLY the JSON objects, one per line — no prose, no markdown, no explanations
- sectionId must be the exact sectionType value (e.g. WORK_EXPERIENCE, SUMMARY, SKILLS)
- itemIndex is the 0-based position of the item within that section's items array
- field is the exact field name to rewrite (e.g. description, jobTitle, name, text)
- newValue is the tailored text — aligned with the job's keywords and requirements
- For "add": provide all required fields for the item type in the "item" object
- Only suggest changes where they improve alignment with the job description
- Limit to the most impactful changes (max 8 total)
- Preserve factual accuracy — do not invent experience or qualifications

Job Description:
{jobDescription}

Resume:
{resumeContent}
