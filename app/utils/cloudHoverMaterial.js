import { DataTexture, DoubleSide, MeshBasicMaterial, RedFormat, SRGBColorSpace, UnsignedByteType, Vector2 } from 'three'

let fallbackDepthTexture

function getFallbackDepthTexture() {
  if (!fallbackDepthTexture) {
    fallbackDepthTexture = new DataTexture(new Uint8Array([0]), 1, 1, RedFormat, UnsignedByteType)
    fallbackDepthTexture.needsUpdate = true
  }
  return fallbackDepthTexture
}

export const CLOUD_SHARED_FUNCS = `
float hash21(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 2; i++) {
    v += a * valueNoise(p);
    p = p * 2.11 + vec2(17.2, 9.1);
    a *= 0.5;
  }
  return v;
}

float fbmRich(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * valueNoise(p);
    p = p * 2.17 + vec2(13.7, 7.3);
    a *= 0.5;
  }
  return v;
}

float reliefHeight(vec3 worldPos) {
  vec2 p = worldPos.xz * 2.6 + worldPos.y * 1.1;
  float coarse = fbmRich(p);
  float mid = fbm(p * 3.4);
  float grit = valueNoise(p * 11.0);
  return saturate(coarse * 0.55 + mid * 0.3 + grit * 0.15);
}

float sampleDepth(vec2 uv) {
  return texture2D(uDepthMap, uv).r * uDepthStrength;
}

float trailSegmentInfluence(vec2 p, vec2 a, vec2 b, float radiusA, float radiusB, float ampA, float ampB) {
  vec2 ab = b - a;
  float segLen2 = dot(ab, ab);
  if (segLen2 < 1e-8) {
    return smoothstep(radiusA, 0.0, length(p - a)) * ampA;
  }
  float t = clamp(dot(p - a, ab) / segLen2, 0.0, 1.0);
  vec2 closest = a + ab * t;
  float radius = mix(radiusA, radiusB, t);
  float amp = mix(ampA, ampB, t);
  return smoothstep(radius, 0.0, length(p - closest)) * amp;
}

float cursorTrailInfluence(vec2 screenUv) {
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  vec2 p = screenUv;
  p.x *= aspect;

  float influence = 0.0;
  vec2 prev;
  float prevRadius = 0.0;
  float prevAmp = 0.0;

  for (int i = 0; i < 16; i++) {
    // Trail stores NDC (-1..1); convert to the same 0..1 space as screenUv.
    vec2 pt = uTrail[i] * 0.5 + 0.5;
    pt.x *= aspect;
    float age = float(i) / 15.0;
    // Soft tip, then a thinner decaying stroke along the path.
    float radius = mix(0.28, 0.08, age);
    float amp = pow(1.0 - age, 1.35);

    if (i == 0) {
      influence = max(influence, smoothstep(radius, 0.0, length(p - pt)) * amp);
    } else {
      influence = max(
        influence,
        trailSegmentInfluence(p, prev, pt, prevRadius, radius, prevAmp, amp)
      );
    }

    prev = pt;
    prevRadius = radius;
    prevAmp = amp;
  }

  return influence;
}

float cursorInfluenceFluid(vec2 screenUv, vec2 mouseUv, vec2 velocity) {
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  vec2 delta = screenUv - mouseUv;
  delta.x *= aspect;

  vec2 vel = velocity;
  vel.x *= aspect;
  float speed = length(vel);

  float n = valueNoise(delta * 7.5 + uTime * 0.09);
  float n2 = valueNoise(delta * 13.0 - uTime * 0.06);
  float edgeWarp = (n - 0.5) * 0.05 + (n2 - 0.5) * 0.025;

  // Path stroke is the main shape — no velocity wake protrusion.
  float stroke = cursorTrailInfluence(screenUv);
  stroke = saturate(stroke + edgeWarp * stroke);

  if (uMotion <= 0.001) {
    return 0.0;
  }

  // Soft tip while holding still after a move.
  float tip = 0.0;
  if (speed <= 0.02 && uMotion > 0.05) {
    tip = smoothstep(0.3, 0.0, length(delta) + edgeWarp * 0.4);
  }

  float influence = max(stroke, tip * 0.85);
  influence = influence * influence * (3.0 - 2.0 * influence);
  // Ease the last of the fade so it dissolves instead of cutting off.
  float fade = smoothstep(0.0, 0.18, uMotion);
  return influence * fade;
}

float cursorInfluence(vec2 screenUv, vec2 mouseUv, vec2 velocity) {
  if (uFluidCursor > 0.5) {
    return cursorInfluenceFluid(screenUv, mouseUv, velocity);
  }

  float aspect = uResolution.x / max(uResolution.y, 1.0);
  vec2 delta = screenUv - mouseUv;
  delta.x *= aspect;

  vec2 vel = velocity;
  vel.x *= aspect;
  float speed = length(vel);

  float radius = 0.2 + saturate(speed * 0.1) * 0.08;
  float circular = smoothstep(radius, 0.0, length(delta));

  if (speed <= 0.001) {
    return circular * uMotion;
  }

  vec2 velDir = vel / speed;
  float along = dot(delta, velDir);
  vec2 perp = delta - velDir * along;
  float stretch = 1.0 + saturate(speed * 0.35) * 1.6;
  float behind = saturate(-along * 6.0);
  vec2 wake = perp + velDir * (along / mix(1.0, stretch, behind));
  float wakeInfluence = smoothstep(radius, 0.0, length(wake));

  float wakeMix = smoothstep(0.05, 0.22, speed);
  return mix(circular, wakeInfluence, wakeMix) * uMotion;
}
`

const CLOUD_VERTEX_HEAD = `
uniform sampler2D uDepthMap;
uniform float uUseDepthMap;
uniform float uDepthStrength;
uniform float uFluidCursor;
uniform float uTime;
uniform float uMotion;
uniform vec2 uMouse;
uniform vec2 uVelocity;
uniform vec2 uResolution;
uniform vec2 uTrail[16];
varying vec3 vCloudWorldPos;
varying float vHover;
varying float vRelief;
varying vec2 vSurfaceUv;

${CLOUD_SHARED_FUNCS}
`

const CLOUD_VERTEX_DISPLACE = `
  {
    vSurfaceUv = uv;
    if (uFluidCursor > 0.5) {
      vHover = 0.0;
      vRelief = 0.5;
    } else {
      vec3 worldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
      vec4 clipPre = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
      vec2 screenUv = clipPre.xy / max(abs(clipPre.w), 1e-4) * 0.5 + 0.5;
      vec2 mouseUv = uMouse * 0.5 + 0.5;
      float influence = uMotion > 0.001
        ? cursorInfluence(screenUv, mouseUv, uVelocity)
        : 0.0;
      float height = reliefHeight(worldPos);
      if (uUseDepthMap > 0.5) {
        height = 0.5;
      }
      float amt = height * influence * 0.14;
      vec3 worldDisp = normalize(cameraPosition - worldPos) * amt;
      mat3 linear = mat3(modelMatrix);
      float scale2 = max(dot(linear[0], linear[0]), 1e-6);
      transformed += transpose(linear) * worldDisp / scale2;
      vHover = influence;
      vRelief = height;
    }
  }
`

const CLOUD_SHADER_HEAD = `
uniform sampler2D uDepthMap;
uniform float uUseDepthMap;
uniform float uDepthStrength;
uniform float uFluidCursor;
uniform float uTime;
uniform float uBaseOpacity;
uniform float uHoverOpacity;
uniform float uBrightness;
uniform float uMotion;
uniform vec2 uMouse;
uniform vec2 uVelocity;
uniform vec2 uResolution;
uniform vec2 uTrail[16];
varying vec3 vCloudWorldPos;
varying float vHover;
varying float vRelief;
varying vec2 vSurfaceUv;

${CLOUD_SHARED_FUNCS}

float surfaceHeight(vec2 uv, vec3 worldPos) {
  return uUseDepthMap > 0.5 ? sampleDepth(uv) : reliefHeight(worldPos);
}
`

const CLOUD_MAP_FRAGMENT = `
#ifdef USE_MAP
  vec2 mouseUv = uMouse * 0.5 + 0.5;
  vec2 screenUv = gl_FragCoord.xy / max(uResolution, vec2(1.0));
  float influence = uMotion > 0.001
    ? cursorInfluence(screenUv, mouseUv, uVelocity)
    : 0.0;
  if (uFluidCursor < 0.5) {
    influence = max(influence, vHover);
  }

  vec4 sampledDiffuseColor = texture2D(map, vMapUv);
  diffuseColor *= sampledDiffuseColor;

  float cursorMask = influence * influence * (3.0 - 2.0 * influence);

  if (cursorMask > 0.001) {
    float h = surfaceHeight(vMapUv, vCloudWorldPos);
    float hx = dFdx(h);
    float hy = dFdy(h);
    if (uUseDepthMap > 0.5) {
      float depth = sampleDepth(vMapUv);
      float depthScale = uDepthStrength * 14.0 * cursorMask;
      hx = dFdx(depth) * depthScale;
      hy = dFdy(depth) * depthScale;
      h = mix(0.5, depth, cursorMask);
    }
    vec3 bumpN = normalize(vec3(-hx * 12.0, -hy * 12.0, 1.0));
    vec3 fakeN = normalize(mix(vec3(0.0, 0.0, 1.0), bumpN, 0.65));

    vec3 lightDir = normalize(vec3(0.55, 0.8, 0.45));
    vec3 lightDir2 = normalize(vec3(-0.7, 0.3, 0.35));
    vec3 viewDir = normalize(vec3((screenUv - 0.5) * vec2(-1.5, 1.5), 1.0));
    vec3 R = reflect(-viewDir, fakeN);

    float envY = R.y * 0.5 + 0.5;
    vec3 env = mix(vec3(0.05, 0.03, 0.015), vec3(0.9, 0.75, 0.4), envY);
    env += vec3(1.0, 0.95, 0.82) * pow(saturate(R.y + 0.05), 10.0);
    float brush = fbm(vec2(R.x * 6.0, R.y * 14.0) + vCloudWorldPos.xz * 2.4);
    env *= mix(0.55, 1.55, brush);

    float ndl = saturate(dot(fakeN, lightDir));
    float ndl2 = saturate(dot(fakeN, lightDir2));
    float ndv = max(dot(fakeN, viewDir), 0.001);
    vec3 H = normalize(lightDir + viewDir);
    float ndh = saturate(dot(fakeN, H));
    float ndh2 = saturate(dot(fakeN, normalize(lightDir2 + viewDir)));

    vec3 F0 = vec3(1.0, 0.71, 0.29);
    float fresnel = pow(1.0 - ndv, 5.0);
    vec3 F = mix(F0, vec3(1.0, 0.98, 0.92), fresnel);

    float roughness = mix(0.22, 0.48, 1.0 - h);
    float a = max(roughness * roughness, 0.002);
    float a2 = a * a;
    float denom = ndh * ndh * (a2 - 1.0) + 1.0;
    float D = a2 / (3.14159265 * denom * denom);

    float specSharp = D * ndl * 2.8;
    float specBroad = pow(ndh2, mix(70.0, 18.0, roughness)) * ndl2 * 1.4;
    float hot = pow(ndh, 120.0) * 2.6;

    vec3 metal = env * F0 * (0.45 + ndl * 0.55 + h * 0.15);
    metal += F * (specSharp + specBroad);
    metal += vec3(1.0, 0.93, 0.72) * hot;
    metal += F0 * fresnel * 0.4;

    float detail = dot(sampledDiffuseColor.rgb, vec3(0.299, 0.587, 0.114));
    metal *= mix(0.88, 1.18, detail);
    metal = mix(metal, vec3(1.0, 0.96, 0.88), 0.18);
    metal *= uBrightness;

    float goldMix = saturate(cursorMask * mix(1.05, uHoverOpacity, step(0.5, uFluidCursor)));
    diffuseColor.rgb = mix(diffuseColor.rgb, metal, goldMix);
  }

  if (uFluidCursor > 0.5) {
    diffuseColor.a = 1.0;
  } else {
    diffuseColor.a *= mix(uBaseOpacity, uHoverOpacity, cursorMask);
  }
  if (diffuseColor.a < 0.01) discard;
#endif
`

export function applyCloudHoverMaterial(sourceMat, {
  opacity = 0.2,
  hoverOpacity = 0.5,
  brightness = 1,
  depthMap = null,
  depthStrength = 1,
  fluidCursor = false,
  opaque = false,
  timeUniform = null,
  depthWrite = false,
  motionUniform,
  mouseUniform,
  velocityUniform,
  resolutionUniform,
  trailUniform = null,
} = {}) {
  const map = sourceMat.map ? toRaw(sourceMat.map) : null
  if (map) map.colorSpace = SRGBColorSpace

  const depthTexture = depthMap ? toRaw(depthMap) : getFallbackDepthTexture()
  const useDepthMap = depthMap ? 1 : 0

  const next = new MeshBasicMaterial({
    map,
    side: DoubleSide,
    transparent: !opaque,
    depthWrite,
    toneMapped: false,
  })

  next.customProgramCacheKey = () => `cloud-basic-gold-v23-d${useDepthMap}-f${fluidCursor ? 1 : 0}-o${opaque ? 1 : 0}-b${brightness}-h${hoverOpacity}`
  next.onBeforeCompile = (shader) => {
    shader.uniforms.uBaseOpacity = { value: opacity }
    shader.uniforms.uHoverOpacity = { value: hoverOpacity }
    shader.uniforms.uBrightness = { value: brightness }
    shader.uniforms.uDepthMap = { value: depthTexture }
    shader.uniforms.uUseDepthMap = { value: useDepthMap }
    shader.uniforms.uDepthStrength = { value: depthStrength }
    shader.uniforms.uFluidCursor = { value: fluidCursor ? 1 : 0 }
    shader.uniforms.uTime = timeUniform ?? { value: 0 }
    shader.uniforms.uMotion = motionUniform
    shader.uniforms.uMouse = mouseUniform
    shader.uniforms.uVelocity = velocityUniform
    shader.uniforms.uResolution = resolutionUniform
    shader.uniforms.uTrail = trailUniform ?? {
      value: Array.from({ length: 16 }, () => new Vector2(10, 10)),
    }
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `#include <common>\n${CLOUD_VERTEX_HEAD}`,
    )
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      ${CLOUD_VERTEX_DISPLACE}`,
    )
    shader.vertexShader = shader.vertexShader.replace(
      '#include <project_vertex>',
      `#include <project_vertex>
      vCloudWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
    )
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>\n${CLOUD_SHADER_HEAD}`,
    )
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      CLOUD_MAP_FRAGMENT,
    )
  }
  next.needsUpdate = true
  return next
}

export function applyCloudHoverMaterials(root, options = {}) {
  root.traverse((child) => {
    if (!child.isMesh || !child.material) return

    const mats = Array.isArray(child.material) ? child.material : [child.material]
    const next = mats.map((mat) => applyCloudHoverMaterial(toRaw(mat), options))
    child.material = Array.isArray(child.material) ? next : next[0]
    child.frustumCulled = true
  })
}
