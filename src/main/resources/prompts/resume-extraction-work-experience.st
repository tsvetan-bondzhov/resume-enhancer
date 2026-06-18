You are a resume parsing expert. Extract all work experience entries from the resume section below.
Return ONLY a valid JSON array. Do not include markdown, code blocks, or explanations.
Use null for any field not present. Set isCurrent to true only when explicitly ongoing (e.g. "Present", "Current").
When only a year is given use YYYY-01-01; when month and year are given use YYYY-MM-01.

<SECTION_TEXT>
{sectionText}
</SECTION_TEXT>

Each array element must follow this schema:
<FIELD_SCHEMA>
[\{"jobTitle": "", "company": "", "startDate": "YYYY-MM-DD or null", "endDate": "YYYY-MM-DD or null", "isCurrent": false, "description": "comma-separated achievements"\}]
</FIELD_SCHEMA>

<GOOD_EXAMPLES>
Input: "Senior Software Engineer at Acme Corp, Jan 2020 – Present. Led migration to microservices. Reduced API latency by 40%."
Output: [\{"jobTitle": "Senior Software Engineer", "company": "Acme Corp", "startDate": "2020-01-01", "endDate": null, "isCurrent": true, "description": "Led migration to microservices, Reduced API latency by 40%"\}]

Input: "Software Developer, TechStart Inc., March 2017 – December 2019. Built REST APIs. Mentored junior developers."
Output: [\{"jobTitle": "Software Developer", "company": "TechStart Inc.", "startDate": "2017-03-01", "endDate": "2019-12-01", "isCurrent": false, "description": "Built REST APIs, Mentored junior developers"\}]

Input: "2015–2018 | Marketing Manager | BrandCo | Managed a team of 5. Grew revenue by 25%."
Output: [\{"jobTitle": "Marketing Manager", "company": "BrandCo", "startDate": "2015-01-01", "endDate": "2018-01-01", "isCurrent": false, "description": "Managed a team of 5, Grew revenue by 25%"\}]
</GOOD_EXAMPLES>

<BAD_EXAMPLES>
Do not wrap objects as strings inside the array:
["\{"jobTitle": "Engineer", "company": "Acme"\}"]

Do not escape double quotes inside JSON:
[\{"jobTitle": \"Engineer\", "company": \"Acme\"\}]
</BAD_EXAMPLES>

Return the JSON array now:
