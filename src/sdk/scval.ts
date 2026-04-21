import { nativeToScVal, xdr } from "@stellar/stellar-sdk"
import { Buffer } from "node:buffer"

import type {
  AgentPassportMethodArgs,
  AgentPassportMethodName,
} from "./agent-passport.js"
import type {
  AgentProfileInput,
  InteractionRecord,
  RatingInput,
} from "./types.js"

function buildAgentProfileInputScVal(input: AgentProfileInput): xdr.ScVal {
  const stringEntry = (key: string, value: string): xdr.ScMapEntry =>
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol(key),
      val: nativeToScVal(value, { type: "string" }),
    })

  const optionalStringEntry = (
    key: string,
    value: string | null,
  ): xdr.ScMapEntry =>
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol(key),
      val:
        value === null
          ? xdr.ScVal.scvVoid()
          : nativeToScVal(value, { type: "string" }),
    })

  return xdr.ScVal.scvMap([
    stringEntry("description", input.description),
    optionalStringEntry("mcp_server_url", input.mcp_server_url),
    stringEntry("name", input.name),
    optionalStringEntry("payment_endpoint", input.payment_endpoint),
    optionalStringEntry("service_url", input.service_url),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("tags"),
      val: xdr.ScVal.scvVec(
        input.tags.map((tag) => nativeToScVal(tag, { type: "string" })),
      ),
    }),
  ])
}

function buildInteractionRecordScVal(record: InteractionRecord): xdr.ScVal {
  return xdr.ScVal.scvMap([
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("amount"),
      val: nativeToScVal(record.amount, { type: "i128" }),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("consumer_address"),
      val: nativeToScVal(record.consumer_address, { type: "address" }),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("provider_address"),
      val: nativeToScVal(record.provider_address, { type: "address" }),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("service_label"),
      val:
        record.service_label === null
          ? xdr.ScVal.scvVoid()
          : nativeToScVal(record.service_label, { type: "string" }),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("timestamp"),
      val: nativeToScVal(record.timestamp, { type: "u64" }),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("tx_hash"),
      val: xdr.ScVal.scvBytes(Buffer.from(record.tx_hash, "hex")),
    }),
  ])
}

function buildRatingInputScVal(rating: RatingInput): xdr.ScVal {
  return xdr.ScVal.scvMap([
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("consumer_address"),
      val: nativeToScVal(rating.consumer_address, { type: "address" }),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("interaction_tx_hash"),
      val: xdr.ScVal.scvBytes(
        Buffer.from(rating.interaction_tx_hash, "hex"),
      ),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("provider_address"),
      val: nativeToScVal(rating.provider_address, { type: "address" }),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("score"),
      val: nativeToScVal(rating.score, { type: "u32" }),
    }),
  ])
}

export function buildMethodArgs(
  method: AgentPassportMethodName,
  args: AgentPassportMethodArgs[AgentPassportMethodName],
): xdr.ScVal[] {
  switch (method) {
    case "init":
    case "update_relayer": {
      const a = args as AgentPassportMethodArgs["init"]
      return [
        nativeToScVal(a[0], { type: "address" }),
        nativeToScVal(a[1], { type: "address" }),
      ]
    }
    case "get_config":
    case "list_agents":
      return []
    case "get_agent":
    case "list_agent_interactions": {
      const a = args as AgentPassportMethodArgs["get_agent"]
      return [nativeToScVal(a[0], { type: "address" })]
    }
    case "get_rating": {
      const a = args as AgentPassportMethodArgs["get_rating"]
      return [xdr.ScVal.scvBytes(Buffer.from(a[0], "hex"))]
    }
    case "register_agent": {
      const a = args as AgentPassportMethodArgs["register_agent"]
      return [
        nativeToScVal(a[0], { type: "address" }),
        buildAgentProfileInputScVal(a[1]),
      ]
    }
    case "register_interaction": {
      const a = args as AgentPassportMethodArgs["register_interaction"]
      return [
        nativeToScVal(a[0], { type: "address" }),
        buildInteractionRecordScVal(a[1]),
      ]
    }
    case "submit_rating": {
      const a = args as AgentPassportMethodArgs["submit_rating"]
      return [buildRatingInputScVal(a[0])]
    }
  }
}
