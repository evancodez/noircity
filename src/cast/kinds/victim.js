import * as THREE from 'three';
import { NEUTRAL, mergePose } from '../../enemies/HoodRig.js';
import { accentMaterial } from '../../render/accents.js';

// The victim, Ames, a bookkeeper (scene 3, lane B1): thin, hatless (the hat
// is in the gutter), a rumpled suit a size too big, one shoe off (the left:
// the sock shows), his round spectacles cracked beside him (a prop of the
// scene), a torn note in his right fist. He lies on his back where the two
// rounds put him: a man at 20 m, not a pile. No face: his head is turned
// away, the hair and the dark of the head do the rest.
// He never moves: one clip, a still, and no breath.
const A = Math.abs;
const AMES = {
  body: {
    // narrow and flat-chested: the jacket hangs off the shoulders
    torso: [
      [0.95, 0.176, 0.12, 0.124, 0.0, 2.3],
      [1.03, 0.166, 0.114, 0.118, 0.004, 2.3],
      [1.12, 0.166, 0.118, 0.116, 0.006, 2.35],
      [1.22, 0.174, 0.124, 0.118, 0.006, 2.45],
      [1.31, 0.186, 0.124, 0.122, 0.004, 2.7],
      [1.37, 0.192, 0.118, 0.122, -0.002, 3.0],
      [1.41, 0.19, 0.108, 0.114, -0.008, 3.1],
      [1.44, 0.172, 0.096, 0.102, -0.013, 2.9],
      [1.465, 0.14, 0.086, 0.092, -0.017, 2.6],
      [1.484, 0.094, 0.074, 0.08, -0.019, 2.3],
      [1.496, 0.056, 0.06, 0.066, -0.02, 2.2],
    ],
    shoulderX: 0.152, shoulderY: 1.38, upper: 0.3, fore: 0.27, hipX: 0.085,
    neckR: 0.042, neckY: 1.475, headS: 0.95, jaw: 0.24, hairLine: 0.12,
  },
  // hatless: no cover at all (the hair is the head's own shading)
  cover: {},
  garments: [
    // the jacket open over a white shirt and a dark tie; the shirt front
    // is where the rounds went in
    { kind: 'torso', shade: (th, y) => {
      const front = A(th) < 0.2 && y > 1.12;
      const tie = A(th) < 0.035 && y > 1.12;
      return tie ? 0.006 : front ? 0.36 : 0.012;
    } },
    // the jacket's skirt to the hip, open at the front, creased
    { kind: 'skirt', y0: 1.08, hem: 0.8, split: 0.55, flare: [1.12, 1.18], back: 0.3, folds: 1.4, shade: 'coat' },
    { kind: 'lapels', near: true, top: 1.47, low: 1.2 },
    { kind: 'collar', style: 'stand', h: 0.034, hFront: 0.026, open: 0.5, gap: 0.03, shade: 0.34 },
    { kind: 'sleeves', r: 0.064, cuff: 0.056 },
    { kind: 'legs', r: 0.86 },
    { kind: 'shoes' },
    // [R2-G] both hands a dead man's, the fingers loosely curled: the right
    // round the wet paper (a hard fist stayed shut on nothing once it was
    // out), the left palm up
    { kind: 'hands', s: 0.9, fistR: false, fistL: false, curl: 0.62 },
  ],
  skin: { coat: 0.012, hand: 0.05, skin: 0.022, hair: 0.004, trousers: 0.01, shoes: 0.004 },
  collider: 0.26,
};

// On his back, his root under his hips: the head away (-z, model), the feet
// toward +z; the head rolled to his left (away from the alley's mouth when
// he lies as the scene lays him); the right arm out at his side, the fist
// on the flags; the left flung up past his shoulder, palm up; the right leg
// straight, the left knee fallen open.
export const LIE = {
  hipsPos: [0.01, 0.15, 0], hips: [-90, -3, 2],
  spine: [5, 0, 0], chest: [7, -3, -3], neck: [-6, 0, 0], head: [-12, 34, 6], headLevel: [0],
  shoulderL: [-8, 0, 6], shoulderR: [-6, 0, -4],
  handTR: [-0.5, 0.07, 0.16], elbowPoleR: [-1, 0.6, -0.2], handR: [0, 0, -10],
  handTL: [0.6, 0.08, -0.52], elbowPoleL: [1, 0.8, 0.2], handL: [0, 0, -12],
  footL: [0.24, 0.085, 0.78], footRotL: [55, 38, 0], kneeL: [1, 0.3, 0.1],
  footR: [-0.16, 0.085, 0.885], footRotR: [75, 22, 0], kneeR: [-0.35, 1, 0.0],
};

export default {
  kind: 'victim', h: 1.74, name: 'ames',
  costume: AMES,
  clips: {
    victim_lie: { duration: 4, loop: true, def: () => ({ armSpace: 'root', pose: () => mergePose(NEUTRAL, LIE) }) },
  },
  idle: 'victim_lie',
  onSpawn(c, fig) {
    // the shoe that came off: the left foot is a sock (the shoe lies in the
    // alley, a prop of the scene)
    // (a bone's children are in the figure's model units, placed from the
    // bone's bind position: every bind rotation is identity)
    const B = fig.bones, id = fig.mesh.userData.inkId;
    const own = (m) => { m.userData.inkId = id; m.userData.inkFigure = true; m.castShadow = true; m.userData.noRay = true; return m; };
    B.footL.scale.setScalar(0.001);
    const sock = own(new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12).scale(0.042, 0.036, 0.115), new THREE.MeshStandardMaterial({ color: 0x1e1e1e, roughness: 0.95 })));
    // (at the ankle, under the shin: the foot's length forward of it)
    sock.position.set(0, -0.44, 0.045);
    B.shinL.add(sock);
    // the torn paper shut in his right fist: a wet crumple showing between
    // the fingers and the thumb
    const paper = own(new THREE.Mesh(new THREE.IcosahedronGeometry(0.028, 1).scale(1, 0.75, 1.3), new THREE.MeshStandardMaterial({ color: 0xc8c8c8, roughness: 0.95, flatShading: true })));
    paper.userData.inkSurface = 'paper';   // [second pass] (pale: paper in a fist, seen at a glance)
    paper.position.set(0.03, -0.082, 0.028);   // [R2-G] (in the curl of the fingers, showing: the hand is no longer a fist)
    B.handR.add(paper);
    c.items.set('paper', paper);
    // the two wounds in the shirt front, the blood soaked round them
    const bl = accentMaterial('blood');
    const W = new THREE.Group();
    for (const [x, y, r] of [[0.03, 0.03, 0.036], [-0.028, -0.05, 0.03]]) {
      const soak = own(new THREE.Mesh(new THREE.CircleGeometry(r, 18), bl));
      soak.castShadow = false;
      soak.position.set(x, y, 0.142);
      soak.scale.set(1, 1.35, 1);
      W.add(soak);
    }
    B.chest.add(W);
    c.items.set('wounds', W);
    c.down = true;
    c.state = 'dead';
  },
};
