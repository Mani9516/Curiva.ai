/** Hash used for Curiva / patient-landing “About” anchors (`/#pl-about`). */
export const PL_ABOUT_HASH = '#pl-about'

export function scrollPlAboutIntoView() {
  if (typeof window === 'undefined' || window.location.hash !== PL_ABOUT_HASH) return
  requestAnimationFrame(() => {
    document.getElementById('pl-about')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
}
