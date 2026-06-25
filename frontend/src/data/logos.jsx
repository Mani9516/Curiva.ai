import naviLogoUrl from '../assets/navi-logo.png'
import bhimLogoUrl from '../assets/bhim-logo.png'
import { BANK_LOGO_URLS } from './bankLogoUrls.js'

const bankLogoEntries = Object.fromEntries(
  Object.entries(BANK_LOGO_URLS).map(([key, url]) => [
    key,
    <img src={url} alt={key} draggable={false} />,
  ]),
)

export const LOGOS = {
  // UPI
  phonepe: <svg viewBox="0 0 100 100" width="24" height="24"><circle cx="50" cy="50" r="50" fill="#5f259f"/><path d="M70,40 c0,-15 -25,-15 -25,-15 v20 c0,0 15,0 15,10 c0,10 -15,10 -15,10 v20 h-10 v-55 h25 c15,0 15,15 15,15 z" fill="#fff"/></svg>,
  paytm: <svg viewBox="0 0 100 100" width="24" height="24"><rect width="100" height="100" rx="20" fill="#002970"/><text x="15" y="65" fill="#fff" fontFamily="Arial" fontWeight="bold" fontSize="30">Pay</text><text x="65" y="65" fill="#00b9f1" fontFamily="Arial" fontWeight="bold" fontSize="30">tm</text></svg>,
  gpay: <svg viewBox="0 0 100 100" width="24" height="24"><path d="M50 0 L100 25 L100 75 L50 100 L0 75 L0 25 Z" fill="#fff"/><text x="25" y="60" fill="#4285F4" fontFamily="Arial" fontWeight="bold" fontSize="28">G</text><text x="50" y="60" fill="#5F6368" fontFamily="Arial" fontWeight="bold" fontSize="28">Pay</text></svg>,
  navi: <img src={naviLogoUrl} alt="Navi" draggable={false} />,
  bhim: <img src={bhimLogoUrl} alt="BHIM UPI" draggable={false} />,

  ...bankLogoEntries,

  rupay: <svg viewBox="0 0 100 100" width="24" height="24"><rect width="100" height="100" rx="20" fill="#097939"/><text x="8" y="58" fill="#fff" fontFamily="Arial" fontWeight="bold" fontSize="22">RuPay</text><text x="62" y="58" fill="#f37021" fontFamily="Arial" fontWeight="bold" fontSize="22">₹</text></svg>,
}
