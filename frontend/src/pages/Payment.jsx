import { useState, useEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import {
  siPhonepe,
  siPaytm,
  siGooglepay,
  siVisa,
  siMastercard,
  siAmericanexpress,
  siDiscover,
} from 'simple-icons'
import { API } from '../api'
import BrandIcon from '../components/payment/BrandIcon.jsx'
import { INDIAN_BANKS } from '../data/indianBanksList.js'

const PRESETS = [
  { label: 'Teleconsultation', amount: 499, desc: 'Video / phone consult with clinician' },
  { label: 'OPD visit', amount: 399, desc: 'Outpatient department registration' },
  { label: 'Lab panel (basic)', amount: 1499, desc: 'Basic health checkup — blood work' },
  { label: 'Radiology (US)', amount: 1199, desc: 'Ultrasound abdomen / pelvis' },
  { label: 'Annual package', amount: 3499, desc: 'Comprehensive screening bundle' },
]

const METHODS = [
  { id: 'upi', label: 'UPI', icon: '📱', hint: 'PhonePe, GPay, Paytm, BHIM, Navi' },
  { id: 'card', label: 'Card', icon: '💳', hint: 'Visa, Mastercard, RuPay' },
  { id: 'netbanking', label: 'Net banking', icon: '🏦', hint: 'All major Indian banks' },
]

const UPI_APPS = [
  { id: 'phonepe', name: 'PhonePe', si: siPhonepe },
  { id: 'paytm', name: 'Paytm', si: siPaytm },
  { id: 'gpay', name: 'Google Pay', si: siGooglepay },
  { id: 'navi', name: 'Navi', logoKey: 'navi' },
  { id: 'bhim', name: 'BHIM UPI', logoKey: 'bhim' },
]

const CARD_NETWORK_SI = [
  { label: 'Visa', si: siVisa },
  { label: 'Mastercard', si: siMastercard },
  { label: 'American Express', si: siAmericanexpress },
  { label: 'Discover', si: siDiscover },
]

function digitsOnly(s) {
  return (s || '').replace(/\D/g, '')
}

function formatCardNumber(raw) {
  const d = digitsOnly(raw).slice(0, 19)
  return d.replace(/(\d{4})(?=\d)/g, '$1 ').trim()
}

function detectCardBrand(num) {
  const d = digitsOnly(num)
  if (/^4/.test(d)) return 'Visa'
  if (/^(5[1-5]|222[1-9]|22[3-9]|2[3-6]|27[01]|2720)/.test(d)) return 'Mastercard'
  if (/^3[47]/.test(d)) return 'American Express'
  if (/^(6011|65|64[4-9]|622)/.test(d)) return 'Discover'
  if (/^(60|652)/.test(d)) return 'RuPay'
  return 'Card'
}

function isValidUpiId(v) {
  return /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z]{2,64}$/.test((v || '').trim())
}

function isValidIfsc(v) {
  return /^[A-Z]{4}0[A-Z0-9]{6}$/i.test((v || '').trim())
}

function fmtInr(n) {
  if (!Number.isFinite(n)) return '—'
  return Number(n).toLocaleString('en-IN')
}

export default function Payment({ user, onToast, onRecordsMutated }) {
  const isBillingStaff = user?.role === 'doctor' || user?.role === 'manager'
  const [amount, setAmount] = useState(499)
  const [description, setDescription] = useState(PRESETS[0].desc)
  const [selectedPreset, setSelectedPreset] = useState(PRESETS[0].label)
  const [method, setMethod] = useState('upi')
  const [busy, setBusy] = useState(false)
  const [history, setHistory] = useState([])
  const [ledger, setLedger] = useState([])

  const [checkoutStep, setCheckoutStep] = useState('idle')
  const [upiAppId, setUpiAppId] = useState(null)
  const [upiVpa, setUpiVpa] = useState('')
  const [upiPin, setUpiPin] = useState('')

  const [nbBankId, setNbBankId] = useState(null)
  const [nbSearch, setNbSearch] = useState('')
  const [nbAccount, setNbAccount] = useState('')
  const [nbIfsc, setNbIfsc] = useState('')
  const [nbName, setNbName] = useState('')

  const [cardNumber, setCardNumber] = useState('')
  const [cardExpiry, setCardExpiry] = useState('')
  const [cardCvv, setCardCvv] = useState('')
  const [cardName, setCardName] = useState('')

  const [lastRef, setLastRef] = useState('')
  const [lastAmount, setLastAmount] = useState(0)
  const [lastMethodLabel, setLastMethodLabel] = useState('')

  const filteredBanks = useMemo(() => {
    const q = nbSearch.trim().toLowerCase()
    if (!q) return INDIAN_BANKS
    return INDIAN_BANKS.filter((b) => b.name.toLowerCase().includes(q) || b.id.includes(q))
  }, [nbSearch])

  const selectedUpiApp = UPI_APPS.find((a) => a.id === upiAppId)
  const selectedBank = INDIAN_BANKS.find((b) => b.id === nbBankId)
  const cardBrand = detectCardBrand(cardNumber)

  const refresh = useCallback(async () => {
    try {
      const mine = await API.listPayments(user.id)
      setHistory(Array.isArray(mine) ? mine : [])
      if (isBillingStaff) {
        const all = await API.listPaymentsLedger()
        setLedger(Array.isArray(all) ? all : [])
      } else {
        setLedger([])
      }
    } catch {
      setHistory([])
      setLedger([])
    }
  }, [user.id, user.role])

  useEffect(() => {
    refresh()
  }, [refresh])

  const resetCheckout = () => {
    setCheckoutStep('idle')
    setUpiAppId(null)
    setUpiVpa('')
    setUpiPin('')
    setNbBankId(null)
    setNbSearch('')
    setNbAccount('')
    setNbIfsc('')
    setNbName('')
    setCardNumber('')
    setCardExpiry('')
    setCardCvv('')
    setCardName('')
  }

  const applyPreset = (p) => {
    if (busy) return
    setAmount(p.amount)
    setDescription(p.desc)
    setSelectedPreset(p.label)
    if (checkoutStep !== 'idle' && checkoutStep !== 'success') {
      resetCheckout()
    }
  }

  const beginCheckout = (e) => {
    e.preventDefault()
    const amt = amount === '' ? NaN : Number(amount)
    if (!Number.isFinite(amt) || amt < 1) {
      onToast('Enter a valid amount (INR)', 'error')
      return
    }
    if (method === 'upi') setCheckoutStep('upi_app')
    else if (method === 'netbanking') setCheckoutStep('nb_banks')
    else setCheckoutStep('card')
  }

  const finalizePayment = async (methodStr, label) => {
    const amt = amount === '' ? NaN : Number(amount)
    if (!Number.isFinite(amt) || amt < 1) return
    setBusy(true)
    try {
      await new Promise((r) => setTimeout(r, 450))
      const data = await API.createPayment({
        user_id: user.id,
        amount_inr: amt,
        description: description.trim() || 'Curiva payment',
        method: methodStr.slice(0, 120),
      })
      if (data.success) {
        setLastRef(data.payment.reference_id)
        setLastAmount(amt)
        setLastMethodLabel(label)
        onToast(`Paid ₹${amt} — ${data.payment.reference_id}`, 'success')
        setCheckoutStep('success')
        onRecordsMutated?.()
        await refresh()
      }
    } catch (err) {
      onToast(err.message || 'Payment failed', 'error')
    } finally {
      setBusy(false)
    }
  }

  const handleUpiPinSubmit = (e) => {
    e.preventDefault()
    const pin = digitsOnly(upiPin)
    if (pin.length < 4 || pin.length > 6) {
      onToast('Enter a 4–6 digit UPI PIN (demo)', 'error')
      return
    }
    const app = selectedUpiApp?.name || 'UPI'
    const vpa = upiVpa.trim()
    finalizePayment(`upi:${app}:${vpa}`, `${app} · ${vpa}`)
  }

  const handleNbSubmit = (e) => {
    e.preventDefault()
    if (!selectedBank) return
    if (digitsOnly(nbAccount).length < 9) {
      onToast('Enter a valid account number (demo)', 'error')
      return
    }
    if (!isValidIfsc(nbIfsc)) {
      onToast('Enter valid IFSC (11 characters, e.g. HDFC0001234)', 'error')
      return
    }
    if (!nbName.trim()) {
      onToast('Enter account holder name', 'error')
      return
    }
    finalizePayment(`netbanking:${selectedBank.name}`, `Net banking · ${selectedBank.name}`)
  }

  const handleCardSubmit = (e) => {
    e.preventDefault()
    const num = digitsOnly(cardNumber)
    if (num.length < 15) {
      onToast('Enter a complete card number', 'error')
      return
    }
    if (!/^\d{2}\/\d{2}$/.test(cardExpiry.trim())) {
      onToast('Expiry as MM/YY', 'error')
      return
    }
    if (digitsOnly(cardCvv).length < 3) {
      onToast('Enter CVV', 'error')
      return
    }
    if (!cardName.trim()) {
      onToast('Enter name on card', 'error')
      return
    }
    finalizePayment(`card:${cardBrand}`, `${cardBrand} card`)
  }

  useEffect(() => {
    if (checkoutStep !== 'upi_pin') return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [checkoutStep])

  return (
    <div>
      <div className="page-title">
        <h2>{isBillingStaff ? 'Payments & billing' : 'Pay your bill'}</h2>
        <p>
          {isBillingStaff
            ? 'Record patient-facing charges and review recent hospital receipts (demo — no live processor).'
            : 'Settle consults, lab tests, and packages securely (demo — no real card or UPI data is stored).'}
        </p>
      </div>

      <div className="grid-2-1" style={{ gap: 20, alignItems: 'start' }}>
        <div className="glass-card payment-checkout-card">
          <div className="glass-card-header">
            <div className="glass-card-title">
              <span className="icon">💳</span>
              <div>
                <h3>{checkoutStep === 'success' ? 'Payment successful' : 'New payment'}</h3>
                <span className="sub">
                  {checkoutStep === 'success'
                    ? 'Your receipt is saved below'
                    : 'Amount in INR · choose method · step-by-step demo checkout'}
                </span>
              </div>
            </div>
          </div>
          <div className="glass-card-body">
            {checkoutStep === 'success' ? (
              <div className="payment-success-block">
                <div className="payment-success-icon" aria-hidden>✓</div>
                <p className="payment-success-amount">₹{fmtInr(lastAmount)}</p>
                <p className="payment-success-meta">{lastMethodLabel}</p>
                <p className="payment-success-ref">
                  Reference: <code>{lastRef}</code>
                </p>
                <button type="button" className="login-btn" onClick={() => resetCheckout()}>
                  Make another payment
                </button>
              </div>
            ) : (
              <>
                <div className="form-group">
                  <label>Quick amounts</label>
                  <div className="payment-preset-row">
                    {PRESETS.map((p) => (
                      <button
                        key={p.label}
                        type="button"
                        className={`payment-preset-chip ${selectedPreset === p.label ? 'active' : ''}`}
                        onClick={() => applyPreset(p)}
                        disabled={busy}
                      >
                        <strong>₹{fmtInr(p.amount)}</strong>
                        <span>{p.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {checkoutStep === 'idle' && (
                  <form onSubmit={beginCheckout} className="login-form" style={{ marginTop: 8 }}>
                    <div className="form-group">
                      <label htmlFor="pay-amt">Amount (INR)</label>
                      <div className="input-wrapper">
                        <span className="input-icon">₹</span>
                        <input
                          id="pay-amt"
                          type="number"
                          min="1"
                          step="1"
                          value={amount === '' ? '' : amount}
                          onChange={(e) => {
                            const v = e.target.value
                            setAmount(v === '' ? '' : Number(v))
                            setSelectedPreset(null)
                          }}
                          disabled={busy}
                        />
                      </div>
                    </div>
                    <div className="form-group">
                      <label htmlFor="pay-desc">Description</label>
                      <div className="input-wrapper">
                        <span className="input-icon">📝</span>
                        <input
                          id="pay-desc"
                          type="text"
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          disabled={busy}
                          placeholder="What is this payment for?"
                        />
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Payment option</label>
                      <div className="payment-method-grid">
                        {METHODS.map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            className={`payment-method-tile ${method === m.id ? 'active' : ''}`}
                            onClick={() => setMethod(m.id)}
                            disabled={busy}
                          >
                            <span className="pm-icon">{m.icon}</span>
                            <strong>{m.label}</strong>
                            <span className="pm-hint">{m.hint}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <button type="submit" className="login-btn" disabled={busy}>
                      Continue securely
                    </button>
                    <p className="payment-disclaimer">
                      Demo only: you will pick your UPI app / bank / card details on the next screens. Nothing sensitive is sent to a
                      real gateway.
                    </p>
                  </form>
                )}

                {checkoutStep === 'upi_app' && (
                  <div className="payment-wizard-step">
                    <button type="button" className="payment-wizard-back" onClick={() => resetCheckout()} disabled={busy}>
                      ← Back
                    </button>
                    <h4 className="payment-wizard-title">Pay with UPI</h4>
                    <p className="payment-wizard-sub">Choose your app (official brand marks via Simple Icons / Curiva assets)</p>
                    <div className="payment-brand-grid">
                      {UPI_APPS.map((app) => (
                        <button
                          key={app.id}
                          type="button"
                          className={`payment-brand-tile ${upiAppId === app.id ? 'active' : ''}`}
                          onClick={() => {
                            setUpiAppId(app.id)
                            setCheckoutStep('upi_vpa')
                          }}
                          disabled={busy}
                        >
                          <BrandIcon si={app.si} logoKey={app.logoKey} label={app.name} size={44} />
                          <span>{app.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {checkoutStep === 'upi_vpa' && (
                  <div className="payment-wizard-step">
                    <button
                      type="button"
                      className="payment-wizard-back"
                      onClick={() => {
                        setCheckoutStep('upi_app')
                        setUpiVpa('')
                      }}
                      disabled={busy}
                    >
                      ← Back
                    </button>
                    <h4 className="payment-wizard-title">Enter UPI ID</h4>
                    <p className="payment-wizard-sub">
                      {selectedUpiApp ? (
                        <span className="payment-inline-brand">
                          <BrandIcon si={selectedUpiApp.si} logoKey={selectedUpiApp.logoKey} label={selectedUpiApp.name} size={28} />
                          {selectedUpiApp.name}
                        </span>
                      ) : null}
                    </p>
                    <form
                      className="login-form"
                      onSubmit={(e) => {
                        e.preventDefault()
                        if (!isValidUpiId(upiVpa)) {
                          onToast('Enter a valid UPI ID (name@bank)', 'error')
                          return
                        }
                        setCheckoutStep('upi_pin')
                      }}
                    >
                      <div className="form-group">
                        <label htmlFor="upi-vpa">UPI ID (VPA)</label>
                        <div className="input-wrapper">
                          <span className="input-icon">@</span>
                          <input
                            id="upi-vpa"
                            type="text"
                            autoComplete="off"
                            placeholder="youname@paytm"
                            value={upiVpa}
                            onChange={(e) => setUpiVpa(e.target.value)}
                            disabled={busy}
                          />
                        </div>
                      </div>
                      <button type="submit" className="login-btn" disabled={busy}>
                        Continue
                      </button>
                    </form>
                  </div>
                )}

                {checkoutStep === 'nb_banks' && (
                  <div className="payment-wizard-step">
                    <button type="button" className="payment-wizard-back" onClick={() => resetCheckout()} disabled={busy}>
                      ← Back
                    </button>
                    <h4 className="payment-wizard-title">Select your bank</h4>
                    <div className="input-wrapper" style={{ marginBottom: 12 }}>
                      <span className="input-icon">🔎</span>
                      <input
                        type="search"
                        placeholder="Search bank name…"
                        value={nbSearch}
                        onChange={(e) => setNbSearch(e.target.value)}
                        disabled={busy}
                      />
                    </div>
                    <div className="payment-bank-scroll">
                      <div className="payment-brand-grid payment-bank-grid">
                        {filteredBanks.map((b) => (
                          <button
                            key={b.id}
                            type="button"
                            className={`payment-brand-tile ${nbBankId === b.id ? 'active' : ''}`}
                            onClick={() => {
                              setNbBankId(b.id)
                              setCheckoutStep('nb_form')
                            }}
                            disabled={busy}
                          >
                            <BrandIcon logoKey={b.logoKey} label={b.name} size={40} />
                            <span>{b.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {checkoutStep === 'nb_form' && (
                  <div className="payment-wizard-step">
                    <button
                      type="button"
                      className="payment-wizard-back"
                      onClick={() => {
                        setCheckoutStep('nb_banks')
                        setNbBankId(null)
                      }}
                      disabled={busy}
                    >
                      ← Back
                    </button>
                    <h4 className="payment-wizard-title">Net banking details</h4>
                    {selectedBank && (
                      <p className="payment-wizard-sub">
                        <span className="payment-inline-brand">
                          <BrandIcon logoKey={selectedBank.logoKey} label={selectedBank.name} size={28} />
                          {selectedBank.name}
                        </span>
                      </p>
                    )}
                    <form onSubmit={handleNbSubmit} className="login-form">
                      <div className="form-group">
                        <label htmlFor="nb-acc">Account number</label>
                        <input
                          id="nb-acc"
                          type="text"
                          inputMode="numeric"
                          autoComplete="off"
                          placeholder="XXXXXXXXXX"
                          value={nbAccount}
                          onChange={(e) => setNbAccount(e.target.value)}
                          disabled={busy}
                        />
                      </div>
                      <div className="form-group">
                        <label htmlFor="nb-ifsc">IFSC code</label>
                        <input
                          id="nb-ifsc"
                          type="text"
                          autoComplete="off"
                          placeholder="HDFC0001234"
                          value={nbIfsc}
                          onChange={(e) => setNbIfsc(e.target.value.toUpperCase())}
                          disabled={busy}
                        />
                      </div>
                      <div className="form-group">
                        <label htmlFor="nb-name">Account holder name</label>
                        <input
                          id="nb-name"
                          type="text"
                          autoComplete="name"
                          placeholder="As per bank records"
                          value={nbName}
                          onChange={(e) => setNbName(e.target.value)}
                          disabled={busy}
                        />
                      </div>
                      <button type="submit" className="login-btn" disabled={busy}>
                        {busy ? 'Processing…' : 'Complete payment'}
                      </button>
                    </form>
                  </div>
                )}

                {checkoutStep === 'card' && (
                  <div className="payment-wizard-step">
                    <button type="button" className="payment-wizard-back" onClick={() => resetCheckout()} disabled={busy}>
                      ← Back
                    </button>
                    <h4 className="payment-wizard-title">Card details</h4>
                    <p className="payment-wizard-sub">Detected: {cardBrand}</p>
                    <div className="payment-card-networks" aria-hidden>
                      {CARD_NETWORK_SI.map((n) => (
                        <BrandIcon key={n.label} si={n.si} label={n.label} size={36} />
                      ))}
                      <BrandIcon logoKey="rupay" label="RuPay" size={36} />
                    </div>
                    <form onSubmit={handleCardSubmit} className="login-form">
                      <div className="form-group">
                        <label htmlFor="card-num">Card number</label>
                        <input
                          id="card-num"
                          type="text"
                          inputMode="numeric"
                          autoComplete="cc-number"
                          placeholder="0000 0000 0000 0000"
                          value={formatCardNumber(cardNumber)}
                          onChange={(e) => setCardNumber(digitsOnly(e.target.value))}
                          disabled={busy}
                        />
                      </div>
                      <div className="payment-card-row">
                        <div className="form-group" style={{ flex: 1 }}>
                          <label htmlFor="card-exp">Expiry (MM/YY)</label>
                          <input
                            id="card-exp"
                            type="text"
                            placeholder="MM/YY"
                            autoComplete="cc-exp"
                            value={cardExpiry}
                            onChange={(e) => {
                              let v = e.target.value.replace(/\D/g, '').slice(0, 4)
                              if (v.length >= 2) v = `${v.slice(0, 2)}/${v.slice(2)}`
                              setCardExpiry(v)
                            }}
                            disabled={busy}
                          />
                        </div>
                        <div className="form-group" style={{ width: 120 }}>
                          <label htmlFor="card-cvv">CVV</label>
                          <input
                            id="card-cvv"
                            type="password"
                            inputMode="numeric"
                            maxLength={4}
                            autoComplete="cc-csc"
                            placeholder="•••"
                            value={cardCvv}
                            onChange={(e) => setCardCvv(digitsOnly(e.target.value))}
                            disabled={busy}
                          />
                        </div>
                      </div>
                      <div className="form-group">
                        <label htmlFor="card-name">Name on card</label>
                        <input
                          id="card-name"
                          type="text"
                          autoComplete="cc-name"
                          placeholder="Asha Kapoor"
                          value={cardName}
                          onChange={(e) => setCardName(e.target.value)}
                          disabled={busy}
                        />
                      </div>
                      <button type="submit" className="login-btn" disabled={busy}>
                        {busy ? 'Processing…' : 'Pay with card'}
                      </button>
                    </form>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className="glass-card">
          <div className="glass-card-header">
            <div className="glass-card-title">
              <span className="icon">🧾</span>
              <div>
                <h3>Your receipts</h3>
                <span className="sub">Logged-in account</span>
              </div>
            </div>
          </div>
          <div className="glass-card-body">
            {history.length === 0 ? (
              <div className="empty-state" style={{ padding: '24px 12px' }}>
                <div className="icon">💳</div>
                <p>No payments yet.</p>
              </div>
            ) : (
              <div className="payment-table-wrap">
                <table className="data-table compact">
                  <thead>
                    <tr>
                      <th>Ref</th>
                      <th>Amount</th>
                      <th>Method</th>
                      <th>When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <code>{row.reference_id}</code>
                        </td>
                        <td>₹{row.amount_inr}</td>
                        <td>{row.method}</td>
                        <td>{row.created_at?.slice(0, 16).replace('T', ' ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {isBillingStaff && (
        <div className="glass-card" style={{ marginTop: 20 }}>
          <div className="glass-card-header">
            <div className="glass-card-title">
              <span className="icon">📒</span>
              <div>
                <h3>Hospital ledger</h3>
                <span className="sub">Recent payments across all portal users</span>
              </div>
            </div>
          </div>
          <div className="glass-card-body">
            {ledger.length === 0 ? (
              <div className="empty-state" style={{ padding: '24px 12px' }}>
                <div className="icon">📒</div>
                <p>No ledger entries.</p>
              </div>
            ) : (
              <div className="payment-table-wrap">
                <table className="data-table compact">
                  <thead>
                    <tr>
                      <th>Ref</th>
                      <th>User</th>
                      <th>Role</th>
                      <th>Amount</th>
                      <th>Method</th>
                      <th>When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <code>{row.reference_id}</code>
                        </td>
                        <td>{row.full_name || row.username}</td>
                        <td>{row.role}</td>
                        <td>₹{row.amount_inr}</td>
                        <td>{row.method}</td>
                        <td>{row.created_at?.slice(0, 16).replace('T', ' ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
      {checkoutStep === 'upi_pin' &&
        createPortal(
          <div className="payment-pin-fullscreen" role="dialog" aria-modal="true" aria-labelledby="upi-pin-title">
            <div className="payment-pin-fullscreen-inner">
              <button
                type="button"
                className="payment-pin-fullscreen-back"
                onClick={() => setCheckoutStep('upi_vpa')}
                disabled={busy}
              >
                ← Back
              </button>

              <div className="payment-pin-fullscreen-card glass-card">
                {selectedUpiApp && (
                  <div className="payment-pin-app-row">
                    <BrandIcon
                      si={selectedUpiApp.si}
                      logoKey={selectedUpiApp.logoKey}
                      label={selectedUpiApp.name}
                      size={48}
                    />
                    <span>{selectedUpiApp.name}</span>
                  </div>
                )}

                <p className="payment-pin-amount">₹{amount === '' ? '—' : fmtInr(Number(amount))}</p>
                <p className="payment-pin-payee">{description || 'Curiva payment'}</p>

                <h2 id="upi-pin-title" className="payment-pin-fullscreen-title">
                  Enter UPI PIN
                </h2>
                <p className="payment-wizard-sub payment-pin-fullscreen-sub">
                  Demo PIN — not verified against any bank
                </p>

                <form onSubmit={handleUpiPinSubmit} className="login-form payment-pin-fullscreen-form">
                  <div className="form-group">
                    <label htmlFor="upi-pin">4–6 digit PIN</label>
                    <input
                      id="upi-pin"
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      autoComplete="off"
                      placeholder="••••"
                      value={upiPin}
                      onChange={(e) => setUpiPin(digitsOnly(e.target.value))}
                      disabled={busy}
                      className="payment-pin-input payment-pin-input--fullscreen"
                      autoFocus
                    />
                  </div>
                  <div className="payment-pin-actions payment-pin-actions--fullscreen">
                    <button type="submit" className="login-btn payment-pin-submit-btn" disabled={busy}>
                      {busy ? 'Processing…' : 'Pay securely'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
