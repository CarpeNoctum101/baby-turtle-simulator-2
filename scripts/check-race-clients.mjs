/**
 * Two local browsers' worth of sockets against the Wrangler dev server.
 * Run `npm run server` first. This does not deploy anything.
 */
const base = "http://127.0.0.1:8787";

const failures = [];
const clients = [];

function check(label, condition) {
  if (!condition) {
    failures.push(label);
    console.error(`fail: ${label}`);
    return;
  }
  console.log(`ok: ${label}`);
}

async function post(path, name) {
  const response = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name }),
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(`${path} ${response.status} ${JSON.stringify(body)}`);
  }
  return body;
}

function openSocket(ticket) {
  const socket = new WebSocket(`${base.replace("http", "ws")}/api/rooms/${ticket.roomCode}/ws`);
  const messages = [];
  socket.addEventListener("message", (event) => {
    messages.push(JSON.parse(String(event.data)));
  });
  return new Promise((resolve, reject) => {
    socket.addEventListener("open", () => {
      socket.send(JSON.stringify({ type: "hello", playerId: ticket.playerId, token: ticket.token }));
      const client = {
        socket,
        messages,
        send(message) {
          socket.send(JSON.stringify(message));
        },
      };
      clients.push(client);
      resolve(client);
    });
    socket.addEventListener("error", () => reject(new Error("socket failed")));
  });
}

async function waitFor(client, predicate, timeout = 5000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const found = client.messages.find(predicate);
    if (found) {
      return found;
    }
    await sleep(30);
  }
  throw new Error(`timed out. last messages: ${JSON.stringify(client.messages.slice(-4))}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function walk(client, from, to) {
  let x = from.x;
  let z = from.z;
  while (Math.hypot(to.x - x, to.z - z) > 0.35) {
    const dx = to.x - x;
    const dz = to.z - z;
    const distance = Math.hypot(dx, dz);
    const scale = Math.min(0.8, distance) / distance;
    x += dx * scale;
    z += dz * scale;
    const before = client.messages.length;
    client.send({ type: "pose", x, z, heading: 0, speed: 4 });
    await sleep(80);
    const rejected = client.messages.slice(before).find((message) => message.type === "pose-rejected");
    if (rejected) {
      throw new Error(`pose rejected at ${x.toFixed(1)}, ${z.toFixed(1)}: ${rejected.reason}`);
    }
  }
  const before = client.messages.length;
  client.send({ type: "pose", x: to.x, z: to.z, heading: 0, speed: 4 });
  await sleep(100);
  const rejected = client.messages.slice(before).find((message) => message.type === "pose-rejected");
  if (rejected) {
    throw new Error(`pose rejected at the destination: ${rejected.reason}`);
  }
  return { x: to.x, z: to.z };
}

async function main() {
  const hostTicket = await post("/api/rooms", "Coral");
  const guestTicket = await post(`/api/rooms/${hostTicket.roomCode}/join`, "Pebble");
  const host = await openSocket(hostTicket);
  const guest = await openSocket(guestTicket);
  const hostWelcome = await waitFor(host, (message) => message.type === "welcome");
  await waitFor(guest, (message) => message.type === "welcome");
  check("both clients joined the lobby", hostWelcome.phase === "lobby");

  const early = host.messages.length;
  host.send({ type: "start" });
  const notReady = await waitFor(host, (message) => message.type === "rejected" && host.messages.indexOf(message) >= early);
  check("start before ready is rejected", notReady.reason.includes("ready"));

  host.send({ type: "ready", ready: true });
  guest.send({ type: "ready", ready: true });
  await sleep(200);
  const guestReady = guest.messages.length;
  guest.send({ type: "start" });
  const guestStart = await waitFor(guest, (message) => message.type === "rejected" && guest.messages.indexOf(message) >= guestReady);
  check("a guest cannot start the race", guestStart.reason.includes("host"));

  const marked = host.messages.length;
  host.send({ type: "start" });
  const countdown = await waitFor(host, (message) => message.type === "phase" && message.phase === "countdown" && host.messages.indexOf(message) >= marked);
  check("countdown is a shared server clock", typeof countdown.endsAt === "number" && countdown.snap === true);

  const racing = await waitFor(host, (message) => message.type === "phase" && message.phase === "racing", 6000);
  check("countdown advances without another click", racing.startedAt === countdown.endsAt);

  const nest = host.messages.length;
  host.send({ type: "finish" });
  const earlyFinish = await waitFor(host, (message) => message.type === "rejected" && host.messages.indexOf(message) >= nest);
  check("finish from the nest is rejected", earlyFinish.reason.includes("ocean"));

  const invented = host.messages.length;
  host.send({ type: "finish", place: 1, ms: 1 });
  const unread = await waitFor(host, (message) => message.type === "error" && host.messages.indexOf(message) >= invented);
  check("a finish message that includes a place is refused", unread.message.includes("could not be read"));

  const empty = host.messages.length;
  host.send({ type: "ability", ability: "sand-spray" });
  const noAbility = await waitFor(host, (message) => message.type === "rejected" && host.messages.indexOf(message) >= empty);
  check("an ability without a Tide Orb is rejected", noAbility.reason.includes("do not hold"));

  const far = host.messages.length;
  host.send({ type: "pickup", orb: "orb-water" });
  const farOrb = await waitFor(host, (message) => message.type === "rejected" && host.messages.indexOf(message) >= far);
  check("a far Tide Orb cannot be claimed", farOrb.reason.includes("too far"));

  const orb = { x: -5.5, z: -16 };
  let position = await walk(host, hostWelcome, orb);
  const claimedAt = host.messages.length;
  host.send({ type: "pickup", orb: "orb-nest-left" });
  const pickup = await waitFor(host, (message) => message.type === "orb" && host.messages.indexOf(message) >= claimedAt);
  check("the near Tide Orb is granted by the server", pickup.playerId === hostTicket.playerId && pickup.at > 0);
  await sleep(200);
  const againAt = host.messages.length;
  host.send({ type: "pickup", orb: "orb-nest-left" });
  const taken = await waitFor(host, (message) => message.type === "rejected" && host.messages.indexOf(message) >= againAt);
  check("the same Tide Orb cannot be claimed twice", taken.reason.includes("not there") || taken.reason.includes("already hold"));

  const firstAbility = host.messages.length;
  host.send({ type: "ability", ability: pickup.ability });
  const activated = await waitFor(host, (message) => message.type === "ability" && host.messages.indexOf(message) >= firstAbility);
  check("the granted ability activates once", activated.ability === pickup.ability);
  await sleep(200);
  const secondAbility = host.messages.length;
  host.send({ type: "ability", ability: pickup.ability });
  const repeated = await waitFor(host, (message) => message.type === "rejected" && host.messages.indexOf(message) >= secondAbility);
  check("the spent ability cannot be activated again", repeated.reason.includes("running") || repeated.reason.includes("do not hold"));

  position = await walk(host, position, { x: 0, z: 52 });
  const finishAt = host.messages.length;
  host.send({ type: "finish" });
  const finished = await waitFor(host, (message) => message.type === "finish" && host.messages.indexOf(message) >= finishAt);
  check("the server assigns first place", finished.place === 1 && finished.playerId === hostTicket.playerId);
  check("the race stays open while the other hatchling is still crawling", !host.messages.slice(finishAt).some((message) => message.type === "phase" && message.phase === "finished"));

  guest.socket.close();
  const closed = await waitFor(host, (message) => message.type === "phase" && message.phase === "finished", 4000);
  const roster = host.messages.findLast((message) => message.type === "roster" && message.phase === "finished");
  const guestRow = roster?.players?.find((player) => player.id === guestTicket.playerId);
  check("a disconnect does not leave the finished hatchling waiting", closed.phase === "finished");
  check("the disconnected hatchling does not get a place", guestRow?.place === 0);

  await sleep(200);
  const rematchAt = host.messages.length;
  host.send({ type: "rematch" });
  const lobby = await waitFor(host, (message) => message.type === "phase" && message.phase === "lobby" && host.messages.indexOf(message) >= rematchAt);
  check("the host can rematch back to the lobby", lobby.snap === true);
  void position;

  host.socket.close();
  if (failures.length > 0) {
    throw new Error(`${failures.length} check(s) failed`);
  }
  console.log("Two local clients finished the server race flow.");
}

function closeQuietly(client) {
  try {
    client?.socket.close();
  } catch {
    // The socket may already be closed.
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => {
  for (const client of clients) {
    closeQuietly(client);
  }
  setTimeout(() => process.exit(process.exitCode ?? 0), 50);
});
