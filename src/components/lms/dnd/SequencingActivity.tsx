
"use client";

import React, { useState, useMemo } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { DNDSequencingItem } from '@/types';
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

interface SequencingActivityProps {
  items: DNDSequencingItem[];
  onComplete: () => void;
}

export const SequencingActivity: React.FC<SequencingActivityProps> = ({ items, onComplete }) => {
  const [shuffledItems, setShuffledItems] = useState(() => 
    [...items].sort(() => Math.random() - 0.5)
  );
  
  const [results, setResults] = useState<(boolean | undefined)[]>(
    new Array(items.length).fill(undefined)
  );

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setShuffledItems((currentItems) => {
        const oldIndex = currentItems.findIndex(item => item.id === active.id);
        const newIndex = currentItems.findIndex(item => item.id === over.id);
        return arrayMove(currentItems, oldIndex, newIndex);
      });
      setResults(new Array(items.length).fill(undefined)); // Reset results on reorder
    }
  };

  const checkAnswers = () => {
    const newResults = shuffledItems.map((item, index) => item.id === items[index].id);
    setResults(newResults);
    if (newResults.every(r => r === true)) {
      onComplete();
    }
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="max-w-md mx-auto space-y-2">
        <SortableContext items={shuffledItems} strategy={verticalListSortingStrategy}>
          {shuffledItems.map((item, index) => (
            <SortableItem key={item.id} id={item.id} content={item.content} isCorrect={results[index]} />
          ))}
        </SortableContext>
      </div>
      <div className="mt-6 flex flex-col items-center gap-4">
        <Button onClick={checkAnswers}>Check My Order</Button>
        {results.includes(false) && <p className="text-destructive font-bold">The order is incorrect. Please try again!</p>}
        {results.every(r => r === true) && <p className="text-green-600 font-bold">Correct! Great job!</p>}
      </div>
    </DndContext>
  );
};
