import { cloneElement } from 'react'
import { LOGOS } from '../../data/logos.jsx'
import { BANK_LOGO_URLS } from '../../data/bankLogoUrls.js'

/**
 * Renders a brand mark: bundled bank logo, Simple Icons SVG, LOGOS fallback, or initials.
 */
export default function BrandIcon({ si, logoKey, label, size = 48 }) {
  const bankLogoUrl = logoKey && BANK_LOGO_URLS[logoKey]
  if (bankLogoUrl) {
    return (
      <span
        className="brand-icon-fallback brand-icon-fallback--img"
        style={{ width: size, height: size, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
        aria-label={label}
      >
        <img
          src={bankLogoUrl}
          alt={label || ''}
          width={size}
          height={size}
          draggable={false}
          style={{ width: size, height: size, objectFit: 'contain', display: 'block', borderRadius: Math.round(size * 0.14), background: '#fff' }}
        />
      </span>
    )
  }
  if (si?.path && si?.hex) {
    return (
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        role="img"
        aria-label={label}
        xmlns="http://www.w3.org/2000/svg"
      >
        <title>{label}</title>
        <path fill={`#${si.hex}`} d={si.path} />
      </svg>
    )
  }
  const el = logoKey && LOGOS[logoKey]
  if (el) {
    if (el.type === 'img') {
      return (
        <span
          className="brand-icon-fallback brand-icon-fallback--img"
          style={{ width: size, height: size, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
          aria-label={label}
        >
          <img
            src={el.props.src}
            alt={label || el.props.alt || ''}
            width={size}
            height={size}
            draggable={false}
            style={{ width: size, height: size, objectFit: 'contain', display: 'block', borderRadius: Math.round(size * 0.14), background: '#fff' }}
          />
        </span>
      )
    }
    return (
      <span
        className="brand-icon-fallback"
        style={{ width: size, height: size, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
        aria-label={label}
      >
        {cloneElement(el, { width: Math.round(size * 0.88), height: Math.round(size * 0.88) })}
      </span>
    )
  }
  const initials = (label || '?').replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase() || '?'
  return (
    <span
      className="brand-icon-initials"
      style={{
        width: size,
        height: size,
        fontSize: Math.max(12, size * 0.28),
        borderRadius: 12,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,229,255,0.12)',
        border: '1px solid var(--border-card)',
        fontWeight: 800,
        color: 'var(--accent-cyan)',
      }}
    >
      {initials}
    </span>
  )
}
