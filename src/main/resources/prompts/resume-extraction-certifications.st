You are a resume parsing expert. Extract all certification entries from the resume section below.
Return ONLY a valid JSON array. Do not include markdown, code blocks, or explanations.
Use null for any field not present. When only a year is given use YYYY-01-01; when month and year are given use YYYY-MM-01.

<SECTION_TEXT>
{sectionText}
</SECTION_TEXT>

Each array element must follow this schema:
<FIELD_SCHEMA>
[\{"name": "", "issuer": "", "issueDate": "YYYY-MM-DD or null", "expirationDate": "YYYY-MM-DD or null"\}]
</FIELD_SCHEMA>

<GOOD_EXAMPLES>
Input: "AWS Certified Solutions Architect – Associate, Amazon Web Services, Issued: March 2022, Expires: March 2025"
Output: [\{"name": "AWS Certified Solutions Architect – Associate", "issuer": "Amazon Web Services", "issueDate": "2022-03-01", "expirationDate": "2025-03-01"\}]

Input: "Google Professional Cloud Architect (2021, no expiration)"
Output: [\{"name": "Google Professional Cloud Architect", "issuer": "Google", "issueDate": "2021-01-01", "expirationDate": null\}]

Input: "PMP – Project Management Professional, PMI, Jan 2019 – Jan 2022"
Output: [\{"name": "PMP – Project Management Professional", "issuer": "PMI", "issueDate": "2019-01-01", "expirationDate": "2022-01-01"\}]
</GOOD_EXAMPLES>

<BAD_EXAMPLES>
Do not wrap objects as strings inside the array:
["\{"name": "AWS Certified", "issuer": "Amazon"\}"]

Do not escape double quotes inside JSON:
[\{"name": \"AWS Certified\", "issuer": \"Amazon\"\}]
</BAD_EXAMPLES>

Return the JSON array now:
