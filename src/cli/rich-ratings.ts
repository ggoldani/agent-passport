import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"

import type { RichRatingRecord } from "../sdk/types.js"

export class RichRatingStore {
  private readonly filePath: string
  private records: RichRatingRecord[]

  constructor(dataDir?: string) {
    const dir = dataDir ?? resolve(process.cwd(), ".agent-passport")
    this.filePath = resolve(dir, "ratings.json")
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    this.records = this.load()
  }

  private load(): RichRatingRecord[] {
    if (!existsSync(this.filePath)) return []
    const raw = readFileSync(this.filePath, "utf8")
    if (raw.trim().length === 0) return []
    return JSON.parse(raw) as RichRatingRecord[]
  }

  private save(): void {
    writeFileSync(this.filePath, JSON.stringify(this.records, null, 2))
  }

  submit(record: RichRatingRecord): void {
    const existingIndex = this.records.findIndex(
      (r) => r.interaction_tx_hash === record.interaction_tx_hash,
    )
    if (existingIndex >= 0) {
      this.records[existingIndex] = record
    } else {
      this.records.push(record)
    }
    this.save()
  }

  getByInteraction(txHash: string): RichRatingRecord | undefined {
    return this.records.find(
      (r) => r.interaction_tx_hash.toLowerCase() === txHash.toLowerCase(),
    )
  }

  getByProvider(address: string): RichRatingRecord[] {
    return this.records.filter((r) => r.provider_address === address)
  }
}

let storeInstance: RichRatingStore | null = null

export function loadRichRatingStore(): RichRatingStore {
  if (storeInstance === null) {
    storeInstance = new RichRatingStore()
  }
  return storeInstance
}
