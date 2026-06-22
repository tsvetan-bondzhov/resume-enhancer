You are a resume parsing expert. Extract the candidate's name from the resume section below.
Return ONLY a valid JSON array containing a single object. Do not include markdown, code blocks, or explanations.

<SECTION_TEXT>
{sectionText}
</SECTION_TEXT>

The array must contain exactly one object with this schema:
<FIELD_SCHEMA>
[\{
  "firstName": "candidate's first/given name or null",
  "lastName": "candidate's last/family name or null"
\}]
</FIELD_SCHEMA>

<RULES>
- Split the name into firstName and lastName when both are present.
- If only a single name token is present, put it in firstName and set lastName to null.
- If no name is present, return null for both fields.
- Do not copy the field names themselves as values.
</RULES>

<GOOD_EXAMPLES>
Input: "John Doe"
Output: [\{"firstName": "John", "lastName": "Doe"\}]

Input: "JANE A. SMITH"
Output: [\{"firstName": "Jane", "lastName": "Smith"\}]
</GOOD_EXAMPLES>

Return the JSON array now:
