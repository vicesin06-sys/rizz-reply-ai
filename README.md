# Rizz Reply AI

Mobile-friendly AI text-message reply suggestions with tone selection, relationship context, screenshot input, and copy buttons.

## Run locally
1. Install Node.js 20 or newer.
2. Run `npm install`.
3. Copy `.env.example` to `.env` and add your OpenAI API key.
4. Run `npm start`.
5. Open http://localhost:3000.

Never put your API key in `public/index.html` or commit it to GitHub.

## Deploy on Render
1. Connect this GitHub repository as a Render Web Service.
2. Build command: `npm install`
3. Start command: `npm start`
4. Set Render environment variables `OPENAI_API_KEY` and optionally `OPENAI_MODEL=gpt-4o-mini`.
5. Deploy and test `/api/health`; it should return `{"ok":true}`.

OpenAI API usage is billed separately from a ChatGPT subscription. Screenshots accept JPG, PNG, or WebP up to 5 MB. Rate limiting is basic; add stronger abuse protection and privacy disclosures before scaling.
