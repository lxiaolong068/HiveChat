import { getRequestConfig } from 'next-intl/server';
import { headers } from 'next/headers';

export default getRequestConfig(async () => {

  const locales = ['en', 'zh'];
  const defaultLocale = 'en';

  const headersList = headers();
  // 获取 cookie 中的语言设置
  const cookieLanguage = headersList.get('cookie')?.split(';')
    .map(cookie => cookie.trim())
    .find(cookie => cookie.startsWith('language='))
    ?.split('=')[1];
  // 如果 cookie 中有有效的语言设置，直接使用
  if (cookieLanguage && locales.includes(cookieLanguage)) {
    return {
      locale: cookieLanguage,
      messages: (await import(`../locales/${cookieLanguage}.json`)).default
    };
  }
  
  // 直接使用英语作为默认语言，忽略浏览器语言设置
  return {
    locale: defaultLocale,
    messages: (await import(`../locales/${defaultLocale}.json`)).default
  };
});