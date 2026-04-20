"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"
import { useCallback, useEffect, useState } from "react"

export function SearchBar() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [query, setQuery] = useState(searchParams.get("q") ?? "")

  useEffect(() => {
    setQuery(searchParams.get("q") ?? "")
  }, [searchParams])

  const updateQuery = useCallback((value: string) => {
    const params = new URLSearchParams(searchParams)
    if (value.trim()) {
      params.set("q", value.trim())
    } else {
      params.delete("q")
    }
    router.push(`?${params.toString()}`)
  }, [router, searchParams])

  useEffect(() => {
    const timer = setTimeout(() => {
      updateQuery(query)
    }, 300)
    return () => clearTimeout(timer)
  }, [query, updateQuery])

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "var(--muted)" }} />
      <Input
        type="text"
        placeholder="Search agents by name or description..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="pl-10 h-11"
      />
    </div>
  )
}
