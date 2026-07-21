export const WALLET_PACKAGES = [
  { id: '50', coins: 50, bonus: 0, price: 50 },
  { id: '100', coins: 100, bonus: 5, price: 100 },
  { id: '300', coins: 300, bonus: 20, price: 300, popular: true },
  { id: '500', coins: 500, bonus: 50, price: 500 },
  { id: '1000', coins: 1_000, bonus: 150, price: 1_000 },
  { id: '2000', coins: 2_000, bonus: 400, price: 2_000 },
] as const

export function getWalletPackage(packageId: string) {
  return WALLET_PACKAGES.find((item) => item.id === packageId)
}
