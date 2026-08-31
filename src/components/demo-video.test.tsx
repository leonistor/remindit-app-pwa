// Component render test for DemoVideo (src/components/demo-video).
//
// DemoVideo autoplays muted + looping while scrolled into the viewport
// (useAutoplayInView) and falls back to native controls under
// prefers-reduced-motion or when the browser rejects play(). happy-dom
// doesn't decode/play videos, so we stub IntersectionObserver and the
// media methods and assert element attributes + play/pause calls only.

import { afterEach, beforeEach, describe, expect, test } from "@rstest/core"
import { act, cleanup, render } from "@testing-library/react"
import { DemoVideo } from "@/components/demo-video"

// Captures the observer instance the hook creates so tests can drive
// intersection changes manually.
class MockIntersectionObserver {
  static last: MockIntersectionObserver | null = null

  callback: IntersectionObserverCallback
  element: Element | null = null
  disconnected = false

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback
    MockIntersectionObserver.last = this
  }

  observe(element: Element) {
    this.element = element
  }

  disconnect() {
    this.disconnected = true
  }

  unobserve() {}

  // Simulate a viewport transition for the observed element.
  trigger(isIntersecting: boolean) {
    this.callback(
      [{ isIntersecting, target: this.element } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver
    )
  }
}

const originalMatchMedia = window.matchMedia
const originalIntersectionObserver = window.IntersectionObserver

const stubMatchMedia = (reducedMotion: boolean) => {
  window.matchMedia = ((query: string) => ({
    matches: reducedMotion && query.includes("prefers-reduced-motion"),
    media: query,
  })) as unknown as typeof window.matchMedia
}

const renderedVideo = () => document.querySelector("video") as HTMLVideoElement

beforeEach(() => {
  localStorage.clear()
  stubMatchMedia(false)
  window.IntersectionObserver =
    MockIntersectionObserver as unknown as typeof IntersectionObserver
})

// Restore the originals so other suites are unaffected by the stubs.
afterEach(() => {
  cleanup()
  window.matchMedia = originalMatchMedia
  window.IntersectionObserver = originalIntersectionObserver
  MockIntersectionObserver.last = null
})

describe("DemoVideo", () => {
  test("autoplays muted and looping without controls by default", () => {
    render(<DemoVideo scenario="01-onboarding" />)
    const video = renderedVideo()

    expect(video).not.toBeNull()
    // React applies `muted` as a DOM property (autoplay policies read it),
    // while the other flags land as real attributes.
    expect(video.muted).toBe(true)
    expect(video.hasAttribute("loop")).toBe(true)
    expect(video.hasAttribute("autoplay")).toBe(true)
    expect(video.hasAttribute("playsinline")).toBe(true)
    expect(video.getAttribute("preload")).toBe("auto")
    expect(video.hasAttribute("controls")).toBe(false)
    expect(MockIntersectionObserver.last?.element).toBe(video)
  })

  test("plays on viewport entry and pauses on exit", () => {
    render(<DemoVideo scenario="01-onboarding" />)
    const video = renderedVideo()
    const observer = MockIntersectionObserver.last as MockIntersectionObserver

    let played = 0
    let paused = 0
    video.play = () => {
      played += 1
      return Promise.resolve()
    }
    video.pause = () => {
      paused += 1
    }

    act(() => observer.trigger(true))
    act(() => observer.trigger(false))
    act(() => observer.trigger(true))

    expect(played).toBe(2)
    expect(paused).toBe(1)
    expect(observer.disconnected).toBe(false)
  })

  test("falls back to controls when play() is rejected", async () => {
    render(<DemoVideo scenario="01-onboarding" />)
    const video = renderedVideo()
    const observer = MockIntersectionObserver.last as MockIntersectionObserver

    // Simulate a strict autoplay policy (e.g. iOS Low Power Mode).
    video.play = () => Promise.reject(new Error("NotAllowedError"))

    await act(async () => observer.trigger(true))

    expect(observer.disconnected).toBe(true)
    expect(video.hasAttribute("controls")).toBe(true)
  })

  test("shows manual controls under prefers-reduced-motion", () => {
    stubMatchMedia(true)
    render(<DemoVideo scenario="01-onboarding" />)
    const video = renderedVideo()

    expect(video.hasAttribute("controls")).toBe(true)
    // No autoplay machinery in manual mode.
    expect(video.hasAttribute("autoplay")).toBe(false)
    expect(MockIntersectionObserver.last).toBeNull()
  })
})
