import { describe, expect, test } from "bun:test"
import {
  archiveRoot,
  assetUrl,
  parseChecksums,
  platformAsset,
  renderConfigYaml,
} from "../src/lib/setup"

describe("platformAsset", () => {
  test("maps the supported matrix", () => {
    expect(platformAsset("darwin", "arm64")).toEqual({
      os: "darwin",
      arch: "arm64",
      filename: "apache-answer-%V-bin-darwin-arm64.tar.gz",
    })
    expect(platformAsset("linux", "x64")).toEqual({
      os: "linux",
      arch: "amd64",
      filename: "apache-answer-%V-bin-linux-amd64.tar.gz",
    })
  })

  test("throws on unsupported platform/arch", () => {
    expect(() => platformAsset("win32", "x64")).toThrow(/Unsupported platform/)
    expect(() => platformAsset("darwin", "ia32")).toThrow(
      /Unsupported platform/
    )
  })
})

describe("assetUrl", () => {
  test("substitutes the version into both template slots", () => {
    expect(assetUrl("2.0.2", "apache-answer-%V-bin-darwin-arm64.tar.gz")).toBe(
      "https://github.com/apache/answer/releases/download/v2.0.2/apache-answer-2.0.2-bin-darwin-arm64.tar.gz"
    )
  })
})

describe("parseChecksums", () => {
  test("parses the GitHub checksums.txt format", () => {
    const content = [
      "329a47654c0e3d6295dd2f10dfbba43cc0c0a69750c70db741344d3ac85097df  apache-answer-2.0.2-bin-darwin-amd64.tar.gz",
      "7ebbb5da27bd7b0d0b3a5bf634553ee072da02a5fc5f778c125b50e89b0125f2  apache-answer-2.0.2-bin-darwin-arm64.tar.gz",
      "",
    ].join("\n")
    const map = parseChecksums(content)
    expect(map.size).toBe(2)
    expect(map.get("apache-answer-2.0.2-bin-darwin-arm64.tar.gz")).toBe(
      "7ebbb5da27bd7b0d0b3a5bf634553ee072da02a5fc5f778c125b50e89b0125f2"
    )
  })

  test("ignores non-checksum lines", () => {
    expect(parseChecksums("garbage\nshort  line").size).toBe(0)
  })
})

describe("archiveRoot", () => {
  test("matches the release archive layout", () => {
    expect(archiveRoot("2.0.2", "darwin", "arm64")).toBe(
      "apache-answer-2.0.2-bin-darwin-arm64"
    )
  })
})

describe("renderConfigYaml", () => {
  test("renders the docs/FEEDBACK.md layout with the port substituted", () => {
    const yaml = renderConfigYaml(5555)
    expect(yaml).toContain("addr: 0.0.0.0:5555")
    expect(yaml).toContain("connection: answer-data/db/answer.db")
    expect(yaml).toContain("file_path: answer-data/cache/cache.db")
    expect(yaml).toContain("bundle_dir: answer-data/i18n")
    expect(yaml).toContain("upload_path: answer-data/uploads")
  })

  test("includes the swaggerui section (required in v2 — nil-deref without it)", () => {
    const yaml = renderConfigYaml(5555)
    expect(yaml).toContain("swaggerui:")
    expect(yaml).toContain("show: true")
    expect(yaml).toContain("address: ':5555'")
  })
})
