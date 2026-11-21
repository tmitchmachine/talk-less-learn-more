// Synthesis: sort observations into the five quality components of usability, plus utility.
// Source: https://www.nngroup.com/articles/usability-101-introduction-to-usability/

export const BINS = {
  learn: { n: 'Learnability', d: 'Easy the first time?' },
  eff: { n: 'Efficiency', d: 'Fast once learned?' },
  mem: { n: 'Memorability', d: 'Easy to come back to?' },
  err: { n: 'Errors', d: 'How many, how bad, recoverable?' },
  sat: { n: 'Satisfaction', d: 'Pleasant to use?' },
  util: { n: 'Utility', d: 'Has the features people need?' },
} as const;

export type BinKey = keyof typeof BINS;

export interface SortCard { text: string; a: BinKey; why: string }

export const SORT: SortCard[] = [
  { text: 'Priya couldn’t find “Send money” the first time she saw Design A.', a: 'learn', why: 'Learnability is how easily people accomplish basic tasks the first time they encounter the design.' },
  { text: 'Rosa logs every delivery, every day, and each one takes 9 taps.', a: 'eff', why: 'Efficiency is how quickly people perform tasks once they’ve learned the design. Daily, repeated work makes it matter most.' },
  { text: 'Theo said booking “felt like a chore,” even though he finished.', a: 'sat', why: 'Satisfaction is how pleasant the design is to use. He succeeded, and still didn’t enjoy it.' },
  { text: 'StockPot’s auto-reorder fired twice, and Rosa paid for 40 extra pounds of avocados.', a: 'err', why: 'Errors covers how many errors happen, how severe they are, and how easily people recover. This one was costly.' },
  { text: 'Rosa’s cousin needs to see the stock list on the late shift. StockPot has no way to share it.', a: 'util', why: 'That’s utility, not usability: whether the interface provides the features users need. A product needs both to be useful.' },
  { text: 'Theo hadn’t booked in six months and forgot where appointments were.', a: 'mem', why: 'Memorability is how easily people regain proficiency after a period of not using the design.' },
  { text: 'An architect uses a CAD tool for hours a day and wants faster ways to repeat commands.', a: 'eff', why: 'The article’s own example: for a tool used all day, efficiency matters most.' },
  { text: 'Theo picked “Wellness Plan” thinking it was a one-time checkup.', a: 'err', why: 'Errors include both slips and mistakes. This was a mistake: the wrong plan, carried out well.' },
  { text: 'Priya calls the old app “stressful and ugly,” even on days it works fine.', a: 'sat', why: 'Satisfaction: how pleasant the design is to use, separate from whether tasks succeed.' },
  { text: 'After two weeks off, the bakery’s manager has to relearn the reports screen.', a: 'mem', why: 'Memorability: regaining proficiency after time away.' },
  { text: 'Someone filing taxes once a year struggles to get started on the form.', a: 'learn', why: 'The article’s own example: for a once-a-year task, learnability matters most, because everyone is a first-timer.' },
];
