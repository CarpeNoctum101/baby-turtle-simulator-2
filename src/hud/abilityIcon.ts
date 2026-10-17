import type { AbilityId } from "../abilities/catalog";

/** A small picture for the item box. The ability name stays on the box label for screen readers. */
export function abilityIcon(id: AbilityId): string {
  if (id === "flipper-frenzy") {
    return `<svg viewBox="0 0 64 64" aria-hidden="true"><path fill="#ef8b3a" d="M10 40c8-18 16-22 22-14 2 3-2 8-8 10-8 3-12 6-14 4z"/><path fill="#f2c14a" d="M30 36c10-16 20-18 26-8 2 4-4 10-12 12-10 2-14 2-14-4z"/></svg>`;
  }
  if (id === "shell-guard") {
    return `<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="34" r="18" fill="#c4783a"/><path stroke="#f3d7b0" stroke-width="2" fill="none" d="M32 18v32M18 34h28M22 24c8 6 12 6 20 0M22 44c8-6 12-6 20 0"/></svg>`;
  }
  if (id === "sand-spray") {
    return `<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="24" cy="36" r="10" fill="#e6d2a2"/><circle cx="38" cy="30" r="8" fill="#f0e2bc"/><circle cx="40" cy="42" r="6" fill="#c9b07a"/></svg>`;
  }
  if (id === "wave-rider") {
    return `<svg viewBox="0 0 64 64" aria-hidden="true"><path fill="none" stroke="#8fd0ea" stroke-width="4" stroke-linecap="round" d="M10 28c6 8 10 8 16 0s10-8 16 0 10 8 12 0"/><path fill="none" stroke="#d7f3ff" stroke-width="3" stroke-linecap="round" d="M12 42c6 6 10 6 16 0s10-6 16 0 8 6 10 0"/></svg>`;
  }
  return `<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="18" cy="44" r="4" fill="#d7c4ff"/><circle cx="30" cy="34" r="4" fill="#d7c4ff"/><circle cx="42" cy="24" r="4" fill="#efe6ff"/><path fill="none" stroke="#efe6ff" stroke-width="2" d="M18 44 L42 24"/></svg>`;
}
