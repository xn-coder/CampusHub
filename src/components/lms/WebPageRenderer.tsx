"use client";

import React from 'react';
import type { WebPageContent, WebPageSection } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Phone, Mail, Link2 as WebsiteIcon, MapPin, Instagram, Facebook, Twitter, Linkedin } from 'lucide-react';
import Image from 'next/image';
import { Button } from '../ui/button';

interface WebPageRendererProps {
  content: WebPageContent;
}

const renderSection = (section: WebPageSection) => {
  switch (section.type) {
    case 'heading':
      return <h2 key={section.id} className="text-2xl font-bold mt-6 mb-3">{section.content}</h2>;
    case 'text':
      return <div key={section.id} className="prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: section.content }} />;
    case 'image':
      return (
        <div key={section.id} className="my-4 relative aspect-video">
          <Image src={section.content} alt="Web page image" layout="fill" className="rounded-lg object-contain" />
        </div>
      );
    default:
      return null;
  }
};

const ProfileCardTemplate: React.FC<{ data: NonNullable<WebPageContent['profileCardData']> }> = ({ data }) => {
    // Basic WhatsApp URL formatting
    const whatsappUrl = data.whatsapp ? `https://wa.me/${data.whatsapp.replace(/\D/g, '')}` : undefined;

    return (
        <div className="max-w-md mx-auto">
            <Card className="overflow-hidden">
                <div className="relative h-32 bg-muted">
                    {data.bannerImageUrl && (
                        <Image src={data.bannerImageUrl} alt="Banner" layout="fill" className="object-cover" />
                    )}
                </div>
                <div className="relative flex flex-col items-center p-6 -mt-16">
                    <Avatar className="w-24 h-24 border-4 border-background">
                        <AvatarImage src={data.profileImageUrl} />
                        <AvatarFallback>{data.name?.substring(0, 2).toUpperCase() || 'P'}</AvatarFallback>
                    </Avatar>
                    <CardTitle className="mt-2 text-2xl">{data.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">{data.jobTitle}</p>
                    <p className="mt-2 text-center text-sm">{data.description}</p>
                </div>
                <Separator />
                <CardContent className="p-6 space-y-3 text-sm">
                    {data.phone && <div className="flex items-center gap-3"><Phone className="h-4 w-4 text-muted-foreground" /> <span>{data.phone}</span></div>}
                    {data.email && <div className="flex items-center gap-3"><Mail className="h-4 w-4 text-muted-foreground" /> <span>{data.email}</span></div>}
                    {data.website && <div className="flex items-center gap-3"><WebsiteIcon className="h-4 w-4 text-muted-foreground" /> <a href={data.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate">{data.website}</a></div>}
                    {data.address && <div className="flex items-start gap-3"><MapPin className="h-4 w-4 text-muted-foreground mt-1 shrink-0" /> <span>{data.address}</span></div>}
                </CardContent>
                <CardFooter className="bg-muted/50 p-4 flex justify-center gap-4">
                    {whatsappUrl && <Button asChild variant="ghost" size="icon"><a href={whatsappUrl} target="_blank" rel="noopener noreferrer"><svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5"><title>WhatsApp</title><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.297-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.204-1.634a11.86 11.86 0 005.785 1.47h.004c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg></a></Button>}
                    {data.instagram && <Button asChild variant="ghost" size="icon"><a href={`https://instagram.com/${data.instagram.replace('@','')}`} target="_blank" rel="noopener noreferrer"><Instagram className="h-5 w-5"/></a></Button>}
                    {data.facebook && <Button asChild variant="ghost" size="icon"><a href={data.facebook} target="_blank" rel="noopener noreferrer"><Facebook className="h-5 w-5"/></a></Button>}
                    {data.twitter && <Button asChild variant="ghost" size="icon"><a href={`https://twitter.com/${data.twitter.replace('@','')}`} target="_blank" rel="noopener noreferrer"><Twitter className="h-5 w-5"/></a></Button>}
                    {data.linkedin && <Button asChild variant="ghost" size="icon"><a href={data.linkedin} target="_blank" rel="noopener noreferrer"><Linkedin className="h-5 w-5"/></a></Button>}
                </CardFooter>
            </Card>
        </div>
    );
};

const DefaultTemplate: React.FC<{ sections: WebPageSection[] }> = ({ sections }) => (
  <div className="max-w-3xl mx-auto">
    {sections.map(renderSection)}
  </div>
);

const ArticleTemplate: React.FC<{ sections: WebPageSection[] }> = ({ sections }) => (
  <article className="max-w-prose mx-auto">
    {sections.map(renderSection)}
  </article>
);


export const WebPageRenderer: React.FC<WebPageRendererProps> = ({ content }) => {
  const { template, sections, profileCardData } = content;

  switch (template) {
    case 'profile_card':
      return profileCardData ? <ProfileCardTemplate data={profileCardData} /> : <p className="text-destructive">Profile card data is missing.</p>;
    case 'article':
      return <ArticleTemplate sections={sections} />;
    case 'default':
    default:
      return <DefaultTemplate sections={sections} />;
  }
};
