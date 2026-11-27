// Every rule, example and quote in the game comes from these Nielsen Norman Group articles.
export const SRC = {
  u101: { t: 'Usability 101: Introduction to Usability', u: 'https://www.nngroup.com/articles/usability-101-introduction-to-usability/' },
  interviews: { t: 'User Interviews 101', u: 'https://www.nngroup.com/articles/user-interviews/' },
  leading: { t: 'Avoid Leading Questions', u: 'https://www.nngroup.com/articles/leading-questions/' },
  open: { t: 'Open-Ended vs. Closed Questions', u: 'https://www.nngroup.com/articles/open-ended-questions/' },
  talking: { t: 'Talking with Participants During a Usability Test', u: 'https://www.nngroup.com/articles/talking-to-users/' },
  firstrule: { t: "First Rule of Usability? Don't Listen to Users", u: 'https://www.nngroup.com/articles/first-rule-of-usability-dont-listen-to-users/' },
  thinkaloud: { t: 'Thinking Aloud: The #1 Usability Tool', u: 'https://www.nngroup.com/articles/thinking-aloud-the-1-usability-tool/' },
  mistakes: { t: '6 Mistakes When Crafting Interview Questions', u: 'https://www.nngroup.com/articles/interview-questions-mistakes/' },
  funnel: { t: 'The Funnel Technique in Qualitative User Research', u: 'https://www.nngroup.com/articles/the-funnel-technique-in-qualitative-user-research/' },
  thinking: { t: 'Design Thinking 101', u: 'https://www.nngroup.com/articles/design-thinking/' },
  cheat: { t: 'UX Research Cheat Sheet', u: 'https://www.nngroup.com/articles/ux-research-cheat-sheet/' },
  problem: { t: 'Problem Statements in UX Discovery', u: 'https://www.nngroup.com/articles/problem-statements/' },
} as const;

export type SrcKey = keyof typeof SRC;
