
"use client";

import React, { useState } from 'react';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragOverlay, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, rectSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { DNDCategorizationItem, DNDCategory } from '@/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface SortableItemProps {
  item: DNDCategorizationItem;
}

const SortableItem: React.FC<SortableItemProps> = ({ item }) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="p-2 bg-background border rounded-md cursor-grab active:cursor-grabbing">
      {item.content}
    </div>
  );
};

interface CategoryLaneProps {
  category: DNDCategory;
  items: DNDCategorizationItem[];
}

const CategoryLane: React.FC<CategoryLaneProps> = ({ category, items }) => {
  const { setNodeRef } = useSortable({ id: category.id, disabled: true });

  return (
    <Card ref={setNodeRef} className="flex-1 min-w-[200px]">
      <CardHeader>
        <CardTitle>{category.title}</CardTitle>
      </CardHeader>
      <CardContent className="min-h-[100px] p-2 space-y-2 bg-muted/50 rounded-b-md">
        <SortableContext items={items} strategy={rectSortingStrategy}>
          {items.map(item => <SortableItem key={item.id} item={item} />)}
        </SortableContext>
      </CardContent>
    </Card>
  );
};

interface CategorizationActivityProps {
  initialItems: DNDCategorizationItem[];
  categories: DNDCategory[];
  onComplete: () => void;
}

export const CategorizationActivity: React.FC<CategorizationActivityProps> = ({ initialItems, categories, onComplete }) => {
  const [items, setItems] = useState<Record<string, DNDCategorizationItem[]>>(() => {
    const initialState: Record<string, DNDCategorizationItem[]> = { unassigned: [] };
    categories.forEach(c => initialState[c.id] = []);
    initialItems.forEach(item => initialState.unassigned.push(item));
    return initialState;
  });
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);

  const sensors = useSensors(useSensor(PointerSensor));

  const findContainer = (id: string) => {
    if (id in items) return id;
    return Object.keys(items).find(key => items[key].some(item => item.id === id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeContainer = findContainer(active.id as string);
    const overContainer = findContainer(over.id as string);
    if (!activeContainer || !overContainer || activeContainer === overContainer) return;

    setItems(prev => {
      const activeItems = prev[activeContainer];
      const overItems = prev[overContainer];
      const activeIndex = activeItems.findIndex(item => item.id === active.id);
      const overIndex = overItems.findIndex(item => item.id === over.id);

      let newItems = { ...prev };
      const [movedItem] = newItems[activeContainer].splice(activeIndex, 1);
      newItems[overContainer].splice(overIndex, 0, movedItem);
      return newItems;
    });
  };

  const checkAnswers = () => {
    let allCorrect = true;
    for (const categoryId in items) {
      if (categoryId === 'unassigned' && items.unassigned.length > 0) {
        allCorrect = false;
        break;
      }
      if (categoryId !== 'unassigned') {
        for (const item of items[categoryId]) {
          if (item.category !== categoryId) {
            allCorrect = false;
            break;
          }
        }
      }
      if (!allCorrect) break;
    }
    setIsCorrect(allCorrect);
    if(allCorrect) onComplete();
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-4">
          <Card className="w-full">
            <CardHeader><CardTitle>Unassigned Items</CardTitle></CardHeader>
            <CardContent className="min-h-[100px] p-2 flex flex-wrap gap-2 bg-muted/50">
              <SortableContext items={items.unassigned} strategy={rectSortingStrategy}>
                {items.unassigned.map(item => <SortableItem key={item.id} item={item} />)}
              </SortableContext>
            </CardContent>
          </Card>
        </div>
        <div className="flex flex-wrap gap-4">
          {categories.map(category => (
            <CategoryLane key={category.id} category={category} items={items[category.id]} />
          ))}
        </div>
      </div>
       <div className="mt-6 flex flex-col items-center gap-4">
        <Button onClick={checkAnswers}>Check My Answers</Button>
        {isCorrect === true && <p className="text-green-600 font-bold">All correct! Well done!</p>}
        {isCorrect === false && <p className="text-destructive font-bold">Not quite right. Try moving some items around.</p>}
      </div>
    </DndContext>
  );
};
