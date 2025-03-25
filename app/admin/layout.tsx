"use client";
import React from 'react';
import Image from "next/image";
import Link from 'next/link';
import { Popconfirm } from 'antd';
import { SettingOutlined, LogoutOutlined, RollbackOutlined, UserOutlined } from '@ant-design/icons';
import clsx from 'clsx';
import { usePathname } from 'next/navigation';
import logo from "@/app/images/logo.png";
import Assistant from "@/app/images/assistant.svg";
import Spark from "@/app/images/spark.svg";
import Mcp from "@/app/images/mcp.svg";
import { useSession, signOut } from 'next-auth/react';
import SpinLoading from '@/app/components/loading/SpinLoading';
import { useTranslations } from 'next-intl';

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const c = useTranslations('Common');
  const t = useTranslations('Admin');
  const pathname = usePathname();
  const { data: session, status } = useSession();
  if (status === 'loading') {
    return <main className="h-dvh flex justify-center items-center">
      <SpinLoading />
      <span className='ml-2 text-gray-600'>Loading ...</span>
    </main>;
  }
  if (!session) {
    return <div className="h-dvh flex justify-center items-center">Please sign in</div>;
  }
  return (
    <div className="flex flex-row min-h-screen h-dvh">
      <div className="flex flex-col w-64 bg-gray-100 min-h-screen h-screen p-4 box-border">
        <div className="flex items-center flex-row flex-grow-0 mb-2 h-10 mr-4">
          <Link href="/" className='flex items-center'>
            <Image src={logo} className="ml-1" alt="HiveChat logo" width={24} height={24} />
            <span className='text-xl ml-2'>Hivechat Admin</span>
          </Link>
        </div>
        <hr className='mb-4' />
        <div className={clsx('hover:bg-gray-200 rounded-lg p-2', { 'bg-gray-200': pathname.startsWith('/admin/llm') })}>
          <Link className='w-full flex' href={"/admin/llm"}>
            <Spark width={22} height={22} alt='spark' /><span className='ml-1 text-sm'>{t('models')}</span>
          </Link>
        </div>
        <div className={clsx('hover:bg-gray-200 rounded-lg p-2 mt-1', { 'bg-gray-200': pathname.startsWith('/admin/default-models') })}>
          <Link className='w-full flex items-center' href={"/admin/default-models"}>
            <Assistant style={{ 'marginLeft': '3px' }} /><span className='ml-2 text-sm'>默认模型</span>
          </Link>
        </div>
        <div className={clsx('hover:bg-gray-200 rounded-lg p-2 mt-1', { 'bg-gray-200': pathname.startsWith('/admin/users') })}>
          <Link className='w-full flex' href={"/admin/users/list"}>
            <UserOutlined style={{ 'marginLeft': '3px' }} /><span className='ml-2 text-sm'>{t('users')}</span>
          </Link>
        </div>
        {/* <div className={clsx('hover:bg-gray-200 rounded-lg p-2 mt-1', { 'bg-gray-200': pathname.startsWith('/admin/mcp') })}>
          <Link className='w-full flex items-center' href={"/admin/mcp"}>
            <Mcp style={{ 'marginLeft': '3px' }} /><span className='ml-2 text-sm'>MCP 服务器</span>
          </Link>
        </div> */}
        <div className={clsx('hover:bg-gray-200 rounded-lg p-2 mt-1', { 'bg-gray-200': pathname.startsWith('/admin/system') })}>
          <Link className='w-full flex' href={"/admin/system"}>
            <SettingOutlined style={{ 'marginLeft': '3px' }} /><span className='ml-2 text-sm'>{t('system')}</span>
          </Link>
        </div>
        <div className='mt-auto'>
          <div className="flex items-center flex-grow-0 h-10 mr-4 border-gray-200">
            <Link className='w-full text-sm' href={"/chat/"}>
              <div className={clsx('flex items-center pl-3 mt-2 hover:bg-gray-200 h-9 w-full rounded', pathname.startsWith('/chat/settings') ? 'bg-gray-200' : '')}>
                <RollbackOutlined />
                <span className='ml-2'>{t('backHome')}</span>
              </div>
            </Link>
          </div>
          <div className="flex items-center flex-grow-0 h-10 mr-4 border-gray-200">
            <Popconfirm
              title={t('logoutNoticeTitle')}
              description={t('logoutNoticeDesc')}
              onConfirm={() => {
                signOut({
                  redirect: true,
                  redirectTo: '/chat'
                });
              }}
              okText={c('confirm')}
              cancelText={c('cancel')}
            >
              <div className={clsx('flex items-center cursor-pointer text-sm pl-3 mt-2 hover:bg-gray-200 h-9 w-full rounded', pathname.startsWith('/chat/settings') ? 'bg-gray-200' : '')}
              >
                <LogoutOutlined />
                <span className='ml-2'>{t('logout')}</span>
              </div>
            </Popconfirm>
          </div>
        </div>
      </div>
      <div className='flex flex-row w-0 grow mx-auto justify-center overflow-auto h-dvh'>
        {children}
      </div>
    </div>
  )
}
