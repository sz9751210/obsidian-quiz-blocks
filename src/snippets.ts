export const radioSnippet = `\`\`\`quiz
type: radio
content: >-
  Your question here?

options:
- content: ""
  feedback: ""
- content: ""
  feedback: ""
  correct: true
\`\`\``;

export const checkboxSnippet = `\`\`\`quiz
type: checkbox
content: >-
  Your question here?

options:
- content: ""
  feedback: ""
- content: ""
  feedback: ""
  correct: true
\`\`\``;

export const textSnippet = `\`\`\`quiz
type: text
content: >-
  Your question here?

# optional reference answer shown after pressing Check
correct: >-
    
\`\`\``;

export const promptSnippet = `\`\`\`quiz
type: prompt
content: |-
	The chemical symbol for water is ==H²O==.
	
	It freezes at ==0°C== under standard atmospheric pressure.

# optional feedback shown after pressing [check]
feedback: >-
  Use ==double equals== to hide text until you reveal the answer.
\`\`\``;

export const choiceSnippet = `\`\`\`quiz
type: choice
content: >-
  Match each situation with the correct option.

options:
- id: opt1
  content: "Option 1"
- id: opt2
  content: "Option 2"

questions:
- content: "Situation #1"
  correct_option: opt1
- content: "Situation #2"
  correct_option: opt2
\`\`\``;

export const noodleSnippet = `\`\`\`quiz
type: noodle
content: >-
  Connect each question on the right with the matching option on the left.

options:
- id: opt1
  content: "Option 1"
- id: opt2
  content: "Option 2"

questions:
- content: "Question #1"
  correct_option: opt1
- content: "Question #2"
  correct_option: opt2
\`\`\``;
