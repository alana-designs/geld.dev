import React from 'react';
import { PARENT_STYLES, ParentCategory } from '../types/budget';

interface ParentBadgeProps {
  parent: ParentCategory;
  label?: string;
}

export function ParentBadge({ parent, label }: ParentBadgeProps) {
  const style = PARENT_STYLES[parent];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${style.bg} ${style.border} ${style.text}`}>
      
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} aria-hidden="true" />
      {label ?? parent}
    </span>);

}