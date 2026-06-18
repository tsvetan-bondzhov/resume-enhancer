You are a resume parsing expert. Extract the professional summary from the resume section below.
Return ONLY a valid JSON array containing a single object. Do not include markdown, code blocks, or explanations.

<SECTION_TEXT>
{sectionText}
</SECTION_TEXT>

The array must contain exactly one object with this schema:
<FIELD_SCHEMA>
[\{"text": "full summary prose"\}]
</FIELD_SCHEMA>

<GOOD_EXAMPLES>
Input: "Results-driven software engineer with 8 years of experience building scalable distributed systems. Passionate about clean code and mentoring junior developers."
Output: [\{"text": "Results-driven software engineer with 8 years of experience building scalable distributed systems. Passionate about clean code and mentoring junior developers."\}]

Input: "OBJECTIVE: Seeking a challenging role in data science where I can apply machine learning expertise to solve real-world problems."
Output: [\{"text": "Seeking a challenging role in data science where I can apply machine learning expertise to solve real-world problems."\}]

Input: "Product manager with a track record of launching 0-to-1 products. Skilled in roadmapping, stakeholder alignment, and agile delivery."
Output: [\{"text": "Product manager with a track record of launching 0-to-1 products. Skilled in roadmapping, stakeholder alignment, and agile delivery."\}]
</GOOD_EXAMPLES>

<BAD_EXAMPLES>
Do not return an empty array:
[]

Do not wrap the object as a string:
["\{"text": "Experienced engineer..."\}"]
</BAD_EXAMPLES>

Return the JSON array now:
