"use client";

import { useRef, type ComponentProps, type CSSProperties } from 'react';
import { motion, useInView, useReducedMotion, type Transition } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useHeadingMotion } from '@/hooks/useHeadingMotion';

type GradientTextProps = ComponentProps<'span'> & {
  text: string;
  gradient?: string;
  neon?: boolean;
  transition?: Transition;
};

const defaultTransition: Transition = { duration: 3, repeat: Infinity, ease: 'linear' };

function GradientText({
  text,
  className,
  gradient = 'linear-gradient(90deg, #3b82f6 0%, #a855f7 20%, #ec4899 50%, #a855f7 80%, #3b82f6 100%)',
  neon = false,
  transition = defaultTransition,
  ...props
}: GradientTextProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { margin: '100px' });
  const reducedMotion = useReducedMotion();
  const { paused } = useHeadingMotion();
  // Start only after the preference is known. Keep offscreen headings static
  // instead of repainting every gradient rail throughout the catalogue page.
  const shouldAnimate = inView && reducedMotion === false && !paused;
  const style: CSSProperties = { backgroundImage: gradient, backgroundPositionX: '0%' };
  const animate = { backgroundPositionX: shouldAnimate ? ['0%', '200%'] : '0%' };
  const activeTransition: Transition = shouldAnimate ? transition : { duration: 0, repeat: 0 };

  return (
    <span {...props} ref={ref} className={cn('relative inline-block', className)} data-slot="gradient-text">
      <motion.span animate={animate} transition={activeTransition} style={style}
        className="m-0 text-transparent bg-clip-text bg-[length:200%_100%]">
        {text}
      </motion.span>
      {neon && <motion.span aria-hidden="true" animate={animate} transition={activeTransition} style={style}
        className="m-0 absolute top-0 left-0 text-transparent bg-clip-text blur-[8px] mix-blend-plus-lighter bg-[length:200%_100%]">
        {text}
      </motion.span>}
    </span>
  );
}

export { GradientText, type GradientTextProps };
export default GradientText;
