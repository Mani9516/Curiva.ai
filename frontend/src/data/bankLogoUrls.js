/**
 * Official-style Indian bank logos (SVG/GIF) from praveenpuglia/indian-banks (MIT)
 * plus Simple Icons for HSBC / Deutsche Bank and Razorpay CDN for Equitas.
 */
const modules = import.meta.glob('../assets/banks/*.{svg,gif,png,ico}', {
  eager: true,
  query: '?url',
  import: 'default',
})

export const BANK_LOGO_URLS = Object.fromEntries(
  Object.entries(modules).map(([filePath, url]) => {
    const key = filePath.match(/\/([^/]+)\.[^.]+$/)?.[1]
    return key ? [key, url] : null
  }).filter(Boolean),
)
