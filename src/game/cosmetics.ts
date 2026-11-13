export type CosmeticOption = {
  id: string
  label: string
  color: string
  secondary?: string
}

export const DECKS: CosmeticOption[] = [
  { id: 'ember', label: 'Ember', color: '#e8a838', secondary: '#1a1208' },
  { id: 'tide', label: 'Tide', color: '#2f9e9a', secondary: '#0c1c1b' },
  { id: 'volt', label: 'Volt', color: '#c6ff4a', secondary: '#14180a' },
  { id: 'noir', label: 'Noir', color: '#2a2622', secondary: '#e8e0d4' },
  { id: 'crush', label: 'Crush', color: '#ff6b3d', secondary: '#1a0e0a' },
  { id: 'ghost', label: 'Ghost', color: '#5ad6d0', secondary: '#0a1c1c' },
]

export const SHIRTS: CosmeticOption[] = [
  { id: 'navy', label: 'Navy Zip Jacket', color: '#293d53' },
  { id: 'ink', label: 'Ink Tee', color: '#1d1a17' },
  { id: 'bone', label: 'Bone Tee', color: '#e8e0d4' },
  { id: 'rust', label: 'Rust Hoodie', color: '#8b3a1f' },
  { id: 'pine', label: 'Pine Crew', color: '#2f4a3a' },
  { id: 'cobalt', label: 'Cobalt Flannel', color: '#2a4a6e' },
]

export const PANTS: CosmeticOption[] = [
  { id: 'slate', label: 'Slate Pants', color: '#3a3f46' },
  { id: 'khaki', label: 'Khaki', color: '#8a7a5c' },
  { id: 'black', label: 'Black Jeans', color: '#1a1a1a' },
  { id: 'wash', label: 'Washed Denim', color: '#4a6280' },
]

export const SHOES: CosmeticOption[] = [
  { id: 'gum', label: 'Gum Sole', color: '#c4a574' },
  { id: 'white', label: 'White Vulc', color: '#f0ece4' },
  { id: 'black', label: 'Black High', color: '#222' },
  { id: 'olive', label: 'Olive Low', color: '#5a6340' },
]

export const HATS: CosmeticOption[] = [
  { id: 'helmet', label: 'Matte Helmet', color: '#24292f' },
  { id: 'none', label: 'No Hat', color: 'transparent' },
  { id: 'beanie', label: 'Beanie', color: '#2a2a2a' },
  { id: 'cap', label: 'Cap', color: '#e8a838' },
  { id: 'bucket', label: 'Bucket', color: '#5c5346' },
]

export function findCosmetic(list: CosmeticOption[], id: string): CosmeticOption {
  return list.find((c) => c.id === id) ?? list[0]
}
