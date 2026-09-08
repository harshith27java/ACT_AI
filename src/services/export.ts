// Artifact exports. PPTX is a real download via pptxgenjs; documents
// export as Markdown (printable to PDF); social/video as TXT/JSON.
import type { Artifact } from "@/types";
import { download, slug } from "@/lib/utils";

export function exportAsMarkdown(artifact: Artifact) {
  const md = artifact.content ?? JSON.stringify(artifact.structured_content, null, 2);
  download(`${slug(artifact.title)}.md`, md, "text/markdown");
}

export function exportAsText(artifact: Artifact) {
  const text = artifact.content ?? JSON.stringify(artifact.structured_content, null, 2);
  download(`${slug(artifact.title)}.txt`, text, "text/plain");
}

export function exportAsJson(artifact: Artifact) {
  download(
    `${slug(artifact.title)}.json`,
    JSON.stringify(artifact.structured_content ?? { content: artifact.content }, null, 2),
    "application/json",
  );
}

export async function exportPresentationAsPptx(artifact: Artifact): Promise<void> {
  const { default: PptxGenJS } = await import("pptxgenjs");
  const slides = artifact.structured_content?.slides ?? [];
  if (slides.length === 0) throw new Error("This presentation has no slides to export.");

  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_16x9";
  pptx.title = artifact.title;

  for (const slide of slides) {
    const s = pptx.addSlide();
    s.addText(slide.title ?? "", {
      x: 0.5, y: 0.4, w: 9, h: 0.9, fontSize: 28, bold: true, color: "111827",
    });
    if (slide.bullets?.length) {
      s.addText(slide.bullets.map((b) => ({ text: b, options: { bullet: true } })), {
        x: 0.8, y: 1.5, w: 8.4, h: 3.6, fontSize: 16, color: "374151", lineSpacingMultiple: 1.4,
      });
    }
    if (slide.speaker_notes) s.addNotes(slide.speaker_notes);
  }

  await pptx.writeFile({ fileName: `${slug(artifact.title)}.pptx` });
}

export function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}
