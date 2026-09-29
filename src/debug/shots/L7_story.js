// Lane 7's presets: the story's beats at the moment each shows (scene shot
// mode, CONTRACTS §3). Each is also reachable as a plain query string:
//   ?scene=<id>&beat=<beat>&t=<s>[&press=<code>@<s>]
// (press=: a key the player presses at game time s, e.g. the lighter).
// The HUD shows with hud=1 (prompts, subtitles, the fight's health bar).
//   diner_settle     seated at the counter, the pack and the lighter by the right hand; E light up
//   diner_light      E pressed at 4.2 s: the lighter's flame at the cigarette (flame mark 2.0 s on)
//   diner_dot        the view eased 0.25 rad toward Dot coming down the counter (E at 7.8: the order at once)
//   diner_order      Dot across the counter; E scotch
//   diner_pour       E pressed: "Scotch. Neat.", the tumbler down, the stream (streamOn .. streamOff)
//   diner_drink      the glass at my left hand; E drink: the glass up
//   diner_pay        E pay: the licence shown, the big man's look and his line
//   diner_rise       he has stood; the stool over
//   fight_round1     squared up in the aisle; his hook coming (the shoulder drops)
//   fight_round2     he has the bottle's neck; mine on the counter in reach
//   fight_round3     the haymaker's tell: both hands up and back
//   fight_ko         the last heavy: out over the end booth, through the glass
//   fight_outside    on the pavement over him in the glass; E search
//   fight_matchbook  the red matchbook in the hand
const beat = (scene, b, t, press = null) => ({ scene, beat: b, t, viewmodel: true, press });
export const presets = {
  diner_settle: beat('diner', 'settle', 4.5),
  diner_light: beat('diner', 'settle', 6.4, 'KeyE@4.2'),
  diner_dot: beat('diner', 'settle', 8.7, 'KeyE@4.2,KeyE@7.8'),
  diner_order: beat('diner', 'order', 1),
  diner_pour: beat('diner', 'order', 5.6, 'KeyE@0.3'),
  diner_drink: beat('diner', 'drink', 1.9, 'KeyE@0.3'),
  diner_pay: beat('diner', 'pay', 4.6, 'KeyE@0.3'),
  diner_rise: beat('diner', 'pay', 8.3, 'KeyE@0.3'),
  fight_round1: beat('fight', 'round1', 1.9),
  fight_round2: beat('fight', 'round2', 2),
  fight_round3: beat('fight', 'round3', 2),
  fight_ko: beat('fight', 'ko', 0.7),
  fight_outside: beat('fight', 'outside', 1),
  fight_matchbook: beat('fight', 'matchbook', 1),
};
