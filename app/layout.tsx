import React from 'react';
import type { Metadata } from "next";
import type { Viewport } from 'next'
import { AntdRegistry } from '@ant-design/nextjs-registry';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { SessionProvider } from 'next-auth/react';
import AppPrepare from "@/app/components/AppPrepare";
import "./globals.css";


export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  
  const description = locale === 'en' 
    ? "Chai AI Web - Leading multi-model AI chat platform supporting OpenAI, Claude, Gemini, and other large language models, providing intelligent conversations, image understanding, and knowledge management for teams, making AI communication more natural, efficient, and engaging."
    : "Chai AI Web - 领先的多模型AI聊天平台，支持OpenAI、Claude、Gemini等多种大模型，为团队提供智能对话、图像理解和知识管理，让AI交流更自然、更高效、更有趣。";

  return {
    title: "Chai AI Web",
    description,
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider messages={messages}>
          <SessionProvider>
            <AntdRegistry>
            <AppPrepare />
              {children}
            </AntdRegistry>
          </SessionProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
