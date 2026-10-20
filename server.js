import express from "express";
import multer from "multer";
import OpenAI from "openai";
import rateLimit from "express-rate-limit";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ok = ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype);
    cb(ok ? null : new Error("Use a JPG, PNG, or WebP screenshot."), ok);
  }
});
app.disable("x-powered-by");
app.use("/api/", rateLimit({ windowMs: 60_000, limit: 12, standardHeaders: "draft-7", legacyHeaders: false, message: { error: "Too many requests. Wait a minute and try again." } }));
app.use(express.static(path.join(__dirname, "public")));
const allowedVibes = new Set(["genuine","funny","conversational","flirty","naughty","cold"]);
const allowedWho = new Set(["a crush","a new match","someone I'm dating","an ex"]);
app.get("/api/health", (_req,res) => res.json({ok:true}));
app.post("/api/replies", upload.single("screenshot"), async (req,res) => {
  try {
    if (!process.env.OPENAI_API_KEY) return res.status(503).json({error:"Server is missing its OpenAI API key. Add OPENAI_API_KEY in Render environment variables."});
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const text = typeof req.body.text === "string" ? req.body.text.trim().slice(-6000) : "";
    let vibes; try { vibes=JSON.parse(req.body.vibes || "[]"); } catch { vibes=[]; }
    const who = typeof req.body.who === "string" ? req.body.who : "a crush";
    if (!text && !req.file) return res.status(400).json({error:"Paste a message or add a screenshot first."});
    if (!Array.isArray(vibes) || !vibes.length || vibes.length>6 || vibes.some(v=>!allowedVibes.has(v))) return res.status(400).json({error:"Choose one or more valid vibes."});
    if (!allowedWho.has(who)) return res.status(400).json({error:"Choose a valid relationship type."});
    const extra = [
      vibes.includes("naughty") ? "Naughty: teasing and suggestive with innuendo, adult but never graphic or coercive; if interest is unclear, keep it subtle and let them lead." : "",
      vibes.includes("cold") ? "Cold: composed, brief, dry and self-assured, never cruel or manipulative." : ""
    ].filter(Boolean).join(" ");
    const instructions = `You write realistic text-message replies for someone texting ${who}.
Selected tones: ${vibes.join(", ")}. ${extra}
Mirror their length, casing, punctuation, emoji use and energy. Each reply is one sentence, max 15 words; at most one emoji.
Respond only to information present. Never invent facts, plans or shared history. No manipulation, guilt, pressure, lies or cheesy pickup lines. Respect disinterest.
Write exactly 3 distinct reply options with different angles. Each needs a why-it-works line under 10 words.
Return only JSON: {"replies":[{"text":"reply","why":"short explanation"},{"text":"reply","why":"short explanation"},{"text":"reply","why":"short explanation"}]}.`;
    const content = [];
    if (text) content.push({type:"text",text:"Conversation / latest message:\n"+text});
    if (req.file) {
      content.push({type:"image_url",image_url:{url:"data:"+req.file.mimetype+";base64,"+req.file.buffer.toString("base64"),detail:"high"}});
      content.push({type:"text",text:"Read the screenshot and use the conversation as context."});
    }
    const result = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [{role:"system",content:instructions},{role:"user",content}],
      response_format: {type:"json_object"}, temperature:0.85, max_tokens:500
    });
    const raw = result.choices?.[0]?.message?.content;
    let parsed; try { parsed=JSON.parse(raw || ""); } catch { return res.status(502).json({error:"AI returned an invalid response. Try again."}); }
    const replies = Array.isArray(parsed.replies) ? parsed.replies.filter(r=>r&&typeof r.text==="string"&&r.text.trim()).slice(0,3).map(r=>({text:r.text.trim().slice(0,400),why:typeof r.why==="string"?r.why.trim().slice(0,120):""})) : [];
    if (replies.length!==3) return res.status(502).json({error:"Could not create three replies. Please try again."});
    res.json({replies});
  } catch (e) {
    if (e instanceof multer.MulterError) return res.status(400).json({error:e.code==="LIMIT_FILE_SIZE"?"Screenshot must be 5 MB or smaller.":"Could not upload screenshot."});
    console.error("Reply generation failed:",e?.status||e?.message||"unknown error");
    if (e?.status===429) return res.status(429).json({error:"AI rate limit reached. Wait a moment and try again."});
    if (e?.status===401) return res.status(503).json({error:"OpenAI API key was rejected. Check Render environment variables."});
    res.status(500).json({error:"Could not generate replies. Please try again."});
  }
});
app.use((err,_req,res,_next)=>res.status(400).json({error:err?.message||"Unexpected server error."}));
const port=process.env.PORT||3000;
app.listen(port,()=>console.log("Rizz Reply AI running on port "+port));
