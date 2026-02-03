import type { DemoScene } from "../DemoScene";
import { TimerCounterDemo } from "./TimerCounterDemo";
import { PropertyAnimationDemo } from "./PropertyAnimationDemo";
import { MassUpdateDemo } from "./MassUpdateDemo";
import { InteractiveDemo } from "./InteractiveDemo";
import { BillboardDemo } from "./BillboardDemo";

/**
 * Interface for demo implementations
 */
export interface IDemo {
  /** Display name */
  name: string;
  /** Description shown in UI */
  description: string;
  /** Initialize the demo, creating labels etc. */
  setup(scene: DemoScene): Promise<void>;
  /** Called every frame with delta time in seconds */
  update(deltaTime: number): void;
  /** Cleanup any resources (labels are auto-cleaned) */
  cleanup(): void;
}

/**
 * All available demos
 */
export const demos: IDemo[] = [
  new TimerCounterDemo(),
  new PropertyAnimationDemo(),
  new MassUpdateDemo(),
  new InteractiveDemo(),
  new BillboardDemo(),
];
