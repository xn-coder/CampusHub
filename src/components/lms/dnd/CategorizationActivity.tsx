
"use client";

import React, { useState } from 'react';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent, DragStartEvent, DragOverlay, useDroppable } from '@dnd-kit/core';
import { SortableContext, useSortable, rectSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { DNDCategorizationItem, DNDCategory } from '@/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface ItemProps {
  item: DNDCategorizationItem;
}

const Item: React.FC<ItemProps> = ({ item }) => {
  return (
    <div className="p-2 bg-background border rounded-md">
      {item.content}
    </div>
  );
};

interface SortableItemProps {
  item: DNDCategorizationItem;
}

const SortableItem: React.FC<SortableItemProps> = ({ item }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="p-2 bg-background border rounded-md cursor-grab active:cursor-grabbing">
      {item.content}
    </div>
  );
};


interface CategoryLaneProps {
  id: string;
  category: DNDCategory;
  items: DNDCategorizationItem[];
}

const CategoryLane: React.FC<CategoryLaneProps> = ({ id, category, items }) => {
  const { setNodeRef } = useDroppable({ id });
  return (
    <Card className="flex-1 min-w-[200px]">
      <CardHeader>
        <CardTitle>{category.title}</CardTitle>
      </CardHeader>
      <CardContent ref={setNodeRef} className="min-h-[100px] p-2 space-y-2 bg-muted/50 rounded-b-md">
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
  
  const [activeItem, setActiveItem] = useState<DNDCategorizationItem | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);

  const sensors = useSensors(useSensor(PointerSensor));

  const findContainer = (id: string) => {
    if (id in items) return id;
    return Object.keys(items).find(key => items[key].some(item => item.id === id));
  };
  
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const container = findContainer(active.id as string);
    if (!container) return;
    const item = items[container].find(i => i.id === active.id);
    setActiveItem(item || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveItem(null);

    if (!over) return;

    const activeContainer = findContainer(active.id as string);
    const overContainer = findContainer(over.id as string);

    if (!activeContainer || !overContainer || activeContainer === overContainer) {
      return;
    }

    setItems((prev) => {
      const activeItems = [...prev[activeContainer]];
      const overItems = [...prev[overContainer]];
      
      const activeIndex = activeItems.findIndex((item) => item.id === active.id);
      const overIndex = overItems.findIndex((item) => item.id === over.id);
      
      let newIndex;
      if (over.id in prev) {
        // We're dropping into a container, not an item
        newIndex = overItems.length;
      } else {
        // We're dropping over an item
        newIndex = overIndex >= 0 ? overIndex : overItems.length;
      }
      
      const [movedItem] = activeItems.splice(activeIndex, 1);
      overItems.splice(newIndex, 0, movedItem);

      return {
        ...prev,
        [activeContainer]: activeItems,
        [overContainer]: overItems,
      };
    });
  };


  const checkAnswers = () => {
    let allCorrect = true;
    if (items.unassigned.length > 0) {
        allCorrect = false;
    } else {
        for (const categoryId in items) {
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
    }
    
    setIsCorrect(allCorrect);
    if(allCorrect) onComplete();
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="space-y-4">
        <Card className="w-full">
            <CardHeader><CardTitle>Items to Categorize</CardTitle></CardHeader>
             <CardContent ref={useDroppable({id: 'unassigned'}).setNodeRef} className="min-h-[100px] p-2 flex flex-wrap gap-2 bg-muted/50">
              <SortableContext items={items.unassigned} strategy={rectSortingStrategy}>
                {items.unassigned.map(item => <SortableItem key={item.id} item={item} />)}
              </SortableContext>
            </CardContent>
          </Card>
        <div className="flex flex-wrap gap-4">
          {categories.map(category => (
            <CategoryLane key={category.id} id={category.id} category={category} items={items[category.id]} />
          ))}
        </div>
      </div>
       <div className="mt-6 flex flex-col items-center gap-4">
        <Button onClick={checkAnswers}>Check My Answers</Button>
        {isCorrect === true && <p className="text-green-600 font-bold">All correct! Well done!</p>}
        {isCorrect === false && <p className="text-destructive font-bold">Not quite right. Try moving some items around.</p>}
      </div>
      <DragOverlay>
        {activeItem ? <Item item={activeItem} /> : null}
      </DragOverlay>
    </DndContext>
  );
};
