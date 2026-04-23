---
name: ask-user-question
description: Built-in skill for asking the user questions during task execution. Use this when you need clarification, decisions, or choices from the user before proceeding.
---

# Ask User Question

When you need to ask the user a question during your work, you MUST use the following format:

## Output Format

When you need to ask a question, output EXACTLY this format in your response:

[ASK_USER]
{"tool_use_id":"ask-<random-id>","questions":[{"question":"Your question here","header":"Short Label","options":[{"label":"Option A","value":"a","description":"Description of option A"},{"label":"Option B","value":"b","description":"Description of option B"}],"multiSelect":false}]}
[/ASK_USER]

## Rules

1. **When to ask**: Ask when you encounter ambiguity, need a design decision, require user confirmation, or face multiple valid approaches.
2. **Format**: The content between [ASK_USER] and [/ASK_USER] MUST be valid JSON matching this schema:
   - `tool_use_id`: A unique string starting with "ask-" (e.g., "ask-001", "ask-decision-1")
   - `questions`: Array of question objects, each with:
     - `question` (required): The question text
     - `header` (optional): Short label for the question (max 12 chars)
     - `options` (optional): Array of choices, each with `label`, `value`, and optional `description`
     - `multiSelect` (optional): Whether multiple options can be selected (default false)
3. **One at a time**: Only output ONE [ASK_USER] block per response. After outputting it, STOP and wait.
4. **No other tool needed**: Do NOT try to use any other tool or mechanism to ask questions. This [ASK_USER] format is the ONLY way.
5. **Be concise**: Keep questions clear and options simple.

## Examples

### Simple yes/no question:
[ASK_USER]
{"tool_use_id":"ask-confirm-1","questions":[{"question":"Should I use TypeScript or JavaScript for this module?","header":"Language","options":[{"label":"TypeScript","value":"typescript","description":"Static typing, better IDE support"},{"label":"JavaScript","value":"javascript","description":"Simpler setup, no compilation needed"}]}]}
[/ASK_USER]

### Question with multiple options:
[ASK_USER]
{"tool_use_id":"ask-strategy","questions":[{"question":"Which authentication approach should I implement?","header":"Auth method","options":[{"label":"JWT tokens","value":"jwt","description":"Stateless, scalable"},{"label":"Session cookies","value":"session","description":"Server-side, easier to revoke"},{"label":"OAuth 2.0","value":"oauth","description":"Delegated auth, third-party support"}]}]}
[/ASK_USER]
