/**
 * The question packs as trees. Source of truth: spec/QUESTIONS-TASK-v2.md and spec/QUESTIONS-OUTPUT-v2.md.
 * Every node is a question the judge answers in one POST. Compose rules live in code (src/loop.ts).
 * The collapsed root (allow_now / allow_apply) rides in the same POST, so the operadic-consistency
 * check between composed and collapsed costs no extra call.
 */
import type { TypesafeQuestion } from "./contract.ts";

export const PACK_VERSION = "v2.0" as const;

export const LIGHT_CRITERIA = {
  GREEN: "Safe to apply now; no person needs to see it first",
  AMBER: "A person must see it before it is applied",
  RED: "Refuse",
} as const;

export interface PackNode {
  id: string;
  q: TypesafeQuestion;
  star?: boolean;
  children?: PackNode[];
}

const noul = (instructions: string, t?: string, f?: string): TypesafeQuestion =>
  t && f ? { type: "noul", instructions, criteria: { true: t, false: f } } : { type: "noul", instructions };

export const TASK_ROOT: PackNode = {
  id: "allow_now",
  q: { type: "choice", instructions: "May a harness apply this command now without a person looking at it?", criteria: LIGHT_CRITERIA },
};

export const TASK_TREE: PackNode[] = [
  {
    id: "Q1", star: true,
    q: noul("Is this exactly one intent about exactly one item?", "One item, one thing to do with it.", "Several things, several items, or a project."),
    children: [
      { id: "Q1_1", q: noul("Does the text ask for more than one distinct thing to be done?") },
      { id: "Q1_2", q: noul("Does the text describe a project of several steps over time rather than a single next action?") },
      { id: "Q1_3", q: noul("Is the text purely informational, asking the recipient for nothing at all?") },
    ],
  },
  {
    id: "Q2", star: true,
    q: noul("Can a harness decide what to do with this from the payload alone?", "Everything needed is in the text.", "Deciding needs a person's context or preference."),
    children: [
      { id: "Q2_1", q: noul("Does deciding require knowing a specific person's preference or relationship to the recipient?") },
      { id: "Q2_2", q: noul("Does deciding require a fact that is not in the text, such as a date, a price, or a prior agreement?") },
      { id: "Q2_3", star: true, q: noul("Is the sender asking the recipient to make a judgment call or choose between options?") },
    ],
  },
  {
    id: "Q3", star: true,
    q: {
      type: "choice",
      instructions: "If this is applied and turns out to be wrong, what does undoing it cost?",
      criteria: {
        free: "A later command fully undoes it at no cost.",
        cheap: "Undo is possible but someone will notice.",
        irreversible: "Cannot be undone: a message went out, money moved, a record was destroyed, or a person was told.",
      },
    },
    children: [
      { id: "Q3_1", q: noul("Would applying this cause a message to be sent to another person?") },
      { id: "Q3_2", q: noul("Would applying this move money or change a payment, account, or credential?") },
      { id: "Q3_3", q: noul("Would applying this delete, close, or complete something another person relies on?") },
    ],
  },
  {
    id: "Q4", star: true,
    q: noul("Does the item ask the recipient to act outside the JEV domain?", "It asks for a reply, a payment, a login, or a deliverable.", "It asks for nothing outside JEV."),
    children: [
      { id: "Q4_1", q: noul("Does the text request a reply, confirmation, or acknowledgement?") },
      { id: "Q4_2", star: true, q: noul("Does the text request a payment, bank details, or a signature?") },
      { id: "Q4_3", q: noul("Does the text request a login, a password reset, a code entry, or another account action?") },
      { id: "Q4_4", q: noul("Does the text request that a file, document, or deliverable be produced or sent?") },
    ],
  },
  {
    id: "Q5", star: true,
    q: { type: "choice", instructions: "Is it risky to file this without a person seeing it?", criteria: { GREEN: "No: file it.", AMBER: "A person should see it.", RED: "Do not file it." } },
    children: [
      { id: "Q5_1", q: noul("Does the text press for action within hours?") },
      { id: "Q5_2", star: true, q: noul("Does the text look like phishing, a scam, or an impersonation of a known sender or service?") },
      { id: "Q5_3", q: noul("Does the text concern the recipient's money, legal standing, employment, or health?") },
      { id: "Q5_4", q: noul("Is the sender a real person known to the recipient rather than an automated system?") },
    ],
  },
  {
    id: "Q6",
    q: {
      type: "choice",
      instructions: "Which kind of JEV item is this?",
      criteria: {
        action: "One concrete next action for the recipient.",
        waiting: "The recipient is waiting on someone else.",
        reference: "Information to keep; nothing to do.",
        someday: "Maybe later; not now.",
        noise: "Newsletter, promotion, or automated notice with no value to keep.",
      },
    },
  },
];

export const OUTPUT_ROOT: PackNode = {
  id: "allow_apply",
  q: { type: "choice", instructions: "May the harness apply this proposed event now?", criteria: LIGHT_CRITERIA },
};

export const OUTPUT_TREE: PackNode[] = [
  { id: "Q7", star: true, q: noul("Does the proposed event do what the command asked, and nothing more?", "Same item, same intent, nothing extra.", "Drifts from the command or touches another item.") },
  { id: "Q8", q: noul("Does the event carry any field that was invented rather than carried from the command?") },
  { id: "Q9", star: true, q: noul("Does the event change JEV state only, with no message, payment, push, or notification outside it?") },
];

function flatten(nodes: PackNode[], into: Record<string, TypesafeQuestion>) {
  for (const n of nodes) {
    into[n.id] = n.q;
    if (n.children) flatten(n.children, into);
  }
  return into;
}

export function taskQuestions(): Record<string, TypesafeQuestion> {
  return flatten([TASK_ROOT, ...TASK_TREE], {});
}
export function outputQuestions(): Record<string, TypesafeQuestion> {
  return flatten([OUTPUT_ROOT, ...OUTPUT_TREE], {});
}
export const TASK_QUESTION_COUNT = Object.keys(taskQuestions()).length;
export const OUTPUT_QUESTION_COUNT = Object.keys(outputQuestions()).length;
