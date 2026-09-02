export const SIDE_BURN_VERTEX_SHADER = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

const SIDE_BURN_NOISE_GLSL = `
float Hash(vec2 p) {
  vec3 p2 = vec3(p.xy, 1.0);
  return fract(sin(dot(p2, vec3(37.1, 61.7, 12.4))) * 3758.5453123);
}

float noise(in vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f *= f * (3.0 - 2.0 * f);
  return mix(
    mix(Hash(i + vec2(0.0, 0.0)), Hash(i + vec2(1.0, 0.0)), f.x),
    mix(Hash(i + vec2(0.0, 1.0)), Hash(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}

float fbm(vec2 p) {
  float v = 0.0;
  v += noise(p * 1.0) * 0.5;
  v += noise(p * 2.0) * 0.25;
  v += noise(p * 4.0) * 0.125;
  return v;
}

// n, n2, grain, edgeWarpNoise
vec4 computeBurnNoise(vec2 uv, vec2 centeredUv, float aspect, float uTime) {
  float n = fbm(vec2(uv.y * 5.0 + uTime * 0.55, uTime * 0.42));
  float n2 = fbm(centeredUv * 9.0 + uTime * 0.28);
  float grain = noise(uv * 18.0 + uTime * 1.35);
  float edgeWarpNoise = fbm(centeredUv * 20.0 + vec2(uTime * 0.14, uTime * 0.09));
  return vec4(n, n2, grain, edgeWarpNoise);
}
`

const SIDE_BURN_FIELD_GLSL = `
float computeBurnField(
  vec2 uv,
  float t,
  float aspect,
  float spread,
  float centerBurn,
  float dir,
  float uTime,
  vec4 burnNoise
) {
  float burnT = t * t * (3.0 - 2.0 * t);
  vec2 centeredUv = (uv - 0.5) * vec2(aspect, 1.0);

  float n = burnNoise.x;
  float n2 = burnNoise.y;
  float grain = burnNoise.z;
  float edgeWarp = (burnNoise.w - 0.5) * spread;
  float edgeLife = 4.0 * burnT * (1.0 - burnT);

  float field;
  if (centerBurn > 0.5) {
    vec2 centered = (uv - 0.5) * vec2(aspect, 1.0);
    float dist = length(centered);
    float maxDist = length(vec2(aspect * 0.5, 0.5)) * 1.12;
    float burnRadius = burnT * maxDist + edgeWarp * 0.35;
    float radiusPulse = sin(uTime * 2.4 + dist * 14.0 + n * 2.0) * 0.014 * edgeLife;
    burnRadius += radiusPulse;
    field = dist - burnRadius;
  } else {
    float burnFront = burnT * 1.15 + edgeWarp;
    burnFront += sin(uTime * 2.1 + uv.y * 9.0) * 0.008 * edgeLife;
    float coord = dir > 0.0 ? uv.x : (1.0 - uv.x);
    field = coord - burnFront;
  }

  field -= (n - 0.5) * 0.08;
  field -= (n2 - 0.5) * 0.045;
  field -= (grain - 0.5) * 0.02;

  float edgeCrawl = sin(uTime * 3.8 + atan(centeredUv.y, centeredUv.x) * 7.0 + n * 2.5) * 0.005 * edgeLife;
  field -= edgeCrawl;

  return field;
}
`

const SIDE_BURN_SKETCH_GLSL = `
float sketchLuminance(vec3 c) {
  return dot(c, vec3(0.299, 0.587, 0.114));
}

vec3 toGrayscale(vec3 c) {
  return vec3(sketchLuminance(c));
}

vec3 behindPhoto(vec2 uv) {
  return toGrayscale(texture2D(uBehind, uv).rgb);
}

vec3 faintBehindPhoto(vec3 photo) {
  vec3 paper = vec3(0.97, 0.95, 0.91);
  return mix(paper, photo, uBehindOpacity);
}

vec3 sketchColor(vec2 uv, vec3 photo) {
  float l = sketchLuminance(photo);
  float tone = 1.0 - l;

  // Bold contour strokes
  float edge = length(vec2(dFdx(l), dFdy(l)));
  edge = smoothstep(0.004, 0.07, edge);

  vec3 paper = vec3(0.97, 0.95, 0.91);
  vec3 ink = vec3(0.11, 0.09, 0.07);
  vec3 graphite = vec3(0.52, 0.48, 0.44);

  // Stepped pencil shading — fills midtones, not just outlines
  float shade = floor(tone * 7.0) / 7.0;
  shade = smoothstep(0.08, 0.92, shade) * 0.62;

  // Soft paper grain in shaded areas
  float grain = (noise(uv * 22.0 + uTime * 0.18) - 0.5) * 0.07;
  shade = clamp(shade + grain * smoothstep(0.15, 0.75, tone), 0.0, 1.0);

  float inkAmt = clamp(edge * 2.6 + shade, 0.0, 1.0);
  vec3 sketch = mix(paper, ink, inkAmt);
  sketch = mix(sketch, graphite, shade * 0.35 * (1.0 - edge * 0.6));

  return sketch;
}

vec3 behindDisplay(vec2 uv, float t, float aspect, float dir, float feather, vec4 burnNoise) {
  vec3 photo = behindPhoto(uv);
  vec3 faintPhoto = faintBehindPhoto(photo);

  if (t <= 0.0) {
    return faintPhoto;
  }

  float tSketch = min(1.0, t * uSketchSpeed + uSketchLead);
  float fieldSketch = computeBurnField(uv, tSketch, aspect, uSpread, uCenterBurn, dir, uTime, burnNoise);
  float fieldMain = computeBurnField(uv, t, aspect, uSpread, uCenterBurn, dir, uTime, burnNoise);

  float sketchFeather = max(feather * 4.5, 0.045);
  float outerFade = 1.0 - smoothstep(-sketchFeather, sketchFeather * 1.35, fieldSketch);
  float innerFade = smoothstep(-sketchFeather * 1.35, sketchFeather, fieldMain);
  float band = outerFade * innerFade;
  band = band * band * (3.0 - 2.0 * band);

  if (band < 0.001) {
    return faintPhoto;
  }

  vec3 sketch = sketchColor(uv, photo);
  return mix(faintPhoto, sketch, band * uSketchOpacity);
}
`

export const SIDE_BURN_FRAGMENT_SHADER = `
precision mediump float;

uniform sampler2D uFrom;
uniform sampler2D uTo;
uniform sampler2D uBehind;
uniform float uProgress;
uniform float uDirection;
uniform float uSpread;
uniform float uCenterBurn;
uniform float uRevealBehind;
uniform float uUseBehind;
uniform float uSketchLead;
uniform float uSketchSpeed;
uniform float uSketchOpacity;
uniform float uBehindOpacity;
uniform float uTime;
uniform vec2 uSlide;
uniform vec2 uResolution;
varying vec2 vUv;

${SIDE_BURN_NOISE_GLSL}
${SIDE_BURN_FIELD_GLSL}
${SIDE_BURN_SKETCH_GLSL}

void main() {
  vec2 uv = vUv;
  float t = clamp(uProgress, 0.0, 1.0);
  float dir = uDirection;
  float aspect = uResolution.x / uResolution.y;

  vec4 to = texture2D(uTo, uv);

  if (t <= 0.0) {
    if (uUseBehind > 0.5) {
      gl_FragColor = vec4(faintBehindPhoto(behindPhoto(uv)), 1.0);
      return;
    }
    if (uRevealBehind > 0.5) {
      gl_FragColor = vec4(0.0);
      return;
    }
    vec2 idleUv = uv - uSlide;
    bool idleVisible = idleUv.x >= 0.0 && idleUv.x <= 1.0 && idleUv.y >= 0.0 && idleUv.y <= 1.0;
    vec4 idleFrom = idleVisible ? texture2D(uFrom, idleUv) : to;
    gl_FragColor = idleVisible ? idleFrom : to;
    return;
  }
  if (t >= 1.0) {
    gl_FragColor = to;
    return;
  }

  vec2 centeredUv = (uv - 0.5) * vec2(aspect, 1.0);
  vec4 burnNoise = computeBurnNoise(uv, centeredUv, aspect, uTime);
  float n = burnNoise.x;
  float grain = burnNoise.z;
  float field = computeBurnField(uv, t, aspect, uSpread, uCenterBurn, dir, uTime, burnNoise);

  float pixelSize = 1.0 / uResolution.y;
  float feather = max(pixelSize * 2.5, 0.014);
  float fromAlpha = smoothstep(-feather, feather, field);

  float curlAmt = (1.0 - step(0.5, uCenterBurn))
    * smoothstep(0.04, 0.0, field)
    * (1.0 - smoothstep(-0.03, 0.0, field));
  float curlFlutter = (noise(vec2(uv.y * 9.0, uTime * 2.8)) - 0.5) * 0.15;
  vec2 curlOff = vec2(-dir * curlAmt * (0.009 + curlFlutter * 0.003), curlAmt * (0.004 + curlFlutter * 0.002));
  vec2 fromUv = uv - uSlide + curlOff;

  bool fromVisible = fromUv.x >= 0.0 && fromUv.x <= 1.0 && fromUv.y >= 0.0 && fromUv.y <= 1.0;
  vec4 from = fromVisible ? texture2D(uFrom, fromUv) : to;

  if (!fromVisible) {
    fromAlpha = 0.0;
  }

  float flicker = 0.94 + 0.06 * sin(uTime * 8.5 + n * 4.0 + uv.y * 5.0);

  vec3 F0 = vec3(0.88, 0.68, 0.38);
  vec3 hot = vec3(0.95, 0.84, 0.62);
  vec3 ash = vec3(0.16, 0.1, 0.06);
  vec3 emberEnv = mix(vec3(0.1, 0.05, 0.02), vec3(0.7, 0.45, 0.15), n);

  float charring = smoothstep(0.04, -0.01, field) * fromAlpha;
  float scorch = smoothstep(0.055, 0.0, field) * fromAlpha;

  vec3 fromColor = from.rgb;
  fromColor = mix(fromColor, ash, scorch * 0.38);
  fromColor = mix(fromColor, ash, charring * 0.42);
  fromColor = mix(fromColor, F0, charring * 0.22);
  fromColor += emberEnv * charring * 0.14;
  fromColor *= 1.0 - scorch * 0.18;

  vec3 burnMix = mix(to.rgb, fromColor, fromAlpha);

  float frontMask = smoothstep(0.05, 0.0, abs(field));
  float edge = frontMask;
  float specSharp = pow(edge, 3.0) * flicker;
  float specBroad = pow(edge, 7.0) * grain;
  burnMix += hot * specSharp * 0.42;
  burnMix += F0 * specBroad * 0.2;
  burnMix += vec3(0.98, 0.94, 0.86) * pow(edge, 14.0) * 0.18;

  float heatBleed = frontMask * smoothstep(0.006, -0.012, field);
  burnMix += vec3(0.55, 0.22, 0.06) * heatBleed * 0.22;
  burnMix += hot * heatBleed * 0.08 * flicker;

  float ashPuff = frontMask * smoothstep(0.0, -0.01, field);
  burnMix = mix(burnMix, ash * 0.7, ashPuff * 0.4);

  vec3 color = burnMix;

  if (uUseBehind > 0.5) {
    vec3 behindColor = behindDisplay(uv, t, aspect, dir, feather, burnNoise);
    float behindAmt = smoothstep(0.0, 0.32, fromAlpha - edge * 0.3);
    behindAmt = behindAmt * behindAmt * (3.0 - 2.0 * behindAmt);
    color = mix(burnMix, behindColor, behindAmt);
    gl_FragColor = vec4(color, 1.0);
    return;
  }

  float outAlpha = 1.0;
  if (uRevealBehind > 0.5) {
    outAlpha = 1.0 - smoothstep(0.0, 0.12, fromAlpha - edge * 0.35);
  }

  gl_FragColor = vec4(color, outAlpha);
}
`
