/* Single source of truth for contributor pay terms. Rendered on the players page
   (Earn section and FAQ), read by the agreement generator for clause 7, and by the
   delivery bundle. Change numbers here only. Dates are the day the terms changed. */
window.ACCENT_PAY = {
  "last_updated": "2026-09-11",
  "unit": "per speaker, per verified hour of session audio",
  "base_rates_usd": { "standard": 16, "scarce": 25 },
  "standard_languages": ["Nigerian Pidgin", "Yoruba", "Hausa", "Igbo", "Swahili", "Zulu"],
  "scarce_note": "Scarce registers such as Nairobi Sheng and commissioned specialist domains pay the higher base rate, shown in the app before the session.",
  "multiplier": [
    { "tier": "Platinum", "min": 4.75, "max": null, "x": 1.2 },
    { "tier": "Gold", "min": 4.25, "max": 4.74, "x": 1.0 },
    { "tier": "Silver", "min": 3.50, "max": 4.24, "x": 0.7 }
  ],
  "quality_floor": { "below": 3.50, "x": 0.5, "note": "A redo is offered first. A good-faith session that still rates below Silver pays the floor, never zero." },
  "integrity": { "x": 0, "note": "Confirmed dishonesty, after human review, notice and a chance to respond, forfeits pay for the affected sessions only. Agreement clause 15." },
  "range_usd": { "min": 8, "max": 30 },
  "rails": [
    { "name": "M-Pesa", "min": 5 },
    { "name": "Paystack · Flutterwave", "min": 5 },
    { "name": "Stripe · PayPal", "min": 10 },
    { "name": "USDC · USDT", "min": 2 }
  ],
  "statement": "monthly",
  "payout_days": 14,
  "response_window_days": 7
};
