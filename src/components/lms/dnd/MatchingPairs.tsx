
"use client";

import React, { useState } from 'react';
import { DndContext, useSensor, useSensors, PointerSensor, closestCenter, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { DNDMatchingItem } from '@/types';
import { Button } from '@/components/ui/button';

interface SortableItemProps {
  id: string;
  content: string;
  isCorrect?: boolean;
}

const SortableItem: React.FC<SortableItemProps> = ({ id, content, isCorrect }) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const colorClass = isCorrect === true ? 'bg-green-100 dark:bg-green-900/50 border-green-500' : 
                     isCorrect === false ? 'bg-red-100 dark:bg-red-900/50 border-destructive' : '';

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className={`p-3 bg-background border rounded-md cursor-grab active:cursor-grabbing ${colorClass}`}>
      {content}
    </div>
  );
};

interface MatchingPairsActivityProps {
  items: DNDMatchingItem[];
  onComplete: () => void;
}

export const MatchingPairsActivity: React.FC<MatchingPairsActivityProps> = ({ items, onComplete }) => {
  const prompts = React.useMemo(() => items.map(item => ({ id: `prompt-${item.id}`, content: item.prompt })), [items]);
  const initialMatches = React.useMemo(() => items.map(item => ({ id: `match-${item.id}`, content: item.match })).sort(() => Math.random() - 0.5), [items]);
  
  const [matches, setMatches] = useState(initialMatches);
  const [results, setResults] = useState<(boolean | undefined)[]>(new Array(items.length).fill(undefined));

  const sensors = useSensors(useSensor(PointerSensor));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setMatches((currentMatches) => {
        const oldIndex = currentMatches.findIndex(m => m.id === active.id);
        const newIndex = currentMatches.findIndex(m => m.id === over.id);
        return arrayMove(currentMatches, oldIndex, newIndex);
      });
      setResults(new Array(items.length).fill(undefined)); // Reset results on reorder
    }
  };

  const checkAnswers = () => {
    const newResults = items.map((item, index) => {
      return `match-${item.id}` === matches[index].id;
    });
    setResults(newResults);
    if (newResults.every(r => r === true)) {
      onComplete();
    }
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-2 gap-4 items-start">
        {/* Prompts Column */}
        <div className="space-y-2">
          <h3 className="font-bold text-center">Prompts</h3>
          {prompts.map((prompt, index) => (
            <div key={prompt.id} className={`p-3 border rounded-md ${results[index] === true ? 'bg-green-100 dark:bg-green-900/50' : ''}`}>
              {prompt.content}
            </div>
          ))}
        </div>
        {/* Matches Column (Sortable) */}
        <div className="space-y-2">
          <h3 className="font-bold text-center">Matches (Drag to reorder)</h3>
          <SortableContext items={matches} strategy={verticalListSortingStrategy}>
            {matches.map((match, index) => (
              <SortableItem key={match.id} id={match.id} content={match.content} isCorrect={results[index]} />
            ))}
          </SortableContext>
        </div>
      </div>
      <div className="mt-6 flex flex-col items-center gap-4">
        <Button onClick={checkAnswers}>Check My Answers</Button>
        {results.includes(true) && results.includes(false) && <p className="text-muted-foreground">Some are correct! Keep trying.</p>}
      </div>
    </DndContext>
  );
};
