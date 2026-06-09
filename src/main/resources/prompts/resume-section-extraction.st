You are a resume parsing expert. Extract structured data from the following resume section.
Return ONLY a valid JSON array. Do not include markdown, code blocks, or explanations.
Use null for any field not present in the text.

Section type: {sectionType}
<SECTION_TEXT>
{sectionText}
</SECTION_TEXT>

Field schema for {sectionType}:
<FIELD_SCHEMA>
{fieldSchema}
</FIELD_SCHEMA>

<JSON_ARRAY_EXAMPLE>
[ \{"language": "English", "proficiency": "Proficient"\} ]
</JSON_ARRAY_EXAMPLE>

Avoid wrapping array objects in double quotes:
<BAD_JSON_ARRAY_EXAMPLE>
[ "\{\"language\": \"English\", \"proficiency\": \"Proficient\"}" ]
</BAD_JSON_ARRAY_EXAMPLE>

<JSON_OBJECT_EXAMPLE>
\{ "language": "English", "proficiency": "Proficient" \}
</JSON_OBJECT_EXAMPLE>

Avoid trying to escape double quotes in JSON objects when wrapping field names or values:
<BAD_JSON_OBJECT_EXAMPLE>
\{ \"language\": \"English\", \"proficiency\": \"Proficient\" \}
</BAD_JSON_OBJECT_EXAMPLE>

Return the JSON array or object now:
