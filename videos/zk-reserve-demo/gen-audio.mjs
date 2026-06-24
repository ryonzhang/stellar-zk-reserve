import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const narration = JSON.parse(fs.readFileSync(path.join(__dirname, "narration.json"), "utf8"));

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) { console.error("Set OPENAI_API_KEY"); process.exit(1); }

const audioDir = path.join(__dirname, "audio");
fs.mkdirSync(audioDir, { recursive: true });

for (const scene of narration.scenes) {
  const outPath = path.join(audioDir, `${scene.id}.mp3`);
  if (fs.existsSync(outPath)) { console.log(`skip ${scene.id}`); continue; }

  console.log(`generating ${scene.id}...`);
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "tts-1-hd",
      voice: "echo",
      input: scene.text,
      speed: 1.05,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`FAILED ${scene.id}: ${err}`);
    process.exit(1);
  }

  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(outPath, buf);
  console.log(`  -> ${outPath} (${buf.length} bytes)`);
}

console.log("\nAll audio generated.");
