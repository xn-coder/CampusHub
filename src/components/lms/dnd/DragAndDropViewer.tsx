
"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import type { DNDActivityData } from '@/types';
import { MatchingPairsActivity } from './MatchingPairs';
import { SequencingActivity } from './SequencingActivity';
import { CategorizationActivity } from './CategorizationActivity';

interface DragAndDropViewerProps {
  activityData: DNDActivityData;
  onComplete: () => void;
}

export const DragAndDropViewer: React.FC<DragAndDropViewerProps> = ({ activityData, onComplete }) => {
  const { template, title, instructions } = activityData;

  const renderActivity = () => {
    switch (template) {
      case 'matching':
        return <MatchingPairsActivity items={activityData.matchingItems || []} onComplete={onComplete} />;
      case 'sequencing':
        return <SequencingActivity items={activityData.sequencingItems || []} onComplete={onComplete} />;
      case 'categorization':
        return <CategorizationActivity initialItems={activityData.categorizationItems || []} categories={activityData.categories || []} onComplete={onComplete} />;
      default:
        return <p className="text-destructive">Unknown activity template.</p>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{instructions}</CardDescription>
      </CardHeader>
      <CardContent>
        {renderActivity()}
      </CardContent>
    </Card>
  );
};
