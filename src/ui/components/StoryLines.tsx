import type { Line } from '../../engine/types';

/** Narration paragraphs with dialogue lines set apart by speaker. */
export function StoryLines({ lines, text, class: cls = '' }: { lines?: Line[]; text: string; class?: string }) {
  if (!lines?.length) return <div class={`storytext ${cls}`}>{text}</div>;
  return (
    <div class={`storytext ${cls}`}>
      {lines.map((l) =>
        l.speaker ? (
          <p class="dialogue">
            <span class="speaker">{l.speaker}</span>
            <span>“{l.text.replace(/^["“]|["”]$/g, '')}”</span>
          </p>
        ) : (
          <p>{l.text}</p>
        ),
      )}
    </div>
  );
}
