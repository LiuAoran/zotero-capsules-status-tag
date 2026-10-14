import {
  argbFromHex,
  hexFromArgb,
  themeFromSourceColor,
  TonalPalette,
  Blend,
  Hct,
} from '@material/material-color-utilities';
export function colorCSS(seed, dark, states = [], harmonize = true) {
  if (!/^#[0-9a-f]{6}$/i.test(seed)) seed = '#6750a4';
  const source = argbFromHex(seed),
    sourceHct = Hct.fromInt(source);
  const theme = themeFromSourceColor(source);
  const scheme = dark ? theme.schemes.dark : theme.schemes.light;
  const roles = scheme.toJSON();
  let css = Object.entries(roles)
    .map(([k, v]) => `--rs-${k}:${hexFromArgb(v)};`)
    .join('');
  // Keep semantic color families; official harmonization limits hue rotation to 15°.
  const palettes = [
    [95, 48],
    [25, 48],
    [145, 40],
    [260, 44],
    [0, 0],
  ].map(([hue, chroma]) => TonalPalette.fromHueAndChroma(hue, chroma));
  const count = Math.max(palettes.length, states.length);
  for (let i = 0; i < count; i++) {
    let p = /^#[0-9a-f]{6}$/i.test(states[i]?.color)
      ? TonalPalette.fromInt(argbFromHex(states[i].color))
      : palettes[i] || TonalPalette.fromInt(source);
    if (harmonize) {
      // Near neutrals get a low-chroma tint instead of becoming a saturated color.
      p =
        p.chroma < 8
          ? TonalPalette.fromHueAndChroma(sourceHct.hue, Math.min(6, sourceHct.chroma / 4))
          : TonalPalette.fromInt(Blend.harmonize(p.tone(50), source));
    }
    css += `--rs-bg-${i}:${hexFromArgb(p.tone(dark ? 30 : 90))};--rs-fg-${i}:${hexFromArgb(p.tone(dark ? 90 : 10))};`;
  }
  return css;
}
