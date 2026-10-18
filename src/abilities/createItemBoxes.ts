import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import { RawTexture } from "@babylonjs/core/Materials/Textures/rawTexture";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { Scene } from "@babylonjs/core/scene";
import { tideOrbSpots } from "./pickups";

/** Original question-mark artwork, generated locally instead of using game textures. */
export function createItemBoxes(scene: Scene) {
  const size = 128, pixels = new Uint8Array(size * size * 3);
  const glyph = ["01110", "11011", "00011", "00110", "00100", "00000", "00100"];
  const inGlyph = (x: number, y: number) => {
    const column = Math.floor((x - 34) / 12), row = Math.floor((size - 1 - y - 22) / 12);
    return column >= 0 && column < 5 && row >= 0 && row < 7 && glyph[row][column] === "1";
  };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / (size - 1), v = y / (size - 1);
    const cyan = Math.max(0, 1 - Math.hypot(u - 0.08, v - 0.78));
    const pink = Math.max(0, 1 - Math.hypot(u - 0.9, v - 0.35));
    let color = [45 + pink * 155, 58 + cyan * 165, 145 + cyan * 80];
    const edge = Math.min(x, y, size - 1 - x, size - 1 - y);
    if (edge < 6) color = [30, 39, 85];
    if (inGlyph(x + 3, y + 3) || inGlyph(x - 3, y + 3) || inGlyph(x, y - 3)) color = [17, 24, 66];
    if (inGlyph(x, y)) color = [255, 255, 240];
    pixels.set(color, (y * size + x) * 3);
  }
  const artwork = RawTexture.CreateRGBTexture(pixels, size, size, scene, true, false, Texture.TRILINEAR_SAMPLINGMODE);
  artwork.name = "originalQuestionBox128";
  const face = new StandardMaterial("itemBoxFaces", scene);
  face.diffuseTexture = artwork;
  face.emissiveTexture = artwork;
  face.emissiveColor = new Color3(0.48, 0.48, 0.48);
  face.specularColor = new Color3(0.6, 0.75, 0.9);
  face.specularPower = 64;
  const trim = new StandardMaterial("itemBoxGoldEdges", scene);
  trim.diffuseColor = new Color3(1, 0.78, 0.12);
  trim.emissiveColor = new Color3(0.5, 0.26, 0.015);
  const cube = MeshBuilder.CreateBox("questionBox", { size: 0.78 }, scene);
  // BoxBuilder's default face layouts rotate some sides. Keep every vertical '?' upright.
  const positions = cube.getVerticesData(VertexBuffer.PositionKind)!;
  const normals = cube.getVerticesData(VertexBuffer.NormalKind)!;
  const uvs: number[] = [];
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i], y = positions[i + 1], z = positions[i + 2];
    const nx = normals[i], ny = normals[i + 1], nz = normals[i + 2];
    if (Math.abs(ny) < 0.5) uvs.push(0.5 + (-nz * x + nx * z) / 0.78, 0.5 + y / 0.78);
    else uvs.push(0.5 + x / 0.78, 0.5 + z / 0.78);
  }
  cube.setVerticesData(VertexBuffer.UVKind, uvs);
  cube.material = face;
  const parts = [cube];
  for (const axis of ["x", "y", "z"] as const) for (const a of [-1, 1]) for (const b of [-1, 1]) {
    const edge = MeshBuilder.CreateBox("itemBoxEdge", {
      width: axis === "x" ? 0.82 : 0.028,
      height: axis === "y" ? 0.82 : 0.028,
      depth: axis === "z" ? 0.82 : 0.028,
    }, scene);
    if (axis === "x") edge.position.set(0, a * 0.4, b * 0.4);
    if (axis === "y") edge.position.set(a * 0.4, 0, b * 0.4);
    if (axis === "z") edge.position.set(a * 0.4, b * 0.4, 0);
    edge.material = trim;
    parts.push(edge);
  }
  const source = Mesh.MergeMeshes(parts, true, false, undefined, false, true)!;
  return tideOrbSpots.map((spot, index) => {
    const box = index === 0 ? source : source.createInstance(spot.id);
    box.name = spot.id;
    box.position.set(spot.x, 0.95, spot.z);
    box.rotation.set(0.12, index * 0.65, 0.15);
    box.isPickable = false;
    return box;
  });
}
