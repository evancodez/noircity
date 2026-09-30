import * as THREE from 'three';
import { LAYER } from '../../render/layers.js';
import { COUPE } from '../../vehicles/models.js';

// The windscreen's rain (scene 7): the two panes of my coupe's split screen
// as one pane of glass drawn over the road (an effect, never inked or
// mirrored: LAYER.FX). Drops land on it all the time; each wiper's blade
// clears the arc it sweeps, and the drops come back behind it; outside the
// arcs (the corners, round the pivots) they gather and run. At speed they
// are pushed up the glass in short streaks. They catch the light of the
// lamps the car passes under (uLit) and of the headlamps ahead.
//   screen.attach(car)   screen.update(dt, car)   screen.wipe(sweep, wipers)
const FRAG = /* glsl */`
  uniform float uTime, uPeriod, uSpeed, uLit, uRain;
  uniform vec4 uCracks[ 4 ];   // (u, v, radius, 0 none .. 1)
  uniform vec2 uPivot[2];
  varying vec2 vQ;
  float h1( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
  vec2 h2( vec2 p ) { return fract( sin( vec2( dot( p, vec2( 127.1, 311.7 ) ), dot( p, vec2( 269.5, 183.3 ) ) ) ) * 43758.5453 ); }
  // the blade's angle at phase u (0..1 of a period): from its rest along the
  // scuttle (pointing to the car's right) up the glass and back
  float bladeAt( float u ) { return 1.52 - ( 0.5 - 0.5 * cos( u * 6.2831853 ) ) * 1.65; }
  // seconds since the blade last passed angle a (and which pass that was)
  vec2 sinceWipe( float a ) {
    float w = clamp( ( 1.52 - a ) / 1.65, 0.0, 1.0 );
    float u1 = acos( clamp( 1.0 - 2.0 * w, -1.0, 1.0 ) ) / 6.2831853;
    float t = uTime / uPeriod;
    float ph = fract( t ), base = floor( t );
    // the two passes in this period: u1 (going up) and 1 - u1 (coming down)
    float a1 = ph - u1, a2 = ph - ( 1.0 - u1 );
    float age, idx;
    if ( a2 >= 0.0 ) { age = a2; idx = base * 2.0 + 1.0; }
    else if ( a1 >= 0.0 ) { age = a1; idx = base * 2.0; }
    else { age = ph + u1; idx = base * 2.0 - 1.0; }
    return vec2( age * uPeriod, idx );
  }
  void main() {
    vec2 q = vQ;
    // which wiper's arc this point is in (its blade from 0.33 to 0.73 m)
    float age = 1e3, idx = -1.0;
    for ( int i = 0; i < 2; i++ ) {
      vec2 d = q - uPivot[ i ];
      float r = length( d );
      if ( r < 0.34 || r > 0.72 ) continue;
      float a = atan( d.x, d.y );
      if ( a > 1.56 || a < -0.16 ) continue;
      vec2 w = sinceWipe( a );
      if ( w.x < age ) { age = w.x; idx = w.y + float( i ) * 1000.0; }
    }
    // the drops: a cell grid, a drop per cell, born some time after the
    // wipe. At night a drop on the glass is a small dark lens with a fleck of
    // light in it (a lamp's reflection): the lens darkens what is behind it
    // a little, the fleck is the lamp's (uLit); at speed the air pushes them
    // up the glass in short streaks and thins them out
    float dark = 0.0, spark = 0.0;
    for ( int L = 0; L < 2; L++ ) {
      float sc = L == 0 ? 0.024 : 0.012;
      vec2 g = q / sc;
      vec2 cell = floor( g );
      for ( int j = -1; j <= 1; j++ ) for ( int i = -1; i <= 1; i++ ) {
        vec2 c = cell + vec2( float( i ), float( j ) );
        vec2 seed = c + vec2( idx * 7.13, float( L ) * 31.7 );
        vec2 rr = h2( seed );
        float born = h1( seed + 3.1 ) * ( L == 0 ? 2.4 : 1.4 );
        if ( age < born ) continue;
        if ( h1( seed + 9.7 ) > uRain * ( L == 0 ? 0.55 : 0.8 ) * ( 1.0 - 0.35 * min( uSpeed, 1.0 ) ) ) continue;
        float life = age - born;
        vec2 ctr = c + 0.15 + rr * 0.7;
        float run = min( life, 2.5 ) * uSpeed * ( 0.4 + rr.x ) * ( L == 0 ? 1.6 : 0.8 );
        vec2 p = g - ctr;
        p.y -= run * 0.6;
        float len = 1.0 + min( run * 0.8, 3.5 );
        // (a streak is a tail behind the drop: narrow, fading down the glass)
        vec2 e = vec2( p.x * ( 1.0 + 0.25 * min( run, 2.0 ) ), p.y < 0.0 ? p.y / len : p.y );
        float rad = ( L == 0 ? 0.3 : 0.2 ) * ( 0.55 + 0.7 * h1( seed + 5.3 ) );
        float dd = length( e );
        float body = 1.0 - smoothstep( rad * 0.7, rad, dd );
        float tail = p.y < 0.0 ? smoothstep( -len * rad, 0.0, p.y ) : 1.0;
        dark = max( dark, body * ( 0.22 + 0.2 * tail ) );
        // the fleck: up and to one side in the drop, tiny
        vec2 hl = e - vec2( -0.3, 0.35 ) * rad;
        spark = max( spark, exp( - dot( hl, hl ) / ( rad * rad * 0.045 ) ) * body );
      }
    }
    // the cracks: a star where a thing struck the glass - rays out from the
    // blow, a broken ring round it; the lines catch the light
    float crackL = 0.0;
    for ( int i = 0; i < 4; i++ ) {
      vec4 C = uCracks[ i ];
      if ( C.w <= 0.0 ) continue;
      vec2 d = q - C.xy;
      float r = length( d ) / C.z;
      if ( r > 1.0 ) continue;
      float a = atan( d.y, d.x ) / 6.2831853 + 0.5;
      float n = 11.0;
      float cell = floor( a * n );
      float ja = fract( a * n ) - 0.5 - ( h1( vec2( cell, C.x * 91.0 ) ) - 0.5 ) * 0.5 + sin( r * 17.0 + cell ) * 0.06;
      float len = 0.45 + 0.55 * h1( vec2( cell, C.y * 57.0 ) );
      float ray = ( 1.0 - smoothstep( 0.0, 0.035 / max( r, 0.08 ), abs( ja ) ) ) * step( r, len );
      float ring = ( 1.0 - smoothstep( 0.0, 0.03, abs( r - 0.32 - 0.08 * sin( a * 40.0 ) ) ) ) * step( 0.5, h1( vec2( floor( a * 23.0 ), C.x ) ) );
      float core = 1.0 - smoothstep( 0.0, 0.07, r );
      crackL = max( crackL, max( max( ray, ring * 0.8 ), core ) * C.w * ( 1.0 - r * 0.6 ) );
    }
    // the wet film: faint where the blade has just been, heavier with age
    float film = 0.02 + 0.05 * smoothstep( 0.3, 4.0, min( age, 10.0 ) );
    float lit = spark * uLit * 2.6;
    float cl = crackL * ( 0.35 + uLit * 1.4 );
    gl_FragColor = vec4( vec3( lit + film * 0.4 * uLit + cl ), max( max( dark * ( 1.0 - spark ), spark * min( 1.0, uLit * 1.5 ) ) + film * 0.3, crackL * 0.85 ) );
  }`;

export class Screen {
  constructor(stage, game) {
    this.stage = stage;
    this.game = game;
    const S = COUPE.screen;
    // the glass in the screen's own plane: u across (car z), v up the glass
    const len = Math.hypot(S.base - S.top, S.topY - S.baseY);
    const geo = new THREE.PlaneGeometry(S.halfW * 2 - 0.02, len - 0.03, 1, 1).translate(0, (len - 0.03) / 2 + 0.015, 0);
    // (the plane's x is u, its y is v)
    this.mat = new THREE.ShaderMaterial({
      name: 'TailScreen',
      uniforms: { uTime: { value: 0 }, uPeriod: { value: 1.15 }, uSpeed: { value: 0 }, uLit: { value: 0.4 }, uRain: { value: 0.6 }, uCracks: { value: [0, 1, 2, 3].map(() => new THREE.Vector4(0, 0, 0.1, 0)) }, uPivot: { value: COUPE.wipers.map((w) => new THREE.Vector2(w.z, 0.02)) } },
      vertexShader: /* glsl */`
        varying vec2 vQ;
        void main() { vQ = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }`,
      fragmentShader: FRAG,
      transparent: true, depthWrite: false, depthTest: true, side: THREE.DoubleSide,
      blending: THREE.NormalBlending,
    });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.layers.set(LAYER.FX);
    this.mesh.renderOrder = 20;
    this.mesh.frustumCulled = false;
    this.mesh.userData.noRay = true;
    // (the plane lies in the screen: its x along the car's z, its y up the glass
    // from the scuttle, its face toward the eye)
    const rake = Math.atan2(S.topY - S.baseY, S.base - S.top);
    const up = new THREE.Vector3(-Math.cos(rake), Math.sin(rake), 0);
    const across = new THREE.Vector3(0, 0, 1);
    const n = new THREE.Vector3().crossVectors(across, up);
    this.basis = new THREE.Matrix4().makeBasis(across, up, n).setPosition(S.base - 0.004, S.baseY + 0.005, 0);
    this.car = null;
  }
  attach(car) {
    if (this.mesh.parent) this.mesh.parent.remove(this.mesh);
    this.car = car;
    car.body.add(this.mesh);
    this.mesh.matrixAutoUpdate = false;
    this.mesh.matrix.copy(this.basis);
    // (the uniforms' pivots: the wipers' z at the scuttle)
  }
  // a crack in the glass where a thing struck it (lz: across the car; k: how
  // hard): a star, up to four, the oldest going when a fifth comes
  crack(lz, k = 1) {
    const C = this.mat.uniforms.uCracks.value;
    let i = C.findIndex((c) => c.w <= 0);
    if (i < 0) { i = this.nextCrack = ((this.nextCrack ?? -1) + 1) % C.length; }
    const len = Math.hypot(COUPE.screen.base - COUPE.screen.top, COUPE.screen.topY - COUPE.screen.baseY);
    C[i].set(Math.max(-0.55, Math.min(0.55, lz)), len * (0.25 + Math.random() * 0.5), 0.07 + 0.12 * k, Math.min(1, 0.5 + k));
  }
  clearCracks() { for (const c of this.mat.uniforms.uCracks.value) c.w = 0; }
  // (the blades' clock: the cabin's, so the drops clear where they sweep)
  wipe(sweep, wipers, t) { if (t != null) this.mat.uniforms.uTime.value = t; }
  update(dt, car) {
    const U = this.mat.uniforms;
    U.uSpeed.value = Math.min(1.6, Math.max(0, car.speed) / 14);
    // the light the car is under: the nearest lamps' cones
    const L = this.stage.lamps, e = car.pos;
    let lit = 0.18;
    if (L) for (const l of L.lamps) {
      if (!l.on) continue;
      const d = Math.hypot(l.head.x - e.x, l.head.z - e.z);
      if (d < 14) lit = Math.max(lit, 1.1 * (1 - d / 14));
    }
    this.lit = (this.lit ?? lit) + (lit - (this.lit ?? lit)) * (1 - Math.exp(-dt * 8));
    U.uLit.value = this.lit;
  }
}
