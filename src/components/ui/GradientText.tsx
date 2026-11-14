import type { ComponentProps } from 'react';
import type { Transition } from 'framer-motion';
import { cn } from '@/lib/utils';

// Retain the existing call signature while headings adopt Signal's static ink.
type GradientTextProps = ComponentProps<'span'> & {
  text: string;
  gradient?: string;
  neon?: boolean;
  transition?: Transition;
};

function GradientText({ text, className, gradient, neon, transition, ...props }: GradientTextProps) {
  // These legacy presentation options must not become unknown DOM attributes.
  void gradient; void neon; void transition;
  return <span {...props} className={cn('text-foreground', className)} data-slot="gradient-text">{text}</span>;
}

export { GradientText, type GradientTextProps };
export default GradientText;
