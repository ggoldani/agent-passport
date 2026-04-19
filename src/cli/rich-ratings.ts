import { existsSync, mkdirSync, readFileSync, renameSync, rmdirSync, unlinkSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"

import type { RichRatingRecord } from "../sdk/types.js"

function isValidRichRatingRecord(obj: unknown): obj is RichRatingRecord {
  if (typeof obj !== "object" || obj === null) return false
  const r = obj as Record<string, unknown>
  if (typeof r.provider_address !== "string") return false
  if (typeof r.consumer_address !== "string") return false
  if (typeof r.interaction_tx_hash !== "string") return false
  if (typeof r.score !== "number" || r.score < 0 || r.score > 100) return false
  if (r.quality !== null && (typeof r.quality !== "number" || r.quality < 1 || r.quality > 5)) return false
  if (r.speed !== null && (typeof r.speed !== "number" || r.speed < 1 || r.speed > 5)) return false
  if (r.reliability !== null && (typeof r.reliability !== "number" || r.reliability < 1 || r.reliability > 5)) return false
  if (r.communication !== null && (typeof r.communication !== "number" || r.communication < 1 || r.communication > 5)) return false
  if (r.comment !== null && typeof r.comment !== "string") return false
  if (typeof r.submitted_at !== "string") return false
  return true
}

const LOCK_STALE_MS = 10_000

class FileLock {
  private readonly lockDir: string
  private acquired = false

  constructor(filePath: string) {
    this.lockDir = filePath + ".lock"
  }

  acquire(): void {
    if (this.acquired) return
    if (existsSync(this.lockDir)) {
      try {
        const stat = readFileSync(this.lockDir, "utf8")
        const age = Date.now() - parseInt(stat, 10)
        if (age > LOCK_STALE_MS) {
          rmdirSync(this.lockDir)
        }
      } catch {
        rmdirSync(this.lockDir)
      }
    }
    try {
      mkdirSync(this.lockDir, { recursive: false })
      writeFileSync(this.lockDir, String(Date.now()))
      this.acquired = true
    } catch {
      throw new Error("Rating store is locked by another process. Try again shortly.")
    }
  }

  release(): void {
    if (!this.acquired) return
    try {
      unlinkSync(this.lockDir)
    } catch {
      // lock file already removed
    }
    this.acquired = false
  }
}

export class RichRatingStore {
  private readonly filePath: string
  private records: RichRatingRecord[]
  private readonly lock: FileLock

  constructor(dataDir?: string) {
    const dir = dataDir ?? resolve(process.cwd(), ".agent-passport")
    this.filePath = resolve(dir, "ratings.json")
    this.lock = new FileLock(this.filePath)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    this.records = this.load()
  }

  private load(): RichRatingRecord[] {
    if (!existsSync(this.filePath)) return []
    const raw = readFileSync(this.filePath, "utf8")
    if (raw.trim().length === 0) return []
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      return []
    }
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isValidRichRatingRecord)
  }

  private save(): void {
    const tmpPath = this.filePath + ".tmp"
    writeFileSync(tmpPath, JSON.stringify(this.records, null, 2))
    renameSync(tmpPath, this.filePath)
  }

  submit(record: RichRatingRecord): void {
    this.lock.acquire()
    try {
      this.records = this.load()
      const normalised = record.interaction_tx_hash.toLowerCase()
      const existingIndex = this.records.findIndex(
        (r) => r.interaction_tx_hash.toLowerCase() === normalised,
      )
      if (existingIndex >= 0) {
        this.records[existingIndex] = record
      } else {
        this.records.push(record)
      }
      this.save()
    } finally {
      this.lock.release()
    }
  }

  getByInteraction(txHash: string): RichRatingRecord | undefined {
    return this.records.find(
      (r) => r.interaction_tx_hash.toLowerCase() === txHash.toLowerCase(),
    )
  }

  getByProvider(address: string): RichRatingRecord[] {
    return this.records.filter((r) => r.provider_address.toLowerCase() === address.toLowerCase())
  }
}

let storeInstance: RichRatingStore | null = null

export function loadRichRatingStore(): RichRatingStore {
  if (storeInstance === null) {
    storeInstance = new RichRatingStore()
  }
  return storeInstance
}
