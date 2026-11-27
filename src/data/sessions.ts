import type { SrcKey } from './sources';
import { KICKOFF, DEFINE, IDEATE, NEXT, KICKOFF_STATEMENT } from './workshops';
import { LEN, LEN_PAPER } from './len';

export type Verdict = 'best' | 'ok' | 'bad';
export type Mood = 'open' | 'neutral' | 'guarded' | 'confused';

export interface Choice {
  v: Verdict;
  /** Short name for the move. Strong moves are collected in the journal by this name. */
  tag: string;
  say: string;
  ins: number;
  bias: number;
  mood?: Mood;
  reply?: string;
  /** Who replies, when it is not the person who spoke this turn. */
  rwho?: 'p' | 'obs';
  silent?: boolean;
  unlock?: string;
  note: string;
  quote?: string;
  src: SrcKey | SrcKey[];
}

export interface Turn { t: string; who: 'p' | 'obs'; line: string | null; ctx?: string; choices: Choice[] }

export interface Session {
  id: string;
  code: string;
  kind: string;
  name: string;
  role: string;
  product: string;
  goal: string;
  setup: string;
  place: string;
  room: 'truck' | 'clinic' | 'bank' | 'lab';
  /** Cast id for portrait, voice and the NPC who starts it; defaults to id. */
  who?: string;
  mode?: 'workshop';
  /** No star unless these insights were unlocked this run. */
  mustFind?: string[];
  /** Problem statement this visit serves, shown in the intro. */
  problem?: string;
  /** Results heading for workshop insight walls. */
  wallTitle?: string;
  observer?: string;
  skills: string[];
  greet: string;
  /** Workshops omit leave; customers who walk out need it. */
  leave?: string;
  insights: Record<string, string>;
  turns: Turn[];
}

export const sessionWho = (s: Session) => s.who ?? s.id;

/** What happens when the choice timer runs out and the turn has no silent option. */
export const SILENCE: Choice = {
  v: 'ok', tag: 'Silence', silent: true, say: '[You say nothing. The pause stretches on.]', ins: 2, bias: 0, mood: 'neutral',
  reply: '(waits for you to go on)',
  note: 'Silence is a real tool, and counting to 10 is a safe default when you’re unsure. Here, though, a short neutral prompt would have taught you more.',
  src: 'talking',
};

export const maxIns = (s: Session) => s.turns.reduce((t, tu) => t + Math.max(...tu.choices.map((c) => c.ins)), 0);

export const ROSA: Session = {
    id: 'rosa', code: 'P2', kind: 'User interview', room: 'truck',
    who: 'rosa', name: 'Rosa', role: 'Runs a taco truck · 6 years',
    product: 'StockPot, an inventory app for food trucks',
    goal: 'What makes food-truck owners abandon StockPot?',
    setup: 'Rosa signed up for StockPot last year and has barely opened it since spring. There’s no design to test today. You’re here to learn about her world.',
    place: 'Taco truck · Market',
    skills: ['Start easy', 'Open-ended questions', 'Specific past events', 'Probing', 'No leading or hypothetical questions'],
    greet: 'You’re the researcher? I’ve got about 25 minutes before the lunch rush.',
    leave: 'Sorry, I need to get back to the truck. Lunch rush.',
    problem: KICKOFF_STATEMENT,
    insights: {
      r1: 'Counts stock at 5:30 a.m. in a dim walk-in fridge, phone in one hand',
      r2: 'Scanner can’t read barcodes in low light. Back to a paper clipboard since March',
      r3: 'Wears gloves while counting. Every tap means pulling one off',
      r4: 'Auto-reorder fired twice: 40 extra lbs of avocados. Stopped trusting alerts',
      r5: '“Reorder confirmed” is tiny gray text. She never saw it and blamed herself',
      r6: 'The clipboard is shared. Her cousin reads it on the late shift',
    },
    turns: [
      { t: '00:00:30', who: 'p', line: 'Hi! So, what is this exactly? Am I being tested or something?', choices: [
        { v: 'best', tag: 'Start easy', say: 'Not at all. We’re learning how food-truck owners keep track of supplies, so we can improve StockPot. There are no wrong answers, and you can skip anything. To start, tell me a bit about yourself.', ins: 8, bias: 0, mood: 'open',
          reply: 'Okay, good. Well, I’ve run Tacos Lupita for six years. Me, my cousin, one truck, two markets a week.',
          note: 'You explained the purpose and how her answers will be used, spoke to her worry, then opened with an easy, broad question. Starting easy puts people at ease before the harder questions.', src: 'interviews' },
        { v: 'bad', tag: 'Sales pitch', say: 'Not at all! We just launched an awesome StockPot update and we’d love to hear how much it’s helping you.', ins: 0, bias: 20, mood: 'neutral',
          reply: 'Oh. Um, sure, it’s... yeah, it’s great.',
          note: 'Framing the session around how much she likes the product signals the answer you want. People bend their answers toward what they think you want to hear.', quote: '“Treat user interviews like a research study, not an informal chat.”', src: ['interviews', 'firstrule'] },
        { v: 'bad', tag: 'Rapid closed questions', say: 'Quick basics first: how old are you, how many trucks do you run, and do you have employees?', ins: 2, bias: 0, mood: 'guarded',
          reply: 'Thirty-four. One. Sort of, my cousin.',
          note: 'A rapid run of factual closed questions is a common beginner error. It feels like filling out a form, and you get one-word answers. Facts like these belong in the screener, and a broad opener like “Tell me a bit about yourself” covers the rest.', src: ['open', 'mistakes'] },
        { v: 'bad', tag: 'Opener that assumes', say: 'Fun icebreaker: what’s the last cookbook you read?', ins: 1, bias: 0, mood: 'guarded',
          reply: 'Uh... I don’t really read cookbooks? Is that bad?',
          note: 'The question assumes she reads cookbooks. Openers that assume or judge can make people feel stupid right at the start. Keep early questions easy and neutral.', src: 'interviews' },
      ] },
      { t: '00:02:10', who: 'p', line: 'So yeah, mornings are the worst. Between the commissary kitchen and the market, I’m juggling a lot.', choices: [
        { v: 'best', tag: 'Ask about a specific time', say: 'Walk me through yesterday morning, starting from when you woke up.', ins: 12, bias: 0, mood: 'open', unlock: 'r1',
          reply: 'Yesterday? Alarm at five. I’m in the walk-in by 5:30. It’s freezing and kind of dark in there, and I’m counting tortillas with my phone in one hand.',
          note: 'A specific, recent event jogs memory and brings out details people skip when they describe a general routine.', src: ['interviews', 'mistakes'] },
        { v: 'ok', tag: 'Asked about “normally”', say: 'How do you normally manage your mornings?', ins: 4, bias: 0, mood: 'neutral',
          reply: 'I just kind of get it done, you know? Prep, load up, go.',
          note: 'It’s open-ended, which is good, but questions about typical behavior get generalizations. Asking about one specific time gets the details.', src: 'mistakes' },
        { v: 'bad', tag: 'Leading question', say: 'Sounds stressful! That’s exactly what StockPot’s morning checklist is for, right?', ins: 0, bias: 18, mood: 'neutral',
          reply: 'Right, yeah. The checklist. Sure.',
          note: 'It assumes her feeling (“stressful”) and suggests the answer. With leading questions, people mimic your words instead of telling you what happened.', quote: 'Respondents “simply mimic the words of the interviewer.”', src: 'leading' },
        { v: 'bad', tag: 'Closed question', say: 'Do you use StockPot in the morning?', ins: 1, bias: 0, mood: 'neutral',
          reply: 'Yes.',
          note: 'A yes/no question stops the conversation. With closed questions, what you expect is what you get.', src: 'open' },
      ] },
      { t: '00:06:45', who: 'p', line: 'Honestly, the counting part is where it all falls apart. I kind of gave up on the app for that.', choices: [
        { v: 'best', tag: 'Echo', say: 'Gave up on it?', ins: 13, bias: 0, mood: 'open', unlock: 'r2',
          reply: 'Yeah. The scanner can’t read barcodes in the walk-in. Too dark. So in March I went back to a clipboard and a pen. Old school.',
          note: 'Repeating her own words invites her to keep going without suggesting a cause. Echoing the participant also builds rapport.', src: ['talking', 'interviews'] },
        { v: 'bad', tag: 'Leading “because”', say: 'Did you give up because the barcode scanner is too slow?', ins: 2, bias: 16, mood: 'neutral',
          reply: 'Yeah... I guess it’s slow, sure.',
          note: 'A clarifying question with “because” slips in your own interpretation, and people often just agree with it. You’d leave thinking speed was the problem.', src: 'mistakes' },
        { v: 'bad', tag: 'Compound question', say: 'Oh no! Which feature failed, what should we have built instead, and would you come back if we fixed it?', ins: 2, bias: 4, mood: 'confused',
          reply: 'Um. Which part do you want first?',
          note: 'Compound questions strain working memory. Ask one short question, then use probes for the rest.', src: 'mistakes' },
        { v: 'bad', tag: 'Defended the product', say: 'That’s surprising. Most of our customers love the counting feature.', ins: 0, bias: 14, mood: 'guarded',
          reply: 'Oh. Well, maybe it’s just me then.',
          note: 'Defending the product tells her the “right” answer and invites social-desirability bias. Your job is to understand her experience, not win the point.', src: ['interviews', 'firstrule'] },
      ] },
      { t: '00:09:20', who: 'p', line: 'I’d probably use it more if it had, like, voice input. Wouldn’t that be cool?', choices: [
        { v: 'best', tag: 'Ask about a real moment', say: 'Tell me about the last time you wished you could talk to the app instead.', ins: 13, bias: 0, mood: 'open', unlock: 'r3',
          reply: 'Every morning! I wear gloves in the fridge. To tap the phone I have to pull one off, and then my hand’s wet and freezing.',
          note: 'A feature request is a guess at a solution. Asking about a real moment uncovers the need behind it: gloves and cold hands, not voice for its own sake.', quote: '“Users do not know what they want.”', src: ['firstrule', 'mistakes'] },
        { v: 'bad', tag: 'Hypothetical', say: 'Totally! If we built voice input, how often would you use it?', ins: 1, bias: 12, mood: 'open',
          reply: 'Oh, all the time. Every day for sure.',
          note: 'People are bad at predicting their future behavior. Don’t believe what people say they do, and definitely don’t believe what they predict they’ll do.', src: ['firstrule', 'mistakes'] },
        { v: 'ok', tag: 'Took the request', say: 'Great idea. I’ll write that down as a feature request.', ins: 3, bias: 2, mood: 'neutral',
          reply: 'Cool. Okay.',
          note: 'Logging the request is harmless, but you stopped there. Probe for the situation that made her want it.', src: 'firstrule' },
        { v: 'ok', tag: 'Probed the solution', say: 'What makes voice input appealing to you?', ins: 7, bias: 0, mood: 'neutral',
          reply: 'I don’t know, it just seems easier? Hands-free.',
          note: 'A probe beats accepting the idea, but it keeps the talk on her proposed solution. A question about a specific past moment gets closer to the real need.', src: 'mistakes' },
      ] },
      { t: '00:13:05', who: 'p', line: 'Ugh, and then there was the whole thing with the avocado order last month. Anyway.', choices: [
        { v: 'best', tag: 'Probe', say: 'Can you tell me more about the avocado order?', ins: 13, bias: 0, mood: 'open', unlock: 'r4',
          reply: 'So the app auto-reorders when you’re low, right? It fired twice. I got forty extra pounds of avocados. Forty! I don’t trust the alerts at all now.',
          note: 'She dropped a lead and tried to move on. “Tell me more about that” and “Can you expand on that?” are the probes to reach for.', src: 'interviews' },
        { v: 'bad', tag: 'Stuck to the script', say: 'Okay! Next on my list: how do you feel about our new color scheme?', ins: 0, bias: 6, mood: 'neutral',
          reply: 'The colors? They’re fine, I guess.',
          note: 'The interview guide is flexible. Follow up on what the participant brings up instead of marching through your list, and don’t point her at design details she didn’t mention.', src: ['interviews', 'funnel'] },
        { v: 'bad', tag: 'Leading closed question', say: 'Was the avocado order a frustrating experience?', ins: 3, bias: 8, mood: 'neutral',
          reply: 'Yeah. It was frustrating.',
          note: 'Questions that start with “was,” “did” or “is” are often leading closed questions. “How did you feel about that?” leaves room for her own words.', src: 'open' },
        { v: 'bad', tag: 'Talked over her', say: 'Oh, I know, that’s the double-reorder bug. Engineering fixed it last week, so you’re all set.', ins: 0, bias: 4, mood: 'guarded',
          reply: 'Oh. Okay then.',
          note: 'Explaining the bug ended her story before you heard it, including how it changed her trust in the app. Don’t interrupt or rush participants.', src: 'interviews' },
      ] },
      { t: '00:18:40', who: 'p', line: 'And I just felt kind of stupid, you know? Like I should have caught it.', ctx: 'She stops. A long pause.', choices: [
        { v: 'best', tag: 'Let the pause work', silent: true, say: '[Nod, say “mm-hmm,” and wait.]', ins: 12, bias: 0, mood: 'open', unlock: 'r5',
          reply: 'I mean, the app did say “Reorder confirmed.” In tiny gray text at the bottom. I never even saw it.',
          note: 'Neutral acknowledgments and nodding build rapport without steering. Your silence gave her room to fill in what actually happened.', src: 'interviews' },
        { v: 'ok', tag: 'Filled the pause', say: 'Don’t feel stupid! That’s totally on us, honestly. Everyone does that.', ins: 4, bias: 4, mood: 'neutral',
          reply: 'Ha, okay. Thanks.',
          note: 'Kind, but you filled the pause and the story stopped. Rapport isn’t friendship: the user does not have to like you. Let the pause do the work.', src: 'interviews' },
        { v: 'bad', tag: 'Supplied a rationalization', say: 'So you’d have caught it if the confirmation were bigger?', ins: 2, bias: 14, mood: 'neutral',
          reply: 'Yeah, probably. If it were bigger.',
          note: 'You handed her a rationalization to agree with. “I would have seen it if it were bigger” is the classic example of a self-report that’s removed from what really happened.', quote: 'Self-reports are “typically 3 steps removed from the truth.”', src: 'firstrule' },
        { v: 'bad', tag: 'Rushed her', say: 'Okay. Let’s move on to pricing.', ins: 0, bias: 0, mood: 'guarded',
          reply: 'Sure.',
          note: 'Cutting a pause short just as someone is about to say more loses the detail. Avoid rushing participants.', src: 'interviews' },
      ] },
      { t: '00:24:00', who: 'p', line: 'I’ll definitely come back to the app if you fix the scanner. Definitely.', choices: [
        { v: 'best', tag: 'Ask about behavior', say: 'Thanks. You mentioned the clipboard. What does it do for you that the app doesn’t?', ins: 12, bias: 0, mood: 'open', unlock: 'r6',
          reply: 'My cousin closes on the late shift. He reads the clipboard on the wall and knows what’s left. The app’s on my phone, so he can’t see it.',
          note: 'A promise about future use isn’t data. Her current workaround is. Focus on what people actually do.', src: ['firstrule', 'interviews'] },
        { v: 'bad', tag: 'Believed a prediction', say: 'Great! I’ll tell the team you’ll definitely come back.', ins: 0, bias: 6, mood: 'open',
          reply: 'Yep!',
          note: 'Predictions about future behavior are the least reliable thing a participant can tell you.', src: 'firstrule' },
        { v: 'bad', tag: 'Scored a prediction', say: 'On a scale of 1 to 10, how likely are you to come back?', ins: 2, bias: 2, mood: 'neutral',
          reply: 'A nine?',
          note: 'A number makes a prediction look precise, but it’s still a prediction. Ask about current and past behavior instead.', src: 'firstrule' },
      ] },
    ],
};

export const THEO: Session = {
    id: 'theo', code: 'P3', kind: 'Usability test', room: 'clinic',
    who: 'theo', name: 'Theo', role: 'Dog owner · first visit to the site',
    product: 'PawPoint, a vet clinic’s booking website',
    goal: 'Can new customers book a checkup on their own?',
    setup: 'Theo has never used PawPoint. The site is on the laptop, and your job is to give a realistic task and then watch. Every word you say can change what he does.',
    place: 'PawPoint Vet Clinic',
    skills: ['Think-aloud', 'Echo', 'Boomerang', 'Columbo', 'Knowing when to stay quiet', 'Funnel your follow-ups'],
    greet: 'Hi! I’m here for the website thing? I’ve got my dog’s info ready.',
    leave: 'I think I’m going to head out. This doesn’t feel like it’s going anywhere.',
    problem: 'New customers try to book a checkup on PawPoint’s site, and many end up calling the clinic instead. We don’t know where they get stuck.',
    insights: {
      t1: '“Wellness Plan” (a subscription) reads as a one-time checkup',
      t2: 'Expects forced sign-up before booking. Would call the clinic instead',
      t3: 'Doesn’t trust the Back button. Copies form text into Notes first',
      t4: 'Date picker opens on this month. Clicked “Next” four times to find a slot',
      t5: 'Unsure the booking worked: no mention of an email or confirmation number',
      t6: 'The required phone-number field dragged his rating down (fear of spam calls)',
    },
    turns: [
      { t: '00:00:40', who: 'p', line: 'Okay, I’m ready. Do you want me to just, like, use it?', choices: [
        { v: 'best', tag: 'Set up think-aloud', say: 'Yes. As you go, say whatever you’re thinking: what you’re looking for, what you expect, anything that surprises you. Here’s the scenario: your dog is due for a checkup. See if you can set that up on this site.', ins: 10, bias: 0, mood: 'open',
          reply: 'Got it, talk out loud. Okay. So, PawPoint... I’m looking for something about appointments.',
          note: 'Thinking aloud is unnatural, so ask for it plainly. The task is realistic and broad, and it doesn’t use the site’s own labels.', src: ['thinkaloud', 'funnel'] },
        { v: 'bad', tag: 'Gave the answer', say: 'Yep. Click “Book Now” in the top right, then choose “Wellness Exam” from the drop-down.', ins: 1, bias: 25, mood: 'neutral',
          reply: 'Okay... Book Now... Wellness Exam. Done?',
          note: 'Naming interface elements and giving steps tests whether he can follow directions, not whether the site works. Start with broad tasks. Directed tasks prime users.', src: ['leading', 'funnel'] },
        { v: 'bad', tag: 'Set expectations', say: 'Yes! It’s super easy, you’ll fly through it.', ins: 2, bias: 12, mood: 'neutral',
          reply: 'Ha, okay, no pressure.',
          note: 'Calling it easy suggests the answer and makes struggling feel like his fault, so he’s less likely to admit to it.', src: 'leading' },
        { v: 'ok', tag: 'No think-aloud request', say: 'Sure, go ahead whenever you’re ready.', ins: 3, bias: 0, mood: 'neutral',
          reply: '(clicks around quietly)',
          note: 'Without a request to think aloud, most people work silently and you lose the “why.” Facilitators usually have to prompt, and a short demo helps.', src: 'thinkaloud' },
      ] },
      { t: '00:02:15', who: 'p', line: null, ctx: 'Theo has gone quiet. He’s been scrolling up and down the homepage for about 20 seconds.', choices: [
        { v: 'best', tag: 'Neutral prompt', say: 'What are you thinking?', ins: 9, bias: 0, mood: 'open',
          reply: 'Sorry, yeah. I’m looking for “appointments” or “book.” I see Wellness Plan, Shop, Pharmacy... nothing that says checkup.',
          note: 'People fall silent while thinking aloud. A short, open, neutral prompt gets them talking again without suggesting anything.', src: ['thinkaloud', 'open'] },
        { v: 'bad', tag: 'Named the UI', say: 'Are you looking for the booking button?', ins: 2, bias: 14, mood: 'neutral',
          reply: 'Oh, is there a booking button? Where?',
          note: 'Naming an element tells him what exists and what to look for. Now you can’t learn whether he would have found it.', src: 'leading' },
        { v: 'bad', tag: 'Offered help', say: 'You seem lost. Want a hint?', ins: 0, bias: 18, mood: 'guarded',
          reply: 'Uh, I’m fine. I think.',
          note: 'Don’t assume you know how he feels, and don’t help. A poorly run test, with leading questions or a facilitator who helps participants, can produce misleading results.', src: ['leading', 'u101'] },
        { v: 'ok', tag: 'Total silence', silent: true, say: '[Decide to stay completely silent for the rest of the session.]', ins: 2, bias: 0, mood: 'neutral',
          reply: '(keeps scrolling, silently)',
          note: 'Talk less, yes, but staying completely silent is “not an advanced facilitation practice.” Prompt when a participant stops thinking aloud.', src: 'talking' },
      ] },
      { t: '00:04:30', who: 'p', line: 'Huh. “Wellness Plan”... is that the same as a checkup? This is kind of weird, I’m not sure what, uh...', choices: [
        { v: 'best', tag: 'Echo', say: 'Not sure what?', ins: 12, bias: 0, mood: 'open', unlock: 't1',
          reply: 'Not sure what I’d be signing up for. It says “from $29 a month.” I just want one visit, not a subscription. But maybe that’s how they do checkups?',
          note: 'Echo: repeat his last words with a slight question in your voice. Using his exact words avoids suggesting anything about the interface.', src: 'talking' },
        { v: 'bad', tag: 'Explained the UI', say: 'The Wellness Plan is a monthly subscription. Single checkups are under “Services.”', ins: 1, bias: 22, mood: 'neutral',
          reply: 'Oh! Okay, Services. Got it.',
          note: 'You answered for him and taught him the site. You learned nothing about how a real customer would get unstuck.', src: ['talking', 'u101'] },
        { v: 'bad', tag: 'Leading closed question', say: 'Do you find that label confusing?', ins: 3, bias: 10, mood: 'neutral',
          reply: 'Yeah, kind of confusing.',
          note: 'A yes/no question that suggests its own answer. He picked up your word, “confusing,” instead of describing what he thought.', src: ['open', 'leading'] },
        { v: 'ok', tag: 'Count to 10', silent: true, say: '[Count to 10 silently.]', ins: 7, bias: 0, mood: 'neutral',
          reply: '...I’m not sure what I’d be signing up for. I’ll keep looking.',
          note: 'When in doubt, count to 10. It’s the safe default, and he kept going. An echo would have drawn out a bit more right then.', src: 'talking' },
      ] },
      { t: '00:07:10', who: 'p', line: 'Do I have to make an account to book this?', choices: [
        { v: 'best', tag: 'Boomerang', say: 'What do you think?', ins: 12, bias: 0, mood: 'open', unlock: 't2',
          reply: 'Probably? Every site makes you. Honestly, if it asks for a password I’d just call the clinic.',
          note: 'Boomerang: bounce the question back with a neutral prompt. At home he’d have to work it out alone, so let him do it here.', src: 'talking' },
        { v: 'bad', tag: 'Answered (vaguely)', say: 'Erm. I guess so.', ins: 1, bias: 12, mood: 'neutral',
          reply: 'Okay, I’ll look for the sign-up then.',
          note: 'Even a hesitant answer steers him. The article calls out “Erm. I guess so” by name.', src: 'talking' },
        { v: 'bad', tag: 'Answered (helpfully)', say: 'No, that’s okay, you can book as a guest.', ins: 1, bias: 18, mood: 'open',
          reply: 'Oh nice, guest. Where’s that?',
          note: 'Answering removes the very obstacle you need to observe. Now you’ll never know he’d have given up and phoned.', src: 'talking' },
        { v: 'bad', tag: 'Nervous chatter', say: 'Great question! Lots of people ask that. So basically, accounts let you save your pet’s records, and there’s also a guest flow, which we added because...', ins: 0, bias: 16, mood: 'confused',
          reply: 'Oh. Okay, cool.',
          note: 'Nervous chatter is a common facilitator mistake. Talk less and learn more.', src: 'talking' },
      ] },
      { t: '00:10:00', who: 'p', line: 'If I hit Back here, will I lose everything I typed?', choices: [
        { v: 'best', tag: 'Columbo', say: 'Hm, you’re wondering if... [pause] you might...', ins: 12, bias: 0, mood: 'open', unlock: 't3',
          reply: '...lose the dog’s info. Yeah. I’m going to copy it into my Notes app first, just in case. I’ve been burned before.',
          note: 'Columbo: ask part of a question and trail off. Fewer words means less chance of teaching or swaying him, and the pause prompts him to finish the thought.', quote: '“Be smart but don’t act that way.”', src: 'talking' },
        { v: 'bad', tag: '“Try it”', say: 'Try it.', ins: 3, bias: 8, mood: 'neutral',
          reply: 'Okay... oh, it kept it. Cool.',
          note: '“Try it” nudges him toward an action he might not have taken. The article lists it as a phrase to avoid.', src: 'talking' },
        { v: 'bad', tag: 'Reassured him', say: 'I don’t think so.', ins: 1, bias: 12, mood: 'open',
          reply: 'Okay, good.',
          note: 'You removed the worry you needed to observe. “I don’t think so” is on the article’s list of things not to say.', src: 'talking' },
        { v: 'bad', tag: '“I’m not sure”', say: 'I’m not sure.', ins: 2, bias: 6, mood: 'neutral',
          reply: 'Hm. Okay.',
          note: 'It sounds neutral, but it’s still an answer, and it signals that you’re the one to ask. The article lists this one too.', src: 'talking' },
      ] },
      { t: '00:12:30', who: 'p', line: 'Ugh, why is this date picker so...', ctx: 'He trails off and keeps clicking the arrow to the next month.', choices: [
        { v: 'best', tag: 'Watch, don’t talk', silent: true, say: '[Stay quiet and take notes. Let him keep working.]', ins: 11, bias: 0, mood: 'neutral', unlock: 't4',
          reply: '(clicks “Next month” four times, finds a Tuesday slot, selects it)',
          note: 'Ask yourself: was that a real question, or thinking aloud? Will probing add value, or does watching tell you enough? Here, watching showed you exactly what happened.', src: ['talking', 'firstrule'] },
        { v: 'bad', tag: 'Leading “why”', say: 'Why did you have difficulty with the date picker?', ins: 3, bias: 14, mood: 'guarded',
          reply: 'I mean, I wasn’t having that much difficulty...',
          note: 'It names an element, assumes difficulty, and blames him. After the task, try “What was easy or difficult about...” instead.', src: 'leading' },
        { v: 'bad', tag: 'Joined in', say: 'Ha, right? Everyone hates that date picker.', ins: 1, bias: 16, mood: 'open',
          reply: 'Ha, yeah. It’s the worst.',
          note: 'Agreeing with a complaint tells him what you think, and he’ll echo your view from now on. Leading can change behavior for the rest of the session.', src: 'leading' },
        { v: 'bad', tag: 'Broke his flow', say: 'Hold on. Before you go on, tell me about every date picker you’ve ever used.', ins: 2, bias: 4, mood: 'confused',
          reply: 'Uh... every one? I don’t know. Calendars?',
          note: 'He was making progress. Interrupting his flow for a tangent costs you the natural behavior you came to see.', src: 'talking' },
      ] },
      { t: '00:15:00', who: 'p', line: 'Okay. I think I booked it? Yeah. Done.', choices: [
        { v: 'best', tag: 'Broad first', say: 'Do you have any thoughts about doing that on the website?', ins: 12, bias: 0, mood: 'open', unlock: 't5',
          reply: 'I think it worked? It says “Request received,” but nothing about an email or a confirmation number. I’d probably call to check.',
          note: 'Funnel your follow-ups: start broad, then narrow. Unprompted feedback is more likely to be his true opinion.', src: 'funnel' },
        { v: 'bad', tag: 'Leading closed question', say: 'Was it easy?', ins: 2, bias: 10, mood: 'open',
          reply: 'Yeah, pretty easy.',
          note: '“Was it easy?” suggests the answer you’d like. Try “How did you find that task?”', src: 'open' },
        { v: 'bad', tag: 'Named the UI', say: 'Did you notice the “Same-day” badge on the calendar?', ins: 1, bias: 12, mood: 'neutral',
          reply: 'Oh. No? Should I have?',
          note: 'Asking about a specific element first primes him, and he may make up an opinion on the spot. “Did you see the filters on the left?” is the article’s own example of what not to ask.', src: ['funnel', 'talking'] },
        { v: 'ok', tag: 'Too narrow, too soon', say: 'What did you think about the date picker specifically?', ins: 5, bias: 2, mood: 'neutral',
          reply: 'It was a bit slow to get to the right month, I guess.',
          note: 'A fair question, but it belongs after the broad ones. Starting narrow risks missing what mattered most to him.', src: 'funnel' },
      ] },
      { t: '00:16:20', who: 'p', line: 'Overall? I mean, it was fine. I’d give it a 7. Is that good?', choices: [
        { v: 'best', tag: 'Neutral probe', say: 'There are no right answers here. What made it a 7 for you?', ins: 11, bias: 0, mood: 'open', unlock: 't6',
          reply: 'The phone-number field. It’s required, and I hate getting spam calls. That’s what knocked it down.',
          note: 'He’s looking for approval. Stay neutral, then probe the reason behind the number.', src: ['open', 'interviews'] },
        { v: 'bad', tag: 'Praised the score', say: 'A 7 is great, thanks so much!', ins: 1, bias: 6, mood: 'open',
          reply: 'Oh good.',
          note: 'Praising the score tells him what you want to hear, and you lose the reason behind it.', src: 'firstrule' },
        { v: 'bad', tag: 'Assumed negative', say: 'Only a 7? What was wrong with it?', ins: 4, bias: 8, mood: 'guarded',
          reply: 'Nothing was wrong, really. It was fine.',
          note: 'This assumes his feelings and puts him on the defensive.', src: 'leading' },
        { v: 'bad', tag: 'Hypothetical', say: 'Would you give it a 9 if we fixed the date picker?', ins: 1, bias: 12, mood: 'neutral',
          reply: 'Sure, maybe a 9.',
          note: 'A hypothetical with a suggested answer. You learn nothing about what actually drove his rating.', src: ['mistakes', 'leading'] },
      ] },
    ],
};

export const PRIYA: Session = {
    id: 'priya', code: 'P4', kind: 'Design review', room: 'bank',
    who: 'priya', name: 'Priya', role: 'Owns a design studio · banks on her phone',
    product: 'Kite, a mobile banking app with two new homepage designs',
    goal: 'Which homepage design should we ship?',
    setup: 'Priya is trying Design A and Design B. Jordan, the product lead, watches from behind the mirror and slips you notes. This round is about what to trust: what people say, or what they do.',
    place: 'Kite Bank',
    observer: 'Jordan',
    skills: ['Watch what people do', 'Preference only after use', 'Test 5 users, then iterate', 'Self-reports are 3 steps removed'],
    greet: 'Hi! Two designs, right? Let’s see them.',
    leave: 'I’m sorry, I have a client call. I need to go.',
    problem: 'Kite customers tap around the homepage before they find everyday tasks like sending money. The team has two redesigns and needs to know which one works better.',
    insights: {
      p1: 'Design A: about 3× longer to find “Send money,” with two wrong taps',
      p2: 'She prefers A but performed better on B. Preference ≠ performance',
      p3: 'Checks client payments in bed at night. Bright screen makes her put it off',
      p4: 'Fact: she didn’t see “Split bill.” “Make it bigger” is a hypothesis',
      p5: 'Said she “never” uses search. Opened it twice in today’s session',
    },
    turns: [
      { t: '00:00:20', who: 'obs', line: 'We’ve only got 20 min with Priya. Just show her A and B side by side and ask which she prefers. Easy!', choices: [
        { v: 'best', tag: 'Use first, ask later', say: 'Let’s have her do the same real task on each design first, then ask what she thinks.', ins: 10, bias: 0,
          reply: 'Fine. Sending money to a friend?',
          note: 'Ask people which design they prefer before they’ve used it, and they react to surface features. Collect preference data only after people have tried the design.', src: 'firstrule' },
        { v: 'bad', tag: 'Asked for preference', say: 'Sure. Priya, which one looks better to you?', ins: 2, bias: 12, rwho: 'p', mood: 'open',
          reply: 'Ooh, A. The spinning logo is so fun.',
          note: 'Showing a few designs and asking which one people prefer is the method the article calls “Wrong.” She hasn’t tried to use either one.', src: 'firstrule' },
        { v: 'bad', tag: 'Survey instead', say: 'Let’s skip the session and send a survey to all our customers instead.', ins: 1, bias: 4,
          reply: 'Huh. Quicker, I guess.',
          note: 'Online surveys are unreliable. People who answer before using a site give irrelevant answers, and many who have used it leave without answering.', src: 'firstrule' },
        { v: 'bad', tag: 'Wish list', say: 'Let’s ask her which features she wants us to build next.', ins: 2, bias: 4,
          reply: 'Ooh, a wish list. Love it.',
          note: 'A wish list reflects guesses, not needs.', quote: '“Users do not know what they want.”', src: 'firstrule' },
      ] },
      { t: '00:03:00', who: 'p', line: 'Oh, I love this spinning logo. So fun.', ctx: 'Design A is on screen. Before starting the task, Priya smiles at the homepage.', choices: [
        { v: 'best', tag: 'Redirect', say: 'Go ahead with the task whenever you’re ready.', ins: 11, bias: 0, mood: 'neutral', unlock: 'p1',
          reply: 'Okay, send $40 to a friend... Where is... is it under Cards? No. More? (taps Cards, backs out, taps More, then finds Pay & transfer)',
          note: 'Sometimes the best question is no question. A light redirect keeps her on the task, so you see how the design works in use.', src: 'leading' },
        { v: 'ok', tag: 'Probed the logo', say: 'Tell me more about the logo.', ins: 3, bias: 2, mood: 'open',
          reply: 'It’s just cool. It spins! Feels modern.',
          note: 'Probing usually helps, but here it spends your short session on a surface feature. A spinning logo looks cool when nothing needs doing.', src: 'firstrule' },
        { v: 'bad', tag: 'Locked in a preference', say: 'So you prefer Design A already?', ins: 1, bias: 14, mood: 'open',
          reply: 'Yeah, I think so!',
          note: 'Now she’s committed to a preference before trying the design, and she may defend it for the rest of the session.', src: ['leading', 'firstrule'] },
      ] },
      { t: '00:09:30', who: 'obs', line: 'She prefers A! Let’s ship A.', ctx: 'Priya finished Design B in 40 seconds with no wrong taps. Design A took about two minutes and two wrong taps. Then she said: “I definitely prefer A. B is kind of boring.”', choices: [
        { v: 'best', tag: 'Weigh behavior', say: 'Let’s note her preference, but weigh what she did: she finished B faster with no errors. Her behavior counts more than her opinion.', ins: 13, bias: 0, unlock: 'p2',
          reply: 'Huh. Okay, I hadn’t looked at it that way.',
          note: 'Across 113 comparisons, the correlation between how well people did with a design and how much they said they liked it was only 0.44.', quote: '“Pay attention to what users do, not what they say.”', src: 'firstrule' },
        { v: 'bad', tag: 'Shipped the opinion', say: 'She’s the customer. Ship A.', ins: 0, bias: 10,
          reply: 'Great, I’ll tell design.',
          note: 'Knowing how much people say they like a design predicts only about a quarter of how well it works.', src: 'firstrule' },
        { v: 'bad', tag: 'Leading “why”', say: 'Let’s ask her: “Why did you have trouble with the Send button on A?”', ins: 3, bias: 12, rwho: 'p', mood: 'guarded',
          reply: 'I guess I’d have seen it if it was bigger?',
          note: 'It names an element, assumes difficulty, and invites a rationalization. Better: “What was easy or difficult about sending money?”', src: 'leading' },
      ] },
      { t: '00:12:00', who: 'obs', line: 'She’s just one person though. Shouldn’t we recruit 50 people before changing anything?', choices: [
        { v: 'best', tag: 'Five, fix, repeat', say: 'To find problems, testing with about 5 representative users usually turns up many of the important issues. Then we fix them and test again.', ins: 10, bias: 0,
          reply: 'Five? Okay, that I can schedule.',
          note: 'For qualitative testing, a small round is often enough. Test, fix, and test again, starting early.', quote: '“Testing with 5 users is often sufficient.”', src: 'u101' },
        { v: 'ok', tag: 'Overkill', say: 'Yes. Fifty minimum, or the data isn’t valid.', ins: 3, bias: 0,
          reply: 'That’s a two-month project...',
          note: 'Large samples matter when you need precise numbers (around 40 participants for quantitative metrics). For finding usability problems, small, repeated rounds work better.', src: 'u101' },
        { v: 'bad', tag: 'One is enough', say: 'No, Priya’s enough. Let’s decide now.', ins: 1, bias: 6,
          reply: 'Works for me!',
          note: 'One session is a signal, not a pattern. Recruit a few more representative users before deciding.', src: 'u101' },
        { v: 'bad', tag: 'Synthetic users', say: 'Let’s simulate 50 customers with AI. Same answers, way faster.', ins: 0, bias: 8,
          reply: 'Ooh, cheap!',
          note: 'Synthetic users and digital twins are not real customers.', quote: 'They “should not be treated as reliable substitutes for real users.”', src: 'u101' },
      ] },
      { t: '00:15:30', who: 'p', line: 'Honestly, if you added a dark mode, I’d use this app every single day.', choices: [
        { v: 'best', tag: 'Ask about a real moment', say: 'Tell me about the last time you used the app in the evening.', ins: 12, bias: 0, mood: 'open', unlock: 'p3',
          reply: 'Last night, actually. In bed, checking whether a client paid. The screen was blinding, so I just waited until morning.',
          note: '“Every single day” is a prediction. Asking about a real, recent moment shows the actual need behind the request.', src: ['firstrule', 'mistakes'] },
        { v: 'bad', tag: 'Believed a prediction', say: '[Pass Jordan a note: “Dark mode = daily use, guaranteed.”]', silent: true, ins: 0, bias: 8, rwho: 'obs',
          reply: 'Love it. Roadmap!',
          note: 'Don’t believe what people predict they’ll do. If half of survey respondents say they’d buy more with 3-D product views, that doesn’t mean you should build 3-D.', src: 'firstrule' },
        { v: 'bad', tag: 'Hypothetical', say: 'How many times a day would you use it with dark mode?', ins: 1, bias: 10, mood: 'open',
          reply: 'Oh, like, five? Ten?',
          note: 'Hypothetical questions ask people to predict their future behavior, and people are bad at that.', src: 'mistakes' },
      ] },
      { t: '00:19:00', who: 'p', line: 'I would have seen the “Split bill” button if it had been bigger.', choices: [
        { v: 'best', tag: 'Record the fact', silent: true, say: '[Note the observed fact: she didn’t see “Split bill.” Treat “make it bigger” as one idea to test.]', ins: 12, bias: 0, mood: 'neutral', unlock: 'p4',
          reply: '(nods, and moves on to the next task)',
          note: 'People rationalize. The only fact here is that she didn’t see the button. Self-reports pass through three filters: wanting to please, faulty memory, and rationalizing.', quote: 'Self-reports are “typically 3 steps removed from the truth.”', src: 'firstrule' },
        { v: 'bad', tag: 'Took the fix', say: 'Got it, we’ll make it bigger.', ins: 2, bias: 6, mood: 'open',
          reply: 'Great!',
          note: 'Her explanation is a guess about her own behavior. The real cause could be placement, wording, or something else.', src: 'firstrule' },
        { v: 'bad', tag: 'Leading closed question', say: 'So bigger buttons work better for you?', ins: 1, bias: 12, mood: 'open',
          reply: 'Yes, definitely.',
          note: 'A leading closed question. She’ll agree with almost any reasonable-sounding rule you offer.', src: ['open', 'leading'] },
      ] },
      { t: '00:21:00', who: 'obs', line: 'Priya says she NEVER uses transaction search. Let’s cut it from the redesign.', choices: [
        { v: 'best', tag: 'Check behavior data', say: 'Before we cut it, let’s check what people actually do: our usage data, and today’s recording.', ins: 12, bias: 0, unlock: 'p5',
          reply: '...Huh. She opened search twice today. Once on each design.',
          note: 'Don’t believe what people say they do. To learn what users actually do, observe them or use behavioral data.', src: ['firstrule', 'interviews'] },
        { v: 'bad', tag: 'Trusted the self-report', say: 'She’d know. Cut it.', ins: 0, bias: 8,
          reply: 'Done.',
          note: 'People report what they remember, and memory is fallible. Self-reported behavior isn’t behavior.', src: 'firstrule' },
        { v: 'bad', tag: 'Pressed her', say: 'Let’s ask her again, firmly: “Are you sure you never use search?”', ins: 1, bias: 10, rwho: 'p', mood: 'guarded',
          reply: '...I mean, maybe sometimes? I don’t know.',
          note: 'Pressing makes her want to give the “right” answer, not a more accurate one.', src: ['firstrule', 'interviews'] },
      ] },
      { t: '00:24:00', who: 'obs', line: 'Last thing. Can we put a pop-up survey on the homepage asking visitors to rate the redesign?', choices: [
        { v: 'best', tag: 'Ask why they came', say: 'If we survey on the site, let’s ask the one question that works: “Why are you visiting our site today?” Ratings should come from people who’ve used the design, like at the end of test sessions.', ins: 10, bias: 0,
          reply: 'Short and useful. Fine by me.',
          note: 'On a website, “Why are you visiting our site today?” works well. Collect ratings from a captive audience at the end of testing, after they’ve used the design.', src: 'firstrule' },
        { v: 'bad', tag: 'Rated on arrival', say: 'Yes. Ask everyone to rate both designs the moment they land.', ins: 1, bias: 8,
          reply: 'On it.',
          note: 'People who answer before using a site give irrelevant answers. Collect preference after use.', src: 'firstrule' },
        { v: 'bad', tag: 'Long open survey', say: 'Let’s make it 25 open-ended questions so we get rich data.', ins: 2, bias: 0,
          reply: 'That’s... a lot of typing for them.',
          note: 'Long open-ended surveys have lower completion rates. Closed questions suit surveys. Save open-ended questions for interviews and tests.', src: 'open' },
      ] },
    ],
};

/** Played order matches STEPS without the wall. */
export const SESSIONS: Session[] = [KICKOFF, LEN, ROSA, DEFINE, IDEATE, LEN_PAPER, THEO, PRIYA, NEXT];

/** Every strong move in the game, in the order players meet them. Collected in the journal. */
export const MOVES: { tag: string; note: string; src: SrcKey | SrcKey[]; session: string }[] = (() => {
  const seen = new Set<string>();
  const out: { tag: string; note: string; src: SrcKey | SrcKey[]; session: string }[] = [];
  for (const s of SESSIONS) for (const t of s.turns) for (const c of t.choices) {
    if (c.v === 'best' && !seen.has(c.tag)) {
      seen.add(c.tag);
      out.push({ tag: c.tag, note: c.note, src: c.src, session: s.mode === 'workshop' ? s.kind : s.name });
    }
  }
  return out;
})();
