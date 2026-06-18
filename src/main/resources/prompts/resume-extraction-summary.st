You are a resume parsing expert. Extract the professional summary and contact/personal details from the resume section below.
Return ONLY a valid JSON array containing a single object. Do not include markdown, code blocks, or explanations.

<SECTION_TEXT>
{sectionText}
</SECTION_TEXT>

The array must contain exactly one object with this schema:
<FIELD_SCHEMA>
[\{
  "text": "full summary prose (null if absent)",
  "linkedInUrl": "LinkedIn profile URL or null",
  "personalPageUrl": "personal/portfolio website URL or null",
  "blogUrl": "blog URL or null",
  "contactEmail": "email address or null",
  "locationCountry": "country name or null",
  "locationCity": "city name or null"
\}]
</FIELD_SCHEMA>

<RULES>
- Extract URLs exactly as written; do not fabricate or normalise them.
- For location, split into city and country when both are present (e.g. "Berlin, Germany" → city: "Berlin", country: "Germany").
- If a field is not present in the section, return null for that field.
- Do not copy the field names themselves as values.
</RULES>

<GOOD_EXAMPLES>
Input: "John Doe | john@example.com | linkedin.com/in/johndoe | Berlin, Germany\nResults-driven software engineer with 8 years of experience."
Output: [\{"text": "Results-driven software engineer with 8 years of experience.", "linkedInUrl": "linkedin.com/in/johndoe", "personalPageUrl": null, "blogUrl": null, "contactEmail": "john@example.com", "locationCountry": "Germany", "locationCity": "Berlin"\}]

Input: "OBJECTIVE: Seeking a challenging role in data science.\njane@ml.io | https://janedoe.dev | https://blog.janedoe.dev | New York, USA"
Output: [\{"text": "Seeking a challenging role in data science.", "linkedInUrl": null, "personalPageUrl": "https://janedoe.dev", "blogUrl": "https://blog.janedoe.dev", "contactEmail": "jane@ml.io", "locationCountry": "USA", "locationCity": "New York"\}]

Input: "Product manager with a track record of launching 0-to-1 products."
Output: [\{"text": "Product manager with a track record of launching 0-to-1 products.", "linkedInUrl": null, "personalPageUrl": null, "blogUrl": null, "contactEmail": null, "locationCountry": null, "locationCity": null\}]
</GOOD_EXAMPLES>

<BAD_EXAMPLES>
Do not return an empty array:
[]

Do not wrap the object as a string:
["\{"text": "Experienced engineer..."\}"]
</BAD_EXAMPLES>

Return the JSON array now:
