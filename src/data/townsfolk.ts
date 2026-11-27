import type { SrcKey } from './sources';
import type { StepId } from './steps';
import { state } from '../state';

export interface Line { name: string; who?: string; text: string }

/** Ambient townsfolk. Each one passes on a lesson from an NN/g article. */
export const TOWNSFOLK: Record<string, { lines: string[]; src: SrcKey }> = {
  gus: {
    src: 'firstrule',
    lines: [
      'I ran a survey once. Half my customers said they’d buy more if I sold 3-D bird feeders.',
      'So I built 3-D bird feeders. Sold two.',
      'What people predict they’ll do isn’t what they do. I should have watched what they actually bought.',
    ],
  },
  ivy: {
    src: 'firstrule',
    lines: [
      'My boss put two logos in front of people and asked which one they liked.',
      'Everybody picked the spinning one. Then nobody could find the menu.',
      'People judge surface features when they haven’t tried to use the thing.',
    ],
  },
  pete: {
    src: 'u101',
    lines: [
      'Five users. That’s my advice.',
      'Test with five, fix what’s broken, test again. Small rounds find a lot of the big problems.',
      'And start early. A paper sketch is enough to watch someone try it.',
    ],
  },
  nia: {
    src: 'talking',
    lines: [
      'My teacher says when you don’t know what to say, count to ten in your head.',
      'She says people fill the quiet with the good stuff.',
    ],
  },
};

export const NOTICEBOARD: string[] = [
  'USABILITY 101 · pinned to the board',
  'Usability is how easily people can successfully complete a task using an interface.',
  'It has five quality components: Learnability, Efficiency, Memorability, Errors, and Satisfaction.',
  'Utility is a separate question: does it have the features people need? Useful = usability + utility.',
];

const WORKSHOP_STEPS: StepId[] = ['kickoff', 'define', 'ideate', 'next'];
export const isWorkshopStep = (step: StepId | 'done') => step !== 'done' && WORKSHOP_STEPS.includes(step);

/** Mae's lines keyed by the step she is briefing. */
export function maeLines(step: StepId | 'done', rank: string): string[] {
  const migrated = state.migrated
    ? ['The lab now starts every project with a problem statement. Your stars and notes are safe.']
    : [];

  switch (step) {
    case 'kickoff': return [
      ...migrated,
      'Welcome to Fieldtown! I’m Mae. I run the research lab.',
      'You walked in with a sticky that says “an app for small businesses.” That names a solution and too many people.',
      'Before anyone talks to customers, we write the problem: who, what, where, when, and why. No feature in the sentence.',
      'Come into the lab with me. Arrow keys or WASD to walk (or drag on a touchscreen). E or Space to talk. J opens your journal.',
    ];
    case 'len': return [
      'Good. One problem, one place you can visit Saturday.',
      'Len runs a coffee stall in the market, southwest of here. He’s never used StockPot. Learn last week. Do not pitch.',
      'Go where the users are, watch, ask, and listen.',
    ];
    case 'rosa': return [
      'Len told you how the morning count fails to reach Sam.',
      'Rosa is at the taco truck in the same market. Same who, where and when. There’s no design to test today.',
      'Ask about real moments. Before you brief anyone, separate what you can stand behind from what you should park.',
    ];
    case 'define': return [
      'You have notes from two people. Time to define.',
      'Combine what you told the team. Look for a common pain. Refine the statement. Still no solution.',
    ];
    case 'ideate': return [
      'Quantity first. No idea is too far-fetched yet.',
      'Jordan from product will sit in. Keep his favorite as one sketch among several, then pick a subset for paper.',
    ];
    case 'len-paper': return [
      'Take the shared count sheet back to Len. Rough is fine.',
      'Don’t ask if he likes it. Give him this morning’s count and watch where he stalls.',
    ];
    case 'theo': return [
      'Different client, different problem statement.',
      'PawPoint’s site is already live, and the question is whether new customers can book on their own.',
      'When you can do one thing to improve a live system, run a think-aloud test. The east road is open.',
    ];
    case 'priya': return [
      'Kite has two designs and one question: which one works.',
      'Watch the same task on both, then check what people did, not what they say. The south road is open.',
    ];
    case 'wall': return [
      'Your notebook is full from this cycle and the client visits.',
      'Come into the lab. Time to sort what we learned on the wall.',
    ];
    case 'next': return [
      'Teams often return to empathize and define after a prototype is tested.',
      'Plan the next cycle with me. Implement comes after the test; it doesn’t replace it.',
    ];
    case 'done':
    default: return [
      `You did it. The team calls you: ${rank}.`,
      'Replay any session to earn more stars. The strong moves you’ve collected are in your journal.',
      'And next time you talk to a real customer: talk less, learn more.',
    ];
  }
}
