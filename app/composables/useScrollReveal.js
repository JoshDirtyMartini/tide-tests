import gsap from 'gsap'
import ScrollTrigger from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

function waitForLayout() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve))
  })
}

function resolveTrigger(rootEl, trigger) {
  if (!rootEl) return null
  if (trigger instanceof Element) return trigger
  if (typeof trigger === 'string') {
    return rootEl.closest(trigger) ?? document.querySelector(trigger)
  }
  return rootEl.closest('section') ?? rootEl
}

export function useScrollReveal(rootRef, options = {}) {
  let ctx
  let resizeObserver

  async function setup(getAnimations) {
    await waitForLayout()
    ctx?.revert()

    const root = rootRef.value
    const trigger = resolveTrigger(root, options.trigger)
    const animations = typeof getAnimations === 'function' ? getAnimations() : getAnimations
    if (!root || !trigger || !animations?.length) return

    ctx = gsap.context(() => {
      for (const { target, scrollTrigger: st, ...vars } of animations) {
        if (!target) continue
        gsap.to(target, {
          ease: 'none',
          ...vars,
          scrollTrigger: {
            trigger,
            scrub: true,
            invalidateOnRefresh: true,
            ...st,
          },
        })
      }
    }, root)

    ScrollTrigger.refresh()
  }

  function observeResize() {
    if (typeof ResizeObserver === 'undefined') return
    resizeObserver?.disconnect()

    resizeObserver = new ResizeObserver(() => ScrollTrigger.refresh())
    const root = rootRef.value
    if (!root) return

    resizeObserver.observe(root)
    const trigger = resolveTrigger(root, options.trigger)
    if (trigger && trigger !== root) {
      resizeObserver.observe(trigger)
    }
  }

  function cleanup() {
    ctx?.revert()
    resizeObserver?.disconnect()
    resizeObserver = null
  }

  function refresh() {
    ScrollTrigger.refresh()
  }

  return { setup, observeResize, cleanup, refresh }
}

export function collectScrollRevealAnimations(container, refs = {}) {
  if (!container) return []

  const marked = container.querySelectorAll('[data-scroll-reveal]')
  if (marked.length) {
    return [...marked].map((el) => ({
      target: el,
      opacity: 1,
      scrollTrigger: {
        start: el.dataset.start ?? 'top bottom',
        end: el.dataset.end ?? 'bottom top',
      },
    }))
  }

  const animations = []
  for (const [key, config] of Object.entries(refs)) {
    const target = config.ref?.value ?? config.ref
    if (!target) continue
    animations.push({
      target,
      opacity: 1,
      scrollTrigger: config.scrollTrigger ?? {},
    })
  }
  return animations
}
