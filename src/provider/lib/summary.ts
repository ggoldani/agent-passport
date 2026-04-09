import type { AccountAnalysis } from "./analyze-account.js"

function joinLabels(labels: string[]): string {
  if (labels.length === 0) {
    return ""
  }

  if (labels.length === 1) {
    return labels[0]
  }

  if (labels.length === 2) {
    return `${labels[0]} and ${labels[1]}`
  }

  return `${labels.slice(0, -1).join(", ")}, and ${labels.at(-1)}`
}

function buildHoldingsClause(analysis: AccountAnalysis): string {
  const positiveAssets = analysis.balances
    .filter((balance) => Number.parseFloat(balance.amount) > 0)
    .map((balance) => balance.asset)

  if (positiveAssets.length === 0) {
    return "shows no positive balances"
  }

  const assetLabels = [...new Set(positiveAssets)].slice(0, 3)
  return `holds ${joinLabels(assetLabels)}`
}

function buildTrustlineClause(analysis: AccountAnalysis): string {
  const count = analysis.trustlines.length

  if (count === 0) {
    return "has no trustlines"
  }

  if (count === 1) {
    return "has 1 trustline"
  }

  return `has ${count} trustlines`
}

function buildActivityClause(analysis: AccountAnalysis): string {
  const { transactionCount, paymentCount } = analysis.recentActivity

  if (transactionCount === 0) {
    return "shows low recent activity"
  }

  if (paymentCount > 0) {
    return "shows recent payment activity"
  }

  if (transactionCount >= 3) {
    return "shows active recent history"
  }

  return "shows light recent activity"
}

export function generateAccountSummary(analysis: AccountAnalysis): string {
  return `This account ${buildHoldingsClause(analysis)}, ${buildTrustlineClause(analysis)}, and ${buildActivityClause(analysis)}.`
}
