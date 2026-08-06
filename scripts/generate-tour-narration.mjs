import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const narrationDataPath = path.join(
  projectRoot,
  "src/data/tour-narration.json",
);
const outputDirectory = path.join(projectRoot, "public/audio/tour");
const manifestPath = path.join(outputDirectory, "manifest.json");

const voiceId = "Xb7hH8MSUJpSbSDYk0k2";
const modelId = "eleven_multilingual_v2";
const outputFormat = "mp3_44100_128";
const voiceSettings = {
  stability: 0.82,
  similarity_boost: 0.85,
  style: 0,
  use_speaker_boost: true,
};

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function requiredEnvironment(name) {
  const value = process.env[name]?.trim();
  if (value === undefined || value === "") {
    throw new Error(`${name} is required`);
  }
  return value;
}

async function readApiKey() {
  const keyPath = requiredEnvironment("ELEVENLABS_API_KEY_FILE");
  const key = (await readFile(keyPath, "utf8")).trim();
  if (key.length < 20) {
    throw new Error("The ElevenLabs API key file does not contain a key");
  }
  return key;
}

async function checkedResponse(response, operation) {
  if (response.ok) {
    return response;
  }
  const body = (await response.text()).slice(0, 500);
  throw new Error(
    `${operation} failed: HTTP ${String(response.status)}. ${body}`,
  );
}

async function voiceName(apiKey) {
  const response = await checkedResponse(
    await fetch(`https://api.elevenlabs.io/v1/voices/${voiceId}`, {
      headers: { "xi-api-key": apiKey },
    }),
    "ElevenLabs voice lookup",
  );
  const body = await response.json();
  if (typeof body.name !== "string" || body.name.trim() === "") {
    throw new Error("ElevenLabs voice lookup returned no voice name");
  }
  return body.name;
}

async function existingManifest() {
  try {
    return JSON.parse(await readFile(manifestPath, "utf8"));
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

function contextSha256(entries, index) {
  return sha256(
    `${entries[index - 1]?.text ?? ""}\u0000${entries[index].text}\u0000${entries[index + 1]?.text ?? ""}`,
  );
}

async function reusableEntry(entry, entries, index, manifest) {
  const previous = manifest?.entries?.find(
    (candidate) => candidate.id === entry.id,
  );
  if (
    manifest?.voiceId !== voiceId ||
    manifest?.modelId !== modelId ||
    manifest?.outputFormat !== outputFormat ||
    JSON.stringify(manifest?.voiceSettings) !== JSON.stringify(voiceSettings) ||
    previous?.textSha256 !== sha256(entry.text)
  ) {
    return undefined;
  }
  const previousContextIsCurrent =
    previous.contextSha256 === contextSha256(entries, index) ||
    (previous.contextSha256 === undefined &&
      (index === 0 ||
        manifest.entries[index - 1]?.textSha256 ===
          sha256(entries[index - 1].text)) &&
      (index === entries.length - 1 ||
        manifest.entries[index + 1]?.textSha256 ===
          sha256(entries[index + 1].text)));
  if (!previousContextIsCurrent) {
    return undefined;
  }
  const outputPath = path.join(projectRoot, "public", entry.audioSource);
  try {
    const audio = await readFile(outputPath);
    return sha256(audio) === previous.audioSha256
      ? { ...previous, contextSha256: contextSha256(entries, index) }
      : undefined;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

async function synthesize(apiKey, entries, index) {
  const entry = entries[index];
  const response = await checkedResponse(
    await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=${outputFormat}`,
      {
        method: "POST",
        headers: {
          Accept: "audio/mpeg",
          "Content-Type": "application/json",
          "xi-api-key": apiKey,
        },
        body: JSON.stringify({
          text: entry.text,
          model_id: modelId,
          voice_settings: voiceSettings,
          previous_text: entries[index - 1]?.text,
          next_text: entries[index + 1]?.text,
        }),
      },
    ),
    `ElevenLabs narration generation for ${entry.id}`,
  );
  const audio = Buffer.from(await response.arrayBuffer());
  if (audio.length < 1_000) {
    throw new Error(
      `Generated narration for ${entry.id} is unexpectedly small`,
    );
  }
  const outputPath = path.join(projectRoot, "public", entry.audioSource);
  const temporaryPath = `${outputPath}.tmp`;
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(temporaryPath, audio);
  await rename(temporaryPath, outputPath);
  return {
    id: entry.id,
    audioSource: entry.audioSource,
    textSha256: sha256(entry.text),
    contextSha256: contextSha256(entries, index),
    audioSha256: sha256(audio),
    bytes: audio.length,
  };
}

async function main() {
  if (
    requiredEnvironment("ELEVENLABS_EXTERNAL_DISCLOSURE_APPROVED") !== "true"
  ) {
    throw new Error(
      "ELEVENLABS_EXTERNAL_DISCLOSURE_APPROVED must be exactly true",
    );
  }
  const apiKey = await readApiKey();
  const entries = JSON.parse(await readFile(narrationDataPath, "utf8"));
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error("Tour narration data must contain at least one scene");
  }
  const ids = new Set();
  for (const entry of entries) {
    if (
      typeof entry.id !== "string" ||
      typeof entry.audioSource !== "string" ||
      typeof entry.text !== "string" ||
      entry.text.trim() === ""
    ) {
      throw new Error(
        "Every narration entry requires id, audioSource, and text",
      );
    }
    if (ids.has(entry.id)) {
      throw new Error(`Duplicate narration id ${entry.id}`);
    }
    ids.add(entry.id);
  }

  const [name, previousManifest] = await Promise.all([
    voiceName(apiKey),
    existingManifest(),
  ]);
  await mkdir(outputDirectory, { recursive: true });
  const manifestEntries = new Array(entries.length);
  const pendingIndexes = [];
  for (const [index, entry] of entries.entries()) {
    const reusable = await reusableEntry(
      entry,
      entries,
      index,
      previousManifest,
    );
    if (reusable === undefined) {
      pendingIndexes.push(index);
    } else {
      manifestEntries[index] = reusable;
    }
  }

  const workers = Array.from(
    { length: Math.min(2, pendingIndexes.length) },
    async () => {
      while (pendingIndexes.length > 0) {
        const index = pendingIndexes.shift();
        if (index === undefined) return;
        manifestEntries[index] = await synthesize(apiKey, entries, index);
        console.log(`Generated ${entries[index].id}`);
      }
    },
  );
  await Promise.all(workers);

  const manifest = {
    artifact: "solar-system-time-explorer.tour-narration",
    generatedAt: new Date().toISOString(),
    provider: "ElevenLabs",
    disclosure: "AI-generated speech from original educational scripts",
    voiceId,
    voiceName: name,
    modelId,
    outputFormat,
    voiceSettings,
    entries: manifestEntries,
  };
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(
    `Narration ready: ${String(entries.length)} scenes using ${name} (${voiceId})`,
  );
}

await main();
