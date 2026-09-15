"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

import { IconMic } from "@/components/icons";

/**
 * Speech-to-text for a textarea, via the browser's own SpeechRecognition - no server, no AI
 * provider, no cost on our side. That is also the ceiling: only Chrome and Edge ship it
 * (Firefox has none; Safari's is unreliable), so this renders nothing at all rather than a
 * disabled button when the browser cannot do it. Typing has to keep working regardless -
 * this is only ever an addition next to it, never a replacement.
 *
 * The textarea stays an uncontrolled field, matching how the form around it already reads
 * answers via FormData rather than React state. This writes into it through a ref instead
 * of lifting it to controlled state, which would mean changing how the whole form works for
 * one optional feature.
 *
 * Recognition results arrive as "everything transcribed so far in this utterance," not as
 * deltas - interim included, which is corrected on every event, not appended. baseTextRef
 * holds what was already in the box before this listening session started, so turning the
 * mic on twice appends to what is there rather than overwriting the answer typed before it.
 */
export function DictateButton({
  targetRef,
  className,
}: {
  targetRef: RefObject<HTMLTextAreaElement | null>;
  className?: string;
}) {
  // Read once, synchronously, during the first render rather than set from inside an
  // effect - there is nothing to subscribe to here, just a capability check. Safe to read
  // window unconditionally: this component is only ever loaded via next/dynamic with
  // ssr:false (see sitting.tsx), so it never runs anywhere but a real browser.
  const [supported] = useState(() => !!(window.SpeechRecognition ?? window.webkitSpeechRecognition));
  const [listening, setListening] = useState(false);
  const [deniedMic, setDeniedMic] = useState(false);
  const recognitionRef = useRef<InstanceType<SpeechRecognitionCtor> | null>(null);
  const baseTextRef = useRef("");

  useEffect(() => {
    const Ctor: SpeechRecognitionCtor | undefined =
      window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Ctor) return;

    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    // Nigerian universities defend in English regardless of first language, and a fixed
    // locale is more predictable than trusting the browser's own language guess.
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += transcript;
        else interim += transcript;
      }

      if (final.trim()) {
        baseTextRef.current = `${baseTextRef.current}${final.trim()} `;
      }

      const textarea = targetRef.current;
      if (textarea) textarea.value = `${baseTextRef.current}${interim}`;
    };

    recognition.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setDeniedMic(true);
      }
      setListening(false);
    };

    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    return () => recognition.stop();
  }, [targetRef]);

  if (!supported) return null;

  const toggle = () => {
    const recognition = recognitionRef.current;
    if (!recognition) return;

    if (listening) {
      recognition.stop();
      return;
    }

    setDeniedMic(false);
    const current = targetRef.current?.value ?? "";
    baseTextRef.current = current ? `${current} ` : "";
    recognition.start();
    setListening(true);
  };

  return (
    <div className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      <button
        type="button"
        onClick={toggle}
        aria-pressed={listening}
        className={`press inline-flex items-center gap-2 rounded-control border px-3 py-1.5 text-sm font-medium
          transition-[background-color,border-color,color] duration-150
          ${
            listening
              ? "border-danger/40 bg-danger/8 text-danger hover:bg-danger/15"
              : "border-navy-300 bg-surface text-brand shadow-hairline hover:border-navy-500 hover:bg-navy-050"
          }`}
      >
        {listening ? (
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-danger opacity-75" />
            <span className="relative inline-flex size-2.5 rounded-full bg-danger" />
          </span>
        ) : (
          <IconMic className="size-4" />
        )}
        {listening ? "Listening… tap to stop" : "Dictate"}
      </button>
      {deniedMic && (
        <p className="text-xs text-danger">Microphone access was denied.</p>
      )}
    </div>
  );
}

/**
 * The Web Speech API has no standard TypeScript lib coverage - it is still vendor-prefixed
 * on every browser that ships it. This is the minimal shape this component actually reads
 * and writes, not the full spec, kept local rather than pulled from a types-only package
 * for a handful of fields.
 */
type SpeechRecognitionResultLike = { isFinal: boolean; 0: { transcript: string } };
type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
};
type SpeechRecognitionErrorEventLike = { error: string };

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  }
}
