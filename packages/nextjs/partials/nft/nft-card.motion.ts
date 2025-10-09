import { MotionProps, Transition, Variants } from "framer-motion";

const spring: Transition = { type: "spring", stiffness: 260, damping: 22, mass: 0.6 };

export const cardVariants: Variants = {
  rest: {
    rotateX: 0,
    rotateY: 0,
    z: 0,
    boxShadow: "0 10px 20px -10px rgba(0,0,0,0.35)",
    transition: { ...spring, duration: 0.3 },
  },
  hover: (c: { rx: number; ry: number }) => ({
    rotateX: c.rx,
    rotateY: c.ry,
    z: 8,
    boxShadow: "0 25px 60px -15px rgba(0,0,0,0.65)",
    transition: spring,
  }),
  tap: {
    scale: 0.98,
    transition: { type: "spring", stiffness: 500, damping: 30 },
  },
};

export const sheenVariants: Variants = {
  rest: { opacity: 0, x: "-120%", transition: { duration: 0.3 } },
  hover: { opacity: 0.25, x: "120%", transition: { duration: 0.8 } },
};

type TiltState = { rx: number; ry: number };

export function computeTilt(e: React.MouseEvent<HTMLElement>, maxTilt = 12): TiltState {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const px = (e.clientX - rect.left) / rect.width; // 0..1
  const py = (e.clientY - rect.top) / rect.height; // 0..1
  const ry = (px - 0.5) * 2 * maxTilt; // left/right
  const rx = -(py - 0.5) * 2 * maxTilt; // up/down (invert)
  return { rx, ry };
}

export const motionProps: MotionProps = {
  initial: "rest",
  animate: "rest",
  whileHover: "hover",
  whileTap: "tap",
};
