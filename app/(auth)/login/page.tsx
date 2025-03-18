"use client";
import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from 'next/link';
import { Form, Input, Button, Alert, Select } from 'antd';
import { TranslationOutlined } from '@ant-design/icons';
import logo from "@/app/images/logo.png";
import Hivechat from "@/app/images/hivechat.svg";
import FeishuLogin from "@/app/components/FeishuLoginButton"
import WecomLogin from "@/app/components/WecomLoginButton"
import DingdingLogin from "@/app/components/DingdingLoginButton"
import { fetchAppSettings } from '@/app/admin/system/actions';
import { getActiveAuthProvides } from '@/app/(auth)/actions';
import SpinLoading from '@/app/components/loading/SpinLoading';
import { useTranslations } from 'next-intl';

interface LoginFormValues {
  email: string;
  password: string;
}

export default function LoginPage() {
  const t = useTranslations('Auth');
  const [form] = Form.useForm<LoginFormValues>();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [isRegistrationOpen, setIsRegistrationOpen] = useState(false);
  const [authProviders, setAuthProviders] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [currentLang, setCurrentLang] = useState('en');

  async function handleSubmit(values: LoginFormValues) {
    setLoading(true);
    const response = await signIn("credentials", {
      email: values.email,
      password: values.password,
      redirect: false,
    });
    setLoading(false);
    if (response?.error) {
      console.log(response?.error);
      setError(t('passwordError'));
      return;
    }
    router.push("/chat");
  }

  useEffect(() => {
    // 获取当前语言设置
    const getCookie = (name: string) => {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return parts.pop()?.split(';').shift();
      return undefined;
    };
    
    const savedLang = getCookie('language');
    if (savedLang && ['zh', 'en'].includes(savedLang)) {
      setCurrentLang(savedLang);
    }
    
    const fetchSettings = async () => {
      const resultValue = await fetchAppSettings('isRegistrationOpen');
      setIsRegistrationOpen(resultValue === 'true');
      const activeAuthProvides = await getActiveAuthProvides();
      setAuthProviders(activeAuthProvides)
    }
    fetchSettings().then(() => {
      setIsFetching(false);
    });
  }, []);

  const handleLanguageChange = (value: string) => {
    document.cookie = `language=${value}; path=/`;
    window.location.reload();
  };

  if (isFetching) {
    return (
      <main className="h-dvh flex justify-center items-center">
        <SpinLoading />
        <span className='ml-2 text-gray-600'>Loading ...</span>
      </main>
    )
  }
  return (
    <div className="flex flex-col min-h-screen items-center justify-center bg-slate-50">
      <div className="flex items-center flex-row mb-6">
        <Link href="/" className='flex items-center'>
          <Image src={logo} className="ml-1" alt="HiveChat logo" width={32} height={32} />
          <Hivechat className="ml-1" alt="HiveChat text" width={156} height={39} />
        </Link>
      </div>

      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-xl">
        <div className="mb-6 p-3 bg-blue-50 rounded-lg border border-blue-100 flex items-center justify-center">
          <TranslationOutlined style={{ fontSize: '20px', color: '#3b82f6', marginRight: '12px' }} />
          <span className="mr-3 font-medium text-gray-700">Choose Language:</span>
          <Select
            value={currentLang}
            onChange={handleLanguageChange}
            options={[
              { value: 'en', label: 'English' },
              { value: 'zh', label: '简体中文' },
            ]}
            style={{ width: 140 }}
            size="large"
            dropdownStyle={{ zIndex: 2000 }}
          />
        </div>
        
        <h2 className="text-center text-2xl">{t('login')}</h2>
        
        {authProviders.includes('email') &&
          <>
            {error && <Alert message={error} type="error" />}
            <Form
              form={form}
              layout="vertical"
              onFinish={handleSubmit}
              requiredMark='optional'
            >
              <Form.Item
                name="email"
                label={<span className="font-medium">Email</span>}
                validateTrigger='onBlur'
                rules={[{ required: true, type: 'email', message: t('emailNotice') }]}
              >
                <Input size='large' />
              </Form.Item>
              <Form.Item
                name="password"
                label={<span className="font-medium">{t('password')}</span>}
                rules={[{ required: true, message: t('passwordNotice') }]}
              >
                <Input.Password size='large' />
              </Form.Item>
              <Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  block
                  loading={loading}
                  size='large'
                >
                  {t('login')}
                </Button>
              </Form.Item>
              {isRegistrationOpen && <div className='flex -mt-4'>
                <Link href='/register'>
                  <Button
                    type='link'
                    className='text-sm text-gray-400'
                    style={{ 'padding': '0' }}
                  >{t('register')}</Button>
                </Link>
              </div>
              }
            </Form>
          </>
        }
        {
          authProviders.includes('wecom') &&
          <div className='my-2'><WecomLogin /></div>
        }
        {
          authProviders.includes('feishu') &&
          <div className='my-2'><FeishuLogin /></div>
        }
        {
          authProviders.includes('dingding') &&
          <div className='my-2'><DingdingLogin /></div>
        }
      </div>
    </div>
  );
}