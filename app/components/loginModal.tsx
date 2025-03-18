'use client';

import React, { useState, useEffect } from 'react'
import { Modal, Form, Input, Button, Alert, Skeleton, Select, Divider } from 'antd';
import { useLoginModal } from '@/app/contexts/loginModalContext';
import { signIn } from "next-auth/react";
import { fetchAppSettings } from '@/app/admin/system/actions';
import { getActiveAuthProvides } from '@/app/(auth)/actions';
import logo from "@/app/images/logo.png";
import Hivechat from "@/app/images/hivechat.svg";
import Link from 'next/link';
import Image from "next/image";
import FeishuLogin from "@/app/components/FeishuLoginButton"
import WecomLogin from "@/app/components/WecomLoginButton"
import DingdingLogin from "@/app/components/DingdingLoginButton"
import { useTranslations } from 'next-intl';
import useModelListStore from '../store/modelList';
import { fetchAvailableLlmModels } from '../adapter/actions';
import { TranslationOutlined } from '@ant-design/icons';

interface LoginFormValues {
  email: string;
  password: string;
}

export default function LoginModal() {
  const t = useTranslations('Auth');
  const [form] = Form.useForm<LoginFormValues>();
  const { visible, hideLogin } = useLoginModal();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isPending, setIsPending] = useState(true);
  const [authProviders, setAuthProviders] = useState<string[]>([]);
  const [isRegistrationOpen, setIsRegistrationOpen] = useState(false);
  const { initModelList, setCurrentModel, initAllProviderList } = useModelListStore();
  const [currentLang, setCurrentLang] = useState('en');

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
      setAuthProviders(activeAuthProvides);
      setIsPending(false);
    }
    fetchSettings();
  }, []);

  const handleLanguageChange = (value: string) => {
    document.cookie = `language=${value}; path=/`;
    window.location.reload();
  };

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
    const remoteModelList = await fetchAvailableLlmModels();
    const modelNames = remoteModelList.map(model => model.name);
    await initModelList(remoteModelList);
    const lastSelectedModel = localStorage.getItem('lastSelectedModel');
    if (lastSelectedModel && modelNames.includes(lastSelectedModel)) {
      setCurrentModel(lastSelectedModel);
    }
    else {
      if (remoteModelList.length > 0) {
        setCurrentModel(remoteModelList[0].name);
      }
    }
    hideLogin();
  }

  return (
    <Modal
      open={visible}
      onCancel={hideLogin}
      footer={null}
      destroyOnClose
      closable={false}
      maskClosable={false}
      keyboard={false}
      width={420}
    >
      <div className="flex items-center justify-center flex-row mb-4 mt-4">
        <Image src={logo} className="ml-1" alt="HiveChat logo" width={28} height={28} />
        <Hivechat className="ml-1" alt="HiveChat text" width={120} />
        <span className="text-center text-xl">{t('login')}</span>
      </div>

      {/* 添加醒目的语言切换器 */}
      <div className="px-4 mb-5">
        <div className="p-2 bg-blue-50 rounded-lg border border-blue-100 flex items-center justify-between">
          <div className="flex items-center">
            <TranslationOutlined style={{ fontSize: '16px', color: '#3b82f6', marginRight: '8px' }} />
            <span className="text-sm font-medium text-gray-700">Language:</span>
          </div>
          <Select
            value={currentLang}
            onChange={handleLanguageChange}
            options={[
              { value: 'en', label: 'English' },
              { value: 'zh', label: '简体中文' },
            ]}
            style={{ width: 120 }}
            size="middle"
          />
        </div>
      </div>
      
      {isPending ? <div className='mt-4 mb-6'>
        <Skeleton title={false} active paragraph={{ rows: 3 }} />
      </div> : <>
        {authProviders.includes('email') &&
          <div className='px-4 pb-2'>
            {error && <Alert message={error} style={{ 'marginBottom': '1rem' }} type="error" />}
            <Form
              form={form}
              layout="vertical"
              onFinish={handleSubmit}
              requiredMark='optional'
            >
              <Form.Item
                name="email"
                label={<span className="font-medium">Email</span>}
                rules={[{ required: true, message: t('emailNotice') }]}
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
                  size='large'
                  type="primary"
                  htmlType="submit"
                  loading={loading}
                  block
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

          </div>}
        {
          authProviders.includes('wecom') &&
          <div className='px-4 my-2'><WecomLogin /></div>
        }
        {
          authProviders.includes('feishu') &&
          <div className='px-4 my-2'><FeishuLogin /></div>
        }
        {
          authProviders.includes('dingding') &&
          <div className='px-4 my-2'><DingdingLogin /></div>
        }
      </>}
    </Modal>
  );
}