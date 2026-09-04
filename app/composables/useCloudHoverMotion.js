import { Vector2 } from 'three'

export function useCloudHoverMotion(pointer, {
  reducedEffects = ref(false),
  active = null,
  fluidHover = false,
  followEase = 0.22,
  velocityEase = 0.18,
  velocityDecay = 0.92,
  motionFadeIn = 0.08,
  motionFadeOut = 0.85,
  stillDelay = 0,
  trailSize = 16,
  trailMinStep = 0.008,
  trailDecay = 0.38,
} = {}) {
  const waterMouse = { value: new Vector2(2, 2) }
  const waterVelocity = { value: new Vector2(0, 0) }
  const waterResolution = { value: new Vector2(1, 1) }
  const waterMotion = { value: 0 }
  const waterTrail = {
    value: Array.from({ length: trailSize }, () => new Vector2(10, 10)),
  }

  const trail = Array.from({ length: trailSize }, () => ({ x: 10, y: 10 }))
  const waterFollow = { x: 10, y: 10 }
  let lastWaterX = 10
  let lastWaterY = 10
  let wasActive = false
  let stillTime = 0
  let heldMotion = 0
  let trailStrength = 0

  function resetTrail(x, y) {
    for (let i = 0; i < trailSize; i++) {
      trail[i].x = x
      trail[i].y = y
      waterTrail.value[i].set(x, y)
    }
    trailStrength = 0
  }

  function pushTrail(x, y) {
    for (let i = trailSize - 1; i > 0; i--) {
      trail[i].x = trail[i - 1].x
      trail[i].y = trail[i - 1].y
    }
    trail[0].x = x
    trail[0].y = y
  }

  function syncTrailUniforms() {
    for (let i = 0; i < trailSize; i++) {
      waterTrail.value[i].set(trail[i].x, trail[i].y)
    }
  }

  function updateTrail({ x, y, speed, delta, isActive }) {
    if (!fluidHover) return

    if (!isActive) {
      trail[0].x = x
      trail[0].y = y
      const collapse = 1 - Math.exp(-delta / 0.14)
      for (let i = 1; i < trailSize; i++) {
        trail[i].x += (x - trail[i].x) * collapse * (0.7 + i * 0.08)
        trail[i].y += (y - trail[i].y) * collapse * (0.7 + i * 0.08)
      }
      trailStrength = Math.max(0, trailStrength - delta * 3.5)
      syncTrailUniforms()
      return
    }

    if (speed > 0.02) {
      const dist = Math.hypot(x - trail[0].x, y - trail[0].y)
      const step = Math.max(0.004, trailMinStep - Math.min(speed, 1.5) * 0.003)
      if (dist >= step) {
        pushTrail(x, y)
      } else {
        trail[0].x = x
        trail[0].y = y
      }
      trailStrength = Math.min(1, trailStrength + delta * 4.5)
    } else {
      trail[0].x = x
      trail[0].y = y
      const decay = 1 - Math.exp(-delta / trailDecay)
      for (let i = 1; i < trailSize; i++) {
        const weight = decay * (0.35 + i * 0.08)
        trail[i].x += (x - trail[i].x) * weight
        trail[i].y += (y - trail[i].y) * weight
      }
      trailStrength = Math.max(0, trailStrength - delta * 2.2)
    }

    syncTrailUniforms()
  }

  function trailIsActive() {
    if (trailStrength > 0.02) return true
    for (let i = 1; i < trailSize; i++) {
      if (Math.hypot(trail[i].x - trail[0].x, trail[i].y - trail[0].y) > 0.01) {
        return true
      }
    }
    return false
  }

  function update({ delta, renderer }) {
    if (reducedEffects?.value) return

    if (fluidHover && active?.value && !wasActive) {
      waterFollow.x = pointer.x
      waterFollow.y = pointer.y
      lastWaterX = pointer.x
      lastWaterY = pointer.y
      waterVelocity.value.set(0, 0)
      stillTime = 0
      heldMotion = 0
      resetTrail(pointer.x, pointer.y)
    }
    wasActive = Boolean(active?.value)

    waterFollow.x += (pointer.x - waterFollow.x) * followEase
    waterFollow.y += (pointer.y - waterFollow.y) * followEase

    const invDelta = 1 / Math.max(delta, 0.001)

    const vx = (waterFollow.x - lastWaterX) * invDelta
    const vy = (waterFollow.y - lastWaterY) * invDelta

    waterVelocity.value.x += (vx - waterVelocity.value.x) * velocityEase
    waterVelocity.value.y += (vy - waterVelocity.value.y) * velocityEase

    lastWaterX = waterFollow.x
    lastWaterY = waterFollow.y

    const speed = Math.hypot(waterVelocity.value.x, waterVelocity.value.y)
    const motionFromSpeed = Math.min(1, Math.max(0, (speed - 0.04) / 0.45))
    const moving = speed > 0.02

    if (moving) {
      stillTime = 0
      heldMotion = Math.max(heldMotion, motionFromSpeed, waterMotion.value)
    } else {
      stillTime += delta
    }

    if (fluidHover && active?.value && speed < 0.02 && stillTime >= stillDelay) {
      const decay = 1 - Math.exp(-delta / 0.35)
      waterVelocity.value.x *= 1 - decay * (1 - velocityDecay)
      waterVelocity.value.y *= 1 - decay * (1 - velocityDecay)
    }

    let target
    if (fluidHover && active) {
      if (!active.value) {
        target = 0
        heldMotion = 0
        stillTime = 0
      } else if (moving) {
        target = motionFromSpeed
      } else if (stillTime < stillDelay) {
        target = heldMotion
      } else {
        target = 0
      }
    } else if (active) {
      target = active.value ? Math.max(motionFromSpeed, 1) : 0
    } else {
      target = motionFromSpeed
    }

    const blend = target > waterMotion.value
      ? 1 - Math.exp(-delta / motionFadeIn)
      : 1 - Math.exp(-delta / motionFadeOut)
    waterMotion.value += (target - waterMotion.value) * blend

    if (target <= 0.01) {
      heldMotion = 0
    }

    waterMouse.value.set(waterFollow.x, waterFollow.y)
    updateTrail({
      x: waterFollow.x,
      y: waterFollow.y,
      speed,
      delta,
      isActive: Boolean(active?.value),
    })
    if (fluidHover && trailStrength > waterMotion.value) {
      waterMotion.value = Math.max(waterMotion.value, trailStrength * 0.4)
    }
    waterResolution.value.set(renderer.domElement.width, renderer.domElement.height)
  }

  return {
    waterMouse,
    waterVelocity,
    waterResolution,
    waterMotion,
    waterTrail,
    trailIsActive,
    update,
  }
}
