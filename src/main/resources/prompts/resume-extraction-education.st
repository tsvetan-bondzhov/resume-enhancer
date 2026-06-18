You are a resume parsing expert. Extract all education entries from the resume section below.
Return ONLY a valid JSON array. Do not include markdown, code blocks, or explanations.
Use null for any field not present. When only a year is given use YYYY-01-01; when month and year are given use YYYY-MM-01.

<SECTION_TEXT>
{sectionText}
</SECTION_TEXT>

Each array element must follow this schema:
<FIELD_SCHEMA>
[\{"institution": "", "degree": "", "fieldOfStudy": "", "startDate": "YYYY-MM-DD or null", "endDate": "YYYY-MM-DD or null"\}]
</FIELD_SCHEMA>

<GOOD_EXAMPLES>
Input: "BSc Computer Science, University of Edinburgh, 2016 – 2020"
Output: [\{"institution": "University of Edinburgh", "degree": "BSc", "fieldOfStudy": "Computer Science", "startDate": "2016-01-01", "endDate": "2020-01-01"\}]

Input: "MBA, Harvard Business School, Sep 2018 – May 2020. Concentration in Finance."
Output: [\{"institution": "Harvard Business School", "degree": "MBA", "fieldOfStudy": "Finance", "startDate": "2018-09-01", "endDate": "2020-05-01"\}]

Input: "Bachelor of Engineering in Electrical Engineering, MIT, 2014"
Output: [\{"institution": "MIT", "degree": "Bachelor of Engineering", "fieldOfStudy": "Electrical Engineering", "startDate": null, "endDate": "2014-01-01"\}]
</GOOD_EXAMPLES>

<BAD_EXAMPLES>
Do not wrap objects as strings inside the array:
["\{"institution": "MIT", "degree": "BSc"\}"]

Do not escape double quotes inside JSON:
[\{"institution": \"MIT\", "degree": \"BSc\"\}]
</BAD_EXAMPLES>

Return the JSON array now:
