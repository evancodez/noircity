// [O8] The city's figures (lane O8, docs/briefs/O8_FIGURES.md): the stage asks
// for the physics layer - a fall in the city is the light ragdoll's
// (src/cast/ragdoll.js, through enemies/Hood.js: die, Character.ko). Game
// one's stages do not ask: their falls stay the baked clips (their golden
// frames). Builds nothing, draws no rng, makes no ink id.
export default {
  name: 'o8figures', order: 990,
  build(stage) {
    stage.ragdolls = true;
    return { ragdolls: true };
  },
};
