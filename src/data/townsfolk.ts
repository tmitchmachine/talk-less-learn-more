import type { SrcKey } from './sources';

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

/** Mae's lines for each point in the story. Stage = sessions completed (+1 once the wall is sorted). */
export function maeLines(stage: number, rank: string): string[] {
  switch (stage) {
    case 0: return [
      'Welcome to Fieldtown! I’m Mae. I run the research lab.',
      'Our customers will tell you a lot, if you let them. Your job is to ask well, and then mostly listen.',
      'Rule one: treat every conversation like a research study, not a sales pitch.',
      'Rosa runs the taco truck in the market, southwest of here. She stopped using our inventory app and we don’t know why. Go find out.',
      'Arrow keys or WASD to walk (or drag on a touchscreen). E or Space to talk. J opens your journal.',
    ];
    case 1: return [
      'Nice work with Rosa. Every note on that wall came from asking about real moments.',
      'Next up: Theo, at the vet clinic east of the plaza. This one’s a usability test.',
      'Give him a realistic task, ask him to think aloud, then... shut up and let him do the talking.',
      'I had the road crew open the east road for you.',
    ];
    case 2: return [
      'Theo’s session showed exactly why we watch instead of explain.',
      'Last one: Priya, at Kite Bank in the southeast. Jordan from product will be passing you notes.',
      'Remember: pay attention to what users do, not what they say. The south road is open.',
    ];
    case 3: return [
      'That’s all three customers! Your notebook is full.',
      'Come into the lab. Time to sort what we learned on the wall.',
    ];
    default: return [
      `You did it. The team calls you: ${rank}.`,
      'Replay any session to earn more stars. The strong moves you’ve collected are in your journal.',
      'And next time you talk to a real customer: talk less, learn more.',
    ];
  }
}
