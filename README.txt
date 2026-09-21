KaamMilega MVP - CLEAN STATIC DEMO

LOCAL PREVIEW:
1. Extract this ZIP.
2. Double-click index.html.
3. It opens directly in Chrome/Edge. No npm, Node.js, JSON config or server is required.

DEPLOY:
Upload the contents of this folder to a static host. index.html is the entry file.

NOTE:
This is a frontend demo. Login, profile save, jobs and worker data are demo-only. Call/WhatsApp buttons use the browser/device handlers.

WHAT'S NEW IN THIS VERSION:
- Indian flag badge in the header + a "workforce" icon strip in the hero section.
- All dynamic text is now HTML-escaped before rendering (prevents XSS once real user data is connected).
- Login and Save Profile now do real client-side validation (required fields, 10-digit Indian mobile format) instead of always succeeding.
- Added a Content-Security-Policy meta tag in index.html.
- Added SECURITY.md (vulnerability reporting + a pre-launch security checklist), .gitignore, and LICENSE (MIT).

REMEMBER:
Client-side validation can always be bypassed by a user. Once you connect a real backend, every check in script.js must be re-implemented server-side too.
