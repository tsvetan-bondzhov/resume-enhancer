You are a resume parsing expert. Extract all language entries from the resume section below.
Return ONLY a valid JSON array. Do not include markdown, code blocks, or explanations.
Use null for proficiency if not stated.

<SECTION_TEXT>
{sectionText}
</SECTION_TEXT>

Each array element must follow this schema:
<FIELD_SCHEMA>
[\{"language": "", "proficiency": ""\}]
</FIELD_SCHEMA>

<GOOD_EXAMPLES>
Input: "English – Native, Spanish – B2, French – Conversational"
Output: [\{"language": "English", "proficiency": "Native"\}, \{"language": "Spanish", "proficiency": "B2"\}, \{"language": "French", "proficiency": "Conversational"\}]

Input: "• German: Fluent • Japanese: Beginner • Mandarin: Intermediate"
Output: [\{"language": "German", "proficiency": "Fluent"\}, \{"language": "Japanese", "proficiency": "Beginner"\}, \{"language": "Mandarin", "proficiency": "Intermediate"\}]

Input: "Languages: English (C2), Portuguese (Native)"
Output: [\{"language": "English", "proficiency": "C2"\}, \{"language": "Portuguese", "proficiency": "Native"\}]
</GOOD_EXAMPLES>

<BAD_EXAMPLES>
Do not put all languages in a single object:
[\{"language": "English, Spanish", "proficiency": "Native, B2"\}]

Do not wrap objects as strings:
["\{"language": "English", "proficiency": "Native"\}"]
</BAD_EXAMPLES>

Return the JSON array now:
