const STELLAR_ADDRESS = /^G[A-Z2-7]{55}$/

export function isValidStellarAddress(address: string): boolean {
  return STELLAR_ADDRESS.test(address)
}
