"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Search, X } from "lucide-react"
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
    const normalized = value.trim()
    if (normalized) {
      params.set("q", normalized)
    } else {
      params.delete("q")
    }
    const qs = params.toString()
    router.replace(qs ? `?${qs}` : "/agents")
  }, [router, searchParams])

  const clearQuery = useCallback(() => {
    setQuery("")
    const params = new URLSearchParams(searchParams)
    params.delete("q")
    const qs = params.toString()
    router.push(qs ? `?${qs}` : "/agents")
  }, [router, searchParams])

  useEffect(() => {
    const timer = setTimeout(() => {
      updateQuery(query)
    }, 300)
    return () => clearTimeout(timer)
  }, [query, updateQuery])

  return (
    <form className="relative" onSubmit={(e) => { e.preventDefault(); updateQuery(query) }}>
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
      <Input
        type="text"
        placeholder="Search agents by name or description..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="h-11 pl-10 pr-10"
      />
      {query ? (
        <button
          type="button"
          onClick={clearQuery}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted transition-colors hover:text-foreground"
          aria-label="Clear search"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </form>
  )
}
