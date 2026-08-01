import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArchiveIcon, ArchiveRestoreIcon, Trash2Icon, XIcon } from 'lucide-react';
import { useBudget } from '../contexts/BudgetContext';
import { Category, PARENT_CATEGORIES, PARENT_STYLES, ParentCategory } from '../types/budget';

interface CategoryEditorSheetProps {
  open: boolean;
  /** null = creating a new category */
  category: Category | null;
  defaultParent: ParentCategory;
  onClose: () => void;
}

export function CategoryEditorSheet({
  open,
  category,
  defaultParent,
  onClose
}: CategoryEditorSheetProps) {
  const { addCategory, updateCategory, deleteCategory, categoryHasEntries } = useBudget();
  const [name, setName] = useState('');
  const [parent, setParent] = useState<ParentCategory>(defaultParent);
  const [goal, setGoal] = useState('');

  useEffect(() => {
    if (open) {
      setName(category?.name ?? '');
      setParent(category?.parent ?? defaultParent);
      setGoal(category && category.monthlyGoal > 0 ? String(category.monthlyGoal) : '');
    }
  }, [open, category, defaultParent]);

  const locked = category ? categoryHasEntries(category.id) : false;
  const canSave = name.trim().length > 0;

  const save = async () => {
    if (!canSave) return;
    const parsed = Number(goal);
    const monthlyGoal = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    try {
      if (category) {
        await updateCategory(category.id, { name: name.trim(), parent, monthlyGoal });
      } else {
        await addCategory(name.trim(), parent, monthlyGoal);
      }
      onClose();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <AnimatePresence>
      {open &&
      <motion.div
        className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}>
        
          <div
          className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
          onClick={onClose}
          aria-hidden="true" />
        
          <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={category ? 'Edit category' : 'New category'}
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', stiffness: 360, damping: 36 }}
          className="relative w-full max-w-md rounded-t-2xl border border-line bg-surface sm:rounded-2xl"
          style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
          
            <header className="flex items-center justify-between border-b border-line px-4 py-2.5">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-subtle">
                {category ? 'Edit category' : 'New category'}
              </span>
              <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-full p-1.5 text-subtle transition-colors hover:bg-canvas hover:text-ink">
              
                <XIcon className="h-4 w-4" aria-hidden="true" />
              </button>
            </header>

            <div className="space-y-4 px-4 py-4">
              <div>
                <label htmlFor="cat-name" className="text-xs font-medium text-muted">
                  Name
                </label>
                <input
                id="cat-name"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Groceries"
                className="mt-1.5 w-full rounded-control border border-line bg-surface px-3 py-3 text-[15px] text-ink outline-none transition-colors placeholder:text-subtle focus:border-ink" />
              
              </div>

              <div>
                <span className="text-xs font-medium text-muted">Bucket</span>
                <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                  {PARENT_CATEGORIES.map((p) => {
                  const active = parent === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setParent(p)}
                      aria-pressed={active}
                      className={`h-10 rounded-control text-[13px] font-semibold transition-colors ${
                      active ? 'text-white' : 'bg-canvas text-muted hover:text-ink'}`
                      }
                      style={active ? { backgroundColor: PARENT_STYLES[p].hex } : undefined}>
                      
                        {p}
                      </button>);

                })}
                </div>
              </div>

              <div>
                <label htmlFor="cat-goal" className="text-xs font-medium text-muted">
                  Monthly goal <span className="text-subtle">(optional)</span>
                </label>
                <div className="mt-1.5 flex items-center rounded-control border border-line bg-surface px-3 focus-within:border-ink">
                  <span className="text-[15px] text-subtle">$</span>
                  <input
                  id="cat-goal"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  placeholder="0"
                  className="tabular w-full bg-transparent px-2 py-3 text-[15px] text-ink outline-none placeholder:text-subtle" />
                
                </div>
              </div>

              <button
              type="button"
              onClick={save}
              disabled={!canSave}
              className="h-12 w-full rounded-control bg-primary text-sm font-semibold text-white transition-transform active:scale-[0.99] disabled:bg-line disabled:text-subtle">
              
                {category ? 'Save changes' : 'Add category'}
              </button>

              {category &&
            <div className="flex items-center gap-2 border-t border-line pt-3">
                  <button
                type="button"
                onClick={async () => {
                  try {
                    await updateCategory(category.id, { archived: !category.archived });
                    onClose();
                  } catch (err) {
                    console.error(err);
                  }
                }}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-control border border-line py-2.5 text-xs font-medium text-muted transition-colors hover:text-ink">

                    {category.archived ?
                <>
                        <ArchiveRestoreIcon className="h-3.5 w-3.5" aria-hidden="true" />
                        Restore
                      </> :

                <>
                        <ArchiveIcon className="h-3.5 w-3.5" aria-hidden="true" />
                        Archive
                      </>
                }
                  </button>
                  <button
                type="button"
                disabled={locked}
                onClick={async () => {
                  try {
                    await deleteCategory(category.id);
                    onClose();
                  } catch (err) {
                    console.error(err);
                  }
                }}
                title={locked ? 'This category has entries — archive it instead' : undefined}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-control border border-line py-2.5 text-xs font-medium text-alert transition-colors hover:bg-alert/5 disabled:opacity-40 disabled:hover:bg-transparent">
                
                    <Trash2Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    Delete
                  </button>
                </div>
            }
              {category && locked &&
            <p className="text-[11px] leading-relaxed text-subtle">
                  Archiving keeps past entries intact and just hides this from the add-expense
                  picker.
                </p>
            }
            </div>
          </motion.div>
        </motion.div>
      }
    </AnimatePresence>);

}