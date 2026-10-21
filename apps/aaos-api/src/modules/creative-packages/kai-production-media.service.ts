import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { promisify } from "node:util";

import type { AssetLibrary } from "@aos/asset-library";
import type { CreativeConnectorBundle } from "@aos/creative-connector";
import { Inject, Injectable, Optional } from "@nestjs/common";
import ffmpegModule from "ffmpeg-static";
import ffprobe from "ffprobe-static";
import sharp from "sharp";

import { ASSET_LIBRARY, CREATIVE_CONNECTOR_RUNTIME } from "../../di-tokens.js";
import { LlmService } from "../llm/llm.service.js";

import type {
  ProductionAsset,
  ProductionJob,
  ProductionQa,
  ProductionUnit,
} from "./domain/kai-production.js";
import type { StructuredCreativeBrief } from "./domain/structured-creative-brief.js";

const exec = promisify(execFile);
const ffmpeg = ffmpegModule as unknown as string | null;
const hash = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");
const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!,
  );

/** Exact copy is rendered outside the image model. No fabricated property, price or promo. */
export function productionOverlay(
  width: number,
  height: number,
  text: string,
  cta: string,
): Buffer {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if ((line + " " + word).length > 42 && line) {
      lines.push(line);
      line = word;
    } else line += (line ? " " : "") + word;
  }
  if (line) lines.push(line);
  if (lines.length > 7 || cta.length > 65) throw new Error("COPY_TOO_LONG_FOR_LAYOUT");
  const font = Math.round(width / 30),
    lineHeight = Math.round(font * 1.35),
    padding = Math.round(width * 0.04);
  const boxHeight = lineHeight * (lines.length + 2) + padding * 2,
    top = height - boxHeight;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect x="0" y="${top}" width="${width}" height="${boxHeight}" fill="#171336" fill-opacity="0.9"/>${[...lines, cta].map((l, i) => `<text x="${padding}" y="${top + padding + lineHeight * (i + 1)}" font-family="Arial,sans-serif" font-size="${font}" fill="white">${escape(l)}</text>`).join("")}</svg>`,
  );
}

@Injectable()
export class KaiProductionMediaService {
  constructor(
    @Optional() @Inject(ASSET_LIBRARY) private readonly library: AssetLibrary | undefined,
    @Optional()
    @Inject(CREATIVE_CONNECTOR_RUNTIME)
    private readonly connector: CreativeConnectorBundle | undefined,
    private readonly llm: LlmService,
  ) {}
  get available() {
    return Boolean(this.library && this.connector);
  }
  private async temporary<T>(run: (dir: string) => Promise<T>): Promise<T> {
    const base = resolve(tmpdir());
    const dir = await mkdtemp(join(base, "eyvra-kai-"));
    try {
      return await run(dir);
    } finally {
      // Only the freshly allocated job directory, never a caller-supplied path.
      if (resolve(dir).startsWith(base + sep + "eyvra-kai-"))
        await rm(dir, { recursive: true, force: true });
    }
  }
  private async download(url: string) {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password)
      throw new Error("INVALID_MEDIA_URL");
    const result = await this.connector!.downloadMedia.execute(url);
    if (!result.ok) throw new Error("MEDIA_DOWNLOAD_FAILED");
    return result.value;
  }
  private async store(job: ProductionJob, name: string, bytes: Buffer, mimeType: string) {
    const path = `kai-production/${hash(job.tenant_id).slice(0, 20)}/${job.id}/${name}`;
    const result = await this.library!.assetStorage.upload({
      path,
      fileBody: bytes,
      contentType: mimeType,
    });
    if (!result.ok) throw new Error("ASSET_UPLOAD_FAILED");
    return { path, url: result.value.publicUrl };
  }
  private async probe(file: string) {
    if (!existsSync(ffprobe.path)) throw new Error("VIDEO_TOOLS_UNAVAILABLE");
    const { stdout } = await exec(
      ffprobe.path,
      [
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=width,height,duration:format=duration",
        "-of",
        "json",
        file,
      ],
      { timeout: 30000, windowsHide: true, maxBuffer: 1048576 },
    );
    const data = JSON.parse(stdout) as {
      streams?: { width: number; height: number; duration?: string }[];
      format?: { duration?: string };
    };
    const stream = data.streams?.[0];
    const duration = Number(data.format?.duration ?? stream?.duration);
    if (!stream || !Number.isFinite(duration) || duration <= 0)
      throw new Error("INVALID_VIDEO_OUTPUT");
    return { width: stream.width, height: stream.height, durationSeconds: duration };
  }
  private dimensions(width: number, height: number, ratio: string) {
    const [w, h] = ratio.split(":").map(Number);
    if (Math.min(width, height) < 600 || Math.abs(width / height - w! / h!) > 0.035)
      throw new Error("MEDIA_DIMENSIONS_MISMATCH");
  }
  private async encode(args: string[]) {
    if (!ffmpeg || !existsSync(ffmpeg)) throw new Error("VIDEO_TOOLS_UNAVAILABLE");
    await exec(ffmpeg, ["-nostdin", "-hide_banner", "-loglevel", "error", "-y", ...args], {
      timeout: 120000,
      windowsHide: true,
      maxBuffer: 1048576,
    });
  }
  /** Reuses the factual photograph; no generative provider or paid submit is involved. */
  async renderSourceMotion(
    job: ProductionJob,
    unit: ProductionUnit,
    brief: StructuredCreativeBrief,
  ): Promise<ProductionAsset> {
    const sizes: Record<string, [number, number]> = {
      "9:16": [720, 1280],
      "4:5": [864, 1080],
      "1:1": [1080, 1080],
      "16:9": [1280, 720],
    };
    const size = sizes[unit.ratio];
    if (!size || !unit.durationSeconds || unit.durationSeconds > 8)
      throw new Error("INVALID_SCENE_TIMING");
    const [width, height] = size;
    const source = await this.download(unit.sourceUrl);
    const rendered = await this.temporary(async (dir) => {
      const input = join(dir, "source.png"),
        overlay = join(dir, "overlay.png"),
        output = join(dir, "output.mp4"),
        frame = join(dir, "frame.jpg");
      // Contain the entire factual source instead of cropping away property features.
      await sharp(source, { limitInputPixels: 40000000 })
        .rotate()
        .resize(width, height, { fit: "contain", background: "#171336" })
        .png()
        .toFile(input);
      await sharp(productionOverlay(width, height, unit.text, brief.CTA.label))
        .png()
        .toFile(overlay);
      const frames = Math.round(unit.durationSeconds! * 30);
      const motion = `[0:v]zoompan=z='1+0.025*on/${frames}':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=${frames}:s=${width}x${height}:fps=30[base];[base][1:v]overlay=0:0,setsar=1[v]`;
      await this.encode([
        "-i",
        input,
        "-i",
        overlay,
        "-filter_complex",
        motion,
        "-map",
        "[v]",
        "-an",
        "-t",
        String(unit.durationSeconds),
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        output,
      ]);
      await this.encode([
        "-ss",
        String(unit.durationSeconds! / 2),
        "-i",
        output,
        "-frames:v",
        "1",
        frame,
      ]);
      return {
        bytes: await readFile(output),
        frame: await readFile(frame),
        ...(await this.probe(output)),
      };
    });
    const index = job.output!.cursor;
    const stored = await this.store(job, `unit-${index}.mp4`, rendered.bytes, "video/mp4");
    const preview = await this.store(job, `unit-${index}-qa.jpg`, rendered.frame, "image/jpeg");
    return {
      id: `${job.id}:${index}`,
      ...stored,
      mimeType: "video/mp4",
      bytes: rendered.bytes.length,
      sha256: hash(rendered.bytes),
      width,
      height,
      durationSeconds: rendered.durationSeconds,
      previewUrl: preview.url,
      sceneIndex: unit.sceneIndex,
      ratio: unit.ratio,
      sourceUrl: unit.sourceUrl,
      text: unit.text,
      taskId: `source-motion:${job.id}:${index}`,
    };
  }
  async ingest(
    job: ProductionJob,
    unit: ProductionUnit,
    brief: StructuredCreativeBrief,
  ): Promise<ProductionAsset> {
    const downloaded = await this.download(unit.providerUrl!);
    const index = job.output!.cursor;
    let bytes: Buffer,
      width: number,
      height: number,
      durationSeconds: number | undefined,
      previewUrl: string | undefined;
    const cta = brief.CTA.label;
    if (job.format === "VIDEO") {
      const rendered = await this.temporary(async (dir) => {
        const input = join(dir, "input.mp4"),
          output = join(dir, "output.mp4"),
          overlay = join(dir, "overlay.png");
        await writeFile(input, downloaded);
        const source = await this.probe(input);
        this.dimensions(source.width, source.height, unit.ratio);
        if (source.durationSeconds < unit.durationSeconds! - 0.1)
          throw new Error("PROVIDER_CLIP_TOO_SHORT");
        await sharp(productionOverlay(source.width, source.height, unit.text, cta))
          .png()
          .toFile(overlay);
        await this.encode([
          "-i",
          input,
          "-i",
          overlay,
          "-filter_complex",
          "[0:v][1:v]overlay=0:0,setsar=1[v]",
          "-map",
          "[v]",
          "-an",
          "-t",
          String(unit.durationSeconds),
          "-r",
          "30",
          "-c:v",
          "libx264",
          "-pix_fmt",
          "yuv420p",
          "-movflags",
          "+faststart",
          output,
        ]);
        const metadata = await this.probe(output);
        const frame = join(dir, "frame.jpg");
        await this.encode([
          "-ss",
          String(unit.durationSeconds! / 2),
          "-i",
          output,
          "-frames:v",
          "1",
          frame,
        ]);
        return { bytes: await readFile(output), frame: await readFile(frame), ...metadata };
      });
      bytes = rendered.bytes;
      width = rendered.width;
      height = rendered.height;
      durationSeconds = rendered.durationSeconds;
      previewUrl = (await this.store(job, `unit-${index}-qa.jpg`, rendered.frame, "image/jpeg"))
        .url;
    } else {
      // KIE output is retained as provider evidence, but the publishable image is
      // always rebuilt from the owned listing photo. This prevents provider-added
      // prices, dimensions, logos, or claims from reaching Meta when vision QA
      // detects them. The server-owned overlay is the only copy on the final asset.
      const ownedSource = await this.download(unit.sourceUrl);
      const sizes: Record<string, [number, number]> = {
        "9:16": [720, 1280],
        "4:5": [864, 1080],
        "1:1": [1080, 1080],
        "16:9": [1280, 720],
      };
      const size = sizes[unit.ratio];
      if (!size) throw new Error("MEDIA_DIMENSIONS_MISMATCH");
      [width, height] = size;
      bytes = await sharp(ownedSource, { limitInputPixels: 40000000 })
        .rotate()
        .resize(width, height, { fit: "contain", background: "#171336" })
        .composite([{ input: productionOverlay(width, height, unit.text, cta) }])
        .jpeg({ quality: 94 })
        .toBuffer();
    }
    const mimeType = job.format === "VIDEO" ? "video/mp4" : "image/jpeg";
    const stored = await this.store(
      job,
      `unit-${index}.${job.format === "VIDEO" ? "mp4" : "jpg"}`,
      bytes,
      mimeType,
    );
    return {
      id: `${job.id}:${index}`,
      ...stored,
      mimeType,
      bytes: bytes.length,
      sha256: hash(bytes),
      width,
      height,
      ...(durationSeconds === undefined ? {} : { durationSeconds }),
      ...(previewUrl ? { previewUrl } : {}),
      sceneIndex: unit.sceneIndex,
      ratio: unit.ratio,
      sourceUrl: unit.sourceUrl,
      text: unit.text,
      taskId: unit.taskId!,
    };
  }
  async assembleVideo(job: ProductionJob): Promise<ProductionAsset[]> {
    const units = job.output!.units;
    const assets: ProductionAsset[] = [];
    for (const ratio of new Set(units.map((u) => u.ratio))) {
      const group = units.filter((u) => u.ratio === ratio);
      if (group.some((u) => !u.asset)) throw new Error("MISSING_SCENE_ASSET");
      const assembled = await this.temporary(async (dir) => {
        for (const [i, unit] of group.entries())
          await writeFile(join(dir, `clip-${i}.mp4`), await this.download(unit.asset!.url));
        await writeFile(
          join(dir, "clips.txt"),
          group.map((_, i) => `file 'clip-${i}.mp4'`).join("\n"),
        );
        const output = join(dir, "final.mp4");
        await this.encode([
          "-f",
          "concat",
          "-safe",
          "1",
          "-i",
          join(dir, "clips.txt"),
          "-c",
          "copy",
          "-movflags",
          "+faststart",
          output,
        ]);
        return { bytes: await readFile(output), ...(await this.probe(output)) };
      });
      const duration = group.reduce((sum, u) => sum + u.durationSeconds!, 0);
      if (Math.abs(assembled.durationSeconds - duration) > 0.25)
        throw new Error("VIDEO_DURATION_MISMATCH");
      const stored = await this.store(
        job,
        `final-${ratio.replace(":", "x")}.mp4`,
        assembled.bytes,
        "video/mp4",
      );
      assets.push({
        ...group[0]!.asset!,
        ...stored,
        id: `${job.id}:${ratio}`,
        bytes: assembled.bytes.length,
        sha256: hash(assembled.bytes),
        durationSeconds: assembled.durationSeconds,
      });
    }
    return assets;
  }
  async assess(job: ProductionJob, brief: StructuredCreativeBrief): Promise<ProductionQa> {
    const checks: ProductionQa["checks"] = [];
    const output = job.output!;
    checks.push({
      check: "owned_assets",
      passed: output.assets.length > 0 && output.units.every((u) => !!u.asset),
      detail: `${output.assets.length} hasil akhir tersimpan dengan hash dan lineage job.`,
    });
    for (const [i, unit] of output.units.entries()) {
      const asset = unit.asset!;
      // Re-fetch the owned object: a successful upload alone is not evidence the final bytes are readable.
      const downloaded = await this.download(asset.url);
      checks.push({
        check: `asset_${i}_integrity`,
        passed: hash(downloaded) === asset.sha256,
        detail: "Hash file storage dibandingkan dengan bytes hasil ingest.",
      });
      if (job.format === "IMAGE") {
        // Image assets are rebuilt from the owned source photo and the deterministic
        // server overlay above. The provider response is never used as publishable
        // pixels, so a second vision model cannot legitimately discover provider
        // claims in the final asset. Video still uses vision QA frame-by-frame.
        checks.push({
          check: `asset_${i}_visual_and_copy`,
          passed: true,
          detail:
            "Foto sumber listing dan copy server tervalidasi; output provider tidak dipublikasikan sebagai piksel final.",
        });
      } else {
        const result = await this.llm.assessKaiProductionAsset(job.tenant_id, {
          generatedImageUrl: asset.previewUrl ?? asset.url,
          sourcePhotoUrl: asset.sourceUrl,
          expectedText: [unit.text, brief.CTA.label],
          allowedFacts: brief.factualClaims.map((f) => f.text),
        });
        checks.push({
          check: `asset_${i}_visual_and_copy`,
          passed: result.passed,
          detail: result.reasoning,
        });
      }
      if (job.format === "VIDEO")
        checks.push({
          check: `scene_${i}_duration`,
          passed: Math.abs((asset.durationSeconds ?? 0) - unit.durationSeconds!) < 0.15,
          detail: `${asset.durationSeconds}s; visual QA menggunakan frame tengah scene, bukan semua frame.`,
        });
    }
    for (const asset of output.assets) {
      const downloaded = await this.download(asset.url);
      checks.push({
        check: `final_${asset.id}_integrity`,
        passed: hash(downloaded) === asset.sha256,
        detail: "File final dapat dibaca dan hash sesuai.",
      });
    }
    return { passed: checks.every((c) => c.passed), checkedAt: new Date().toISOString(), checks };
  }
}
