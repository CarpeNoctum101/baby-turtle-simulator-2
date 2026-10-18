import { displayName, normalizeRoomCode, roomCodeFromBytes } from "../shared/protocol";
import type { Env } from "./env";

export { RaceRoom } from "./raceRoom";

/**
 * Local multiplayer door. Wrangler runs this on your computer.
 * It does not deploy, and it does not call any paid Cloudflare API.
 */
export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/api/health") {
      return json({ ok: true });
    }

    if (request.method === "POST" && url.pathname === "/api/rooms") {
      const name = displayName(await readName(request));
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const code = roomCodeFromBytes(crypto.getRandomValues(new Uint8Array(4)));
        const created = await env.RACE_ROOMS.getByName(code).createRoom(name, code);
        if (created.ok) {
          return json(created.ticket, 201);
        }
      }
      return json({ error: "Could not open a room. Try again." }, 503);
    }

    const match = /^\/api\/rooms\/([^/]+)(\/join|\/ws)?$/.exec(url.pathname);
    if (!match) {
      return json({ error: "That address is not part of the lobby." }, 404);
    }
    const code = normalizeRoomCode(match[1] ?? "");
    if (!code) {
      return json({ error: "Enter the 4-character room code." }, 400);
    }
    const room = env.RACE_ROOMS.getByName(code);
    const action = match[2] ?? "";

    if (request.method === "POST" && action === "/join") {
      const name = displayName(await readName(request));
      const joined = await room.joinRoom(name);
      if (!joined.ok) {
        return json({ error: joined.error }, joined.status);
      }
      return json(joined.ticket);
    }

    if (request.method === "GET" && action === "/ws") {
      return room.fetch(request);
    }

    if (request.method === "GET" && action === "") {
      const view = await room.inspect();
      if (!view) {
        return json({ error: "That room code does not exist." }, 404);
      }
      return json({ roomCode: code, ...view });
    }

    return json({ error: "That lobby action is not available." }, 405);
  },
} satisfies ExportedHandler<Env>;

async function readName(request: Request): Promise<unknown> {
  const text = await request.text();
  if (text.length === 0 || text.length > 1_000) {
    return undefined;
  }
  try {
    const body: unknown = JSON.parse(text);
    if (!body || typeof body !== "object" || !("name" in body)) {
      return undefined;
    }
    return (body as { name?: unknown }).name;
  } catch {
    return undefined;
  }
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
