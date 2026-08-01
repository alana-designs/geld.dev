import React from 'react';
import { PARENT_STYLES, ParentCategory } from '../types/budget';

interface GoalBarProps {
  parent: ParentCategory;
  spent: number;
  goal: number;
}

export function GoalBar({ parent, spent, goal }: GoalBarProps) {
  const over = goal > 0 && spent > goal;
  const pct = goal > 0 ? Math.min(spent / goal * 100, 100) : 0;
  return (
    <div
      className="h-1 w-full overflow-hidden rounded-full bg-line"
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}>
      
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{
          width: `${goal > 0 ? pct : 0}%`,
          backgroundColor: over ? '#b1462d' : PARENT_STYLES[parent].hex
        }} />
      
    </div>);

}