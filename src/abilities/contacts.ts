import { applyCollisionPenalty, type RacerEffects } from "./abilityState";
import { clampDt } from "./clock";
import type { TurtleMotion } from "../movement/stepTurtle";

/** Driftwood and shell piles. Touching one is a collision penalty. */
export const debrisLayout = [
  { id: "driftwood", x: 3.1, z: -14, radius: 0.55 },
  { id: "shell-cluster", x: -2.4, z: 6, radius: 0.5 },
  { id: "kelp", x: 2.8, z: 22, radius: 0.5 },
] as const;

export const bodyRadius = 0.55;
export const rivalBumpDistance = 0.95;
/** One overlap is one hit. The same pile cannot strike again until this pause ends. */
export const contactLockout = 0.9;

export interface ContactBook {
  lockout: Readonly<Record<string, number>>;
}

export function createContactBook(): ContactBook {
  return { lockout: {} };
}

export function stepContactBook(book: ContactBook, dt: number): ContactBook {
  const step = clampDt(dt);
  const lockout: Record<string, number> = {};
  for (const [id, remaining] of Object.entries(book.lockout)) {
    const next = remaining - step;
    if (next > 0) {
      lockout[id] = next;
    }
  }
  return { lockout };
}

export interface CollisionBody {
  id: string;
  motion: TurtleMotion;
  effects: RacerEffects;
}

function contactOpen(book: ContactBook, id: string): boolean {
  return (book.lockout[id] ?? 0) <= 0;
}

function armContact(book: ContactBook, id: string): ContactBook {
  if (!contactOpen(book, id)) {
    return book;
  }
  return { lockout: { ...book.lockout, [id]: contactLockout } };
}

/**
 * Debris and the rival bump are separate hits.
 * A shell that stops the first one is down for the next one, even in the same moment.
 */
export function resolveCollisions(
  player: CollisionBody,
  rival: CollisionBody,
  book: ContactBook,
): { player: CollisionBody; rival: CollisionBody; book: ContactBook; blocked: boolean; bumped: boolean } {
  let nextBook = book;
  let nextPlayer: CollisionBody = { ...player, motion: { ...player.motion }, effects: { ...player.effects } };
  let nextRival: CollisionBody = { ...rival, motion: { ...rival.motion }, effects: { ...rival.effects } };
  let blocked = false;
  let bumped = false;

  const strike = (body: CollisionBody, key: string): CollisionBody => {
    if (!contactOpen(nextBook, key)) {
      return body;
    }
    const hit = applyCollisionPenalty(body.motion, body.effects);
    nextBook = armContact(nextBook, key);
    blocked = blocked || hit.blocked;
    bumped = bumped || !hit.blocked;
    return { ...body, motion: hit.motion, effects: hit.effects };
  };

  for (const debris of debrisLayout) {
    const reach = debris.radius + bodyRadius;
    if (Math.hypot(nextPlayer.motion.x - debris.x, nextPlayer.motion.z - debris.z) <= reach) {
      nextPlayer = strike(nextPlayer, `${nextPlayer.id}:${debris.id}`);
    }
    if (Math.hypot(nextRival.motion.x - debris.x, nextRival.motion.z - debris.z) <= reach) {
      nextRival = strike(nextRival, `${nextRival.id}:${debris.id}`);
    }
  }

  const gap = Math.hypot(nextPlayer.motion.x - nextRival.motion.x, nextPlayer.motion.z - nextRival.motion.z);
  if (gap <= rivalBumpDistance) {
    if (contactOpen(nextBook, "pair")) {
      const playerHit = applyCollisionPenalty(nextPlayer.motion, nextPlayer.effects);
      const rivalHit = applyCollisionPenalty(nextRival.motion, nextRival.effects);
      nextPlayer = { ...nextPlayer, motion: playerHit.motion, effects: playerHit.effects };
      nextRival = { ...nextRival, motion: rivalHit.motion, effects: rivalHit.effects };
      nextBook = armContact(nextBook, "pair");
      blocked = blocked || playerHit.blocked || rivalHit.blocked;
      bumped = bumped || !playerHit.blocked || !rivalHit.blocked;
    }
  }

  return { player: nextPlayer, rival: nextRival, book: nextBook, blocked, bumped };
}
