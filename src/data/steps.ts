export const STEPS = [
  'kickoff',
  'len',
  'rosa',
  'define',
  'ideate',
  'len-paper',
  'theo',
  'priya',
  'wall',
  'next',
] as const;

export type StepId = (typeof STEPS)[number];

export const OBJECTIVE: Record<StepId, string> = {
  kickoff: 'Write the problem statement with Mae.',
  len: "Visit Len's coffee stall at the market (southwest).",
  rosa: 'Interview Rosa at the taco truck, in the same market.',
  define: 'Define the problem with Mae.',
  ideate: 'Sketch ideas with Mae and Jordan.',
  'len-paper': 'Take the paper sheet back to Len.',
  theo: 'Test with Theo at the vet clinic (east).',
  priya: 'Meet Priya at Kite Bank (southeast).',
  wall: 'Sort the insight wall in the lab.',
  next: 'Plan the next cycle with Mae.',
};

export const KICKOFF_STATEMENT =
  'Stall and truck owners at the Saturday market run out of supplies or over-order, even though they count every morning before opening. Most who tried StockPot went back to paper. Each miss costs them a rush or a crate of stock. We don’t know why yet.';

export const DEFINED_STATEMENT =
  'Stall and truck owners at the Saturday market write down their morning count, but it doesn’t reach the person who restocks or closes in time. The count lives in one place, on a whiteboard, a clipboard, or one phone, and that person isn’t there when it’s written. Len lost a rush to an empty lid sleeve. Rosa went back to paper so her cousin can read it.';

/** Methods the cheat sheet lists that this cycle doesn’t play. */
export const OTHER_CYCLE_METHODS =
  'Methods for another cycle: diary studies (Discover), card sorting (Explore), benchmark testing (Test).';
