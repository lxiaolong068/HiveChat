'use client';
import React, { useEffect } from 'react'
import useGlobalConfigStore from '@/app/store/globalConfig';
import { fetchAppSettings } from '@/app/admin/system/actions';

const AppPrepare = () => {
  const { setChatNamingModel } = useGlobalConfigStore();
  useEffect(() => {
    // 设置默认语言为英语
    const setDefaultLanguage = () => {
      const languageCookie = document.cookie
        .split('; ')
        .find(row => row.startsWith('language='));
      
      // 如果没有语言cookie，设置默认为英语
      if (!languageCookie) {
        document.cookie = 'language=en; path=/';
      }
    };
    
    const initializeAppSettings = async () => {
      const result = await fetchAppSettings('chatNamingModel');
      if (result) {
        setChatNamingModel(result)
      } else {
        setChatNamingModel('current')
      }
    }
    
    setDefaultLanguage();
    initializeAppSettings();
  }, [setChatNamingModel]);
  return (
    <></>
  )
}

export default AppPrepare