import { describe, expect, it } from "vitest";
import { playerStart } from "./course";
import { tideOrbSpots } from "../abilities/pickups";
import { obstacleBodyRadius, obstacleLayout, overlapsObstacle, pushOutOfObstacles } from "./obstacles";

describe("course obstacles", () => {
  it("pushes a turtle out of a rock and leaves open sand alone", () => {
    const rock = obstacleLayout.find((obstacle) => obstacle.id === "rock-wet");
    if (!rock) throw new Error("expected the wet-sand rock");
    const inside = pushOutOfObstacles(rock.x, rock.z);
    expect(Math.hypot(inside.x - rock.x, inside.z - rock.z)).toBeGreaterThanOrEqual(rock.radius + obstacleBodyRadius - 0.001);
    expect(overlapsObstacle(inside.x, inside.z, obstacleBodyRadius)).toBe(false);

    const clear = pushOutOfObstacles(playerStart.x, playerStart.z);
    expect(clear).toEqual({ x: playerStart.x, z: playerStart.z });
  });

  it("blocks the middle of a log and lets a turtle pass the end", () => {
    const log = obstacleLayout.find((obstacle) => obstacle.id === "log-dry");
    if (!log) throw new Error("expected the dry-sand log");
    expect(overlapsObstacle(log.x, log.z, obstacleBodyRadius)).toBe(true);
    const endX = log.x + Math.sin(log.yaw) * (log.length / 2 + log.radius + obstacleBodyRadius + 0.4);
    const endZ = log.z + Math.cos(log.yaw) * (log.length / 2 + log.radius + obstacleBodyRadius + 0.4);
    expect(overlapsObstacle(endX, endZ, obstacleBodyRadius)).toBe(false);
  });

  it("keeps the nest, the tide orbs, and a route to the sea clear", () => {
    expect(overlapsObstacle(playerStart.x, playerStart.z, obstacleBodyRadius)).toBe(false);
    for (const orb of tideOrbSpots) {
      expect(overlapsObstacle(orb.x, orb.z, 0.6)).toBe(false);
    }
    for (let z = -24; z <= 52; z += 1) {
      let open = false;
      for (let x = -10; x <= 10; x += 0.5) {
        if (!overlapsObstacle(x, z, obstacleBodyRadius)) {
          open = true;
          break;
        }
      }
      expect(open).toBe(true);
    }
  });
});
