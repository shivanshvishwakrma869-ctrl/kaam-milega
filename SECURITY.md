# Security Policy

## Current status

KaamMilega is currently a **static frontend demo**. There is no backend, no
database, and no real authentication — all data (workers, jobs, login,
profile) is either hardcoded in `script.js` or stored only in the browser
for the current session. Because of this, there is currently no real attack
surface for things like data breaches or account takeover.

This will change once a real backend, database, and authentication system
are connected. The guidance below applies from that point onward, and the
reporting process applies at any stage.

## Reporting a vulnerability

If you discover a security issue in this project (now or after a backend is
added), please report it privately rather than opening a public GitHub issue:

- **Email:** security@kaammilega.example (replace with your real contact)
- **What to include:** steps to reproduce, affected file/URL, and potential
  impact.
- **Response time:** we aim to acknowledge reports within 3 business days.

Please do not publicly disclose a vulnerability until it has been
acknowledged and, where applicable, fixed.

## Supported versions

| Version | Supported |
|---------|-----------|
| Latest (main) | ✅ |
| Older snapshots | ❌ |

## Security checklist before going live with a real backend

- [ ] Serve the site only over HTTPS
- [ ] Move all data validation to the server — client-side JS checks (like
      the ones in `script.js`) can always be bypassed and must never be the
      only line of defense
- [ ] Use OTP-based or hashed-password authentication; never store plain
      text passwords
- [ ] Rate-limit login attempts to prevent brute-force attacks
- [ ] Sanitize/escape all user-supplied text before storing or rendering it
      (name, bio, job title, etc.) to prevent stored XSS
- [ ] Validate and rate-limit any endpoint that sends SMS/WhatsApp messages
      to prevent abuse
- [ ] Keep the Content-Security-Policy header/meta tag up to date as new
      scripts or resources are added
- [ ] Do not commit API keys, database credentials, or `.env` files (see
      `.gitignore`)
