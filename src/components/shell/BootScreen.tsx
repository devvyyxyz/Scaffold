import { useEffect, useRef, useState } from "react";
import "./BootScreen.css";

interface BootScreenProps {
  ready: boolean;
  onNext: () => void;
}

interface LoadingStep {
  label: string;
  weight: number; // weight towards the total progress (percentage points)
}

const LOADING_STEPS: LoadingStep[] = [
  { label: "Initialising renderer…", weight: 10 },
  { label: "Loading app settings…", weight: 25 },
  { label: "Applying theme…", weight: 15 },
  { label: "Checking preferences…", weight: 20 },
  { label: "Preparing workspace…", weight: 20 },
  { label: "Ready", weight: 10 },
];

export function BootScreen({ ready, onNext }: BootScreenProps) {
  const [phase, setPhase] = useState<"enter" | "visible">("enter");
  const [stepIndex, setStepIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const stopped = useRef(false);

  // Entrance animation
  useEffect(() => {
    requestAnimationFrame(() => setPhase("visible"));
  }, []);

  // Simulate loading steps with realistic timing, but stop once ready flips
  useEffect(() => {
    if (stepIndex >= LOADING_STEPS.length || stopped.current) return;

    const step = LOADING_STEPS[stepIndex];
    const duration = 200 + Math.random() * 300;
    const startProgress = LOADING_STEPS.slice(0, stepIndex).reduce(
      (sum, s) => sum + s.weight,
      0
    );
    const startTime = performance.now();

    let frameId: number;
    function animate() {
      if (stopped.current) return;
      const elapsed = performance.now() - startTime;
      const t = Math.min(elapsed / duration, 1);
      const eased = 1 - (1 - t) * (1 - t);
      setProgress(startProgress + step.weight * eased);

      if (t < 1) {
        frameId = requestAnimationFrame(animate);
      } else {
        setStepIndex((i) => i + 1);
      }
    }
    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, [stepIndex]);

  // Once the store is ready, stop step progression and smoothly fill to 100%.
  // When the fill animation completes, auto-advance via onNext.
  useEffect(() => {
    if (!ready) return;
    stopped.current = true;

    const startPct = progress;
    const startTime = performance.now();
    const duration = 400;

    let frameId: number;
    function fillToComplete() {
      const elapsed = performance.now() - startTime;
      const t = Math.min(elapsed / duration, 1);
      const eased = 1 - (1 - t) * (1 - t);
      setProgress(startPct + (100 - startPct) * eased);

      if (t < 1) {
        frameId = requestAnimationFrame(fillToComplete);
      } else {
        // Fill animation complete — auto-advance
        onNext();
      }
    }
    frameId = requestAnimationFrame(fillToComplete);
    return () => cancelAnimationFrame(frameId);
  }, [ready]);

  const currentStep = LOADING_STEPS[Math.min(stepIndex, LOADING_STEPS.length - 1)];
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
        <span className="bootStatus">{currentStep.label}</span>
      </div>
    </div>
  );
}