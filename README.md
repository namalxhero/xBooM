# xBooM Bot

Single-file WhatsApp bot (`index.js`) built on the bundled `xBooM-BAILEYS` library
(a fork of Baileys by WhiskeySockets, MIT licensed - see `xBooM-BAILEYS/LICENSE`).

## Run (Termux)
```
pkg install nodejs -y
npm install
node index.js
```
Edit `phone` and `owner` at the top of `index.js` first.

## GitHub Actions
Use a **private** repo. Add secrets `PHONE` and `OWNER`, then Actions > xBooM Bot > Run workflow.
First run prints a pairing code in the job log. The job restarts itself every ~6 hours.
