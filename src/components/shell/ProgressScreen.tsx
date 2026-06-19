import { useEffect, useRef, useState } from "react";
import "./BootScreen.css";

interface Step {
  label: string;
  weight: number;
}

interface ProgressScreenProps {
  steps: Step[];
  /** Called once progress reaches 100% and the fill animation completes. */
  onComplete: () => void;
  /** Fires each time a step completes. Return false to abort. */
  onStep?: (index: number) => Promise<boolean | void>;
}

/**
 * Reusable loading screen with animated progress bar and step labels.
 * Auto-advances through steps, runs `onStep` callbacks for each one,
 * then fires `onComplete` when done.
 */
export function ProgressScreen({ steps, onComplete, onStep }: ProgressScreenProps) {
  const [phase, setPhase] = useState<"enter" | "visible">("enter");
  const [stepIndex, setStepIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState(steps[0]?.label ?? "");
  const aborted = useRef(false);

  // Entrance animation
  useEffect(() => {
    requestAnimationFrame(() => setPhase("visible"));
  }, []);

  // Process steps sequentially
  useEffect(() => {
    if (stepIndex >= steps.length || aborted.current) return;

    const step = steps[stepIndex];
    setStatus(step.label);

    const startProgress = steps.slice(0, stepIndex).reduce((sum, s) => sum + s.weight, 0);
    const duration = 200 + Math.random() * 300;
    const startTime = performance.now();

    let frameId: number;

    async function runStep() {
      // Animate progress bar for this step
      await new Promise<void>((resolve) => {
        function animate() {
          if (aborted.current) return resolve();
          const elapsed = performance.now() - startTime;
          const t = Math.min(elapsed / duration, 1);
          const eased = 1 - (1 - t) * (1 - t);
          setProgress(startProgress + step.weight * eased);

          if (t < 1) {
            frameId = requestAnimationFrame(animate);
          } else {
            resolve();
          }
        }
        frameId = requestAnimationFrame(animate);
      });

      // Execute the step callback
      if (onStep) {
        const result = await onStep(stepIndex);
        if (result === false) {
          aborted.current = true;
          return;
        }
      }

      setStepIndex((i) => i + 1);
    }

    runStep();
    return () => { if (frameId) cancelAnimationFrame(frameId); };
  }, [stepIndex]);

  // Once all steps are done, smoothly fill to 100% then complete
  useEffect(() => {
    if (stepIndex < steps.length) return;
    if (aborted.current) return;

    const startPct = progress;
    const startTime = performance.now();
    const duration = 300;

    let frameId: number;
    function fillToComplete() {
      const elapsed = performance.now() - startTime;
      const t = Math.min(elapsed / duration, 1);
      const eased = 1 - (1 - t) * (1 - t);
      setProgress(startPct + (100 - startPct) * eased);

      if (t < 1) {
        frameId = requestAnimationFrame(fillToComplete);
      } else {
        onComplete();
      }
    }
    frameId = requestAnimationFrame(fillToComplete);
    return () => cancelAnimationFrame(frameId);
  }, [stepIndex >= steps.length]);

  const pct = Math.round(progress);

  return (
    <div className={`boot ${phase}`}>
      <div className="bootBrand">
        <svg
          className="bootLogo"
          width="64"
          height="64"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <path d="M9 8h4a2.5 2.5 0 0 1 0 5H9m0 0h4.5a2.5 2.5 0 0 1 0 5H9" />
        </svg>
        <span className="bootName">Scaffold</span>
      </div>
      <div className="bootLoad">
        <div className="bootBar">
          <div className="bootBarFill" style={{ width: `${pct}%` }} />
        </div>
        <span className="bootStatus">{status}</span>
      </div>
    </div>
  );
}