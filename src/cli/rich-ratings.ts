export class RichRatingStore {
  getByProvider(_address: string): import("../sdk/types.js").RichRatingRecord[] {
    return []
  }
}

export function loadRichRatingStore(): RichRatingStore {
  return new RichRatingStore()
}
