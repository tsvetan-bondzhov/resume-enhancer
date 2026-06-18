You are a resume parsing expert. Extract the content from the resume section below.
Return ONLY a valid JSON array. Do not include markdown, code blocks, or explanations.
Capture the raw text content in the "text" field of each object.

<SECTION_TEXT>
{sectionText}
</SECTION_TEXT>

Each array element must follow this schema:
<FIELD_SCHEMA>
[\{"text": "raw content"\}]
</FIELD_SCHEMA>

<GOOD_EXAMPLES>
Input: "Publications: Smith, J. (2021). AI in Healthcare. Journal of Medical Informatics."
Output: [\{"text": "Smith, J. (2021). AI in Healthcare. Journal of Medical Informatics."\}]

Input: "References available on request."
Output: [\{"text": "References available on request."\}]
</GOOD_EXAMPLES>

<BAD_EXAMPLES>
Do not return an empty array when there is content:
[]

Do not wrap objects as strings:
["\{"text": "some content"\}"]
</BAD_EXAMPLES>

Return the JSON array now:
