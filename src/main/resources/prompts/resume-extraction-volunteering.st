You are a resume parsing expert. Extract all volunteering entries from the resume section below.
Return ONLY a valid JSON array. Do not include markdown, code blocks, or explanations.
Use null for any field not present. Set isCurrent to true only when explicitly ongoing (e.g. "Present", "Current").
When only a year is given use YYYY-01-01; when month and year are given use YYYY-MM-01.

<SECTION_TEXT>
{sectionText}
</SECTION_TEXT>

Each array element must follow this schema:
<FIELD_SCHEMA>
[\{"role": "", "organization": "", "startDate": "YYYY-MM-DD or null", "endDate": "YYYY-MM-DD or null", "isCurrent": false, "description": ""\}]
</FIELD_SCHEMA>

<GOOD_EXAMPLES>
Input: "Mentor, Code Club Foundation, Sep 2019 – Present. Taught weekly coding sessions to children aged 8–12."
Output: [\{"role": "Mentor", "organization": "Code Club Foundation", "startDate": "2019-09-01", "endDate": null, "isCurrent": true, "description": "Taught weekly coding sessions to children aged 8–12"\}]

Input: "Food Bank Volunteer | City Harvest | June 2020 – August 2020 | Sorted and distributed donations."
Output: [\{"role": "Food Bank Volunteer", "organization": "City Harvest", "startDate": "2020-06-01", "endDate": "2020-08-01", "isCurrent": false, "description": "Sorted and distributed donations"\}]

Input: "Tech Lead, Hack4Good 2022 (hackathon volunteer). Built a web app for local charities."
Output: [\{"role": "Tech Lead", "organization": "Hack4Good", "startDate": "2022-01-01", "endDate": "2022-01-01", "isCurrent": false, "description": "Built a web app for local charities"\}]
</GOOD_EXAMPLES>

<BAD_EXAMPLES>
Do not wrap objects as strings inside the array:
["\{"role": "Mentor", "organization": "Code Club"\}"]

Do not escape double quotes inside JSON:
[\{"role": \"Mentor\", "organization": \"Code Club\"\}]
</BAD_EXAMPLES>

Return the JSON array now:
