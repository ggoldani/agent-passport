"use client"

import { useRouter, useSearchParams } from "next/navigation"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useCallback } from "react"

const SORT_OPTIONS = [
  { value: "score", label: "Score" },
  { value: "interactions", label: "Interactions" },
  { value: "volume", label: "Volume" },
  { value: "created", label: "Newest" },
  { value: "relevance", label: "Relevance" },
]

export function FilterRow() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const currentSort = searchParams.get("sortBy") ?? "score"

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams)
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
      router.push(`?${params.toString()}`)
    },
    [router, searchParams]
  )

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
      <Select value={currentSort} onValueChange={(v) => updateParam("sortBy", v)}>
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Sort by" />
        </SelectTrigger>
        <SelectContent>
          {SORT_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
