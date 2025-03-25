'use client';
import React, { useEffect, useState } from 'react'
import { getMcpServerList, addMcpServer, updateMcpServer, deleteMcpServer } from './actions';
import { Tag, Button, Modal, Form, Input, Switch, Divider, message, Skeleton } from 'antd';
import { useTranslations } from 'next-intl';
type FormValues = {
  name: string;
  description: string | null;
  isActive: boolean;
  baseUrl: string;
}

const McpPage = () => {
  const t = useTranslations('Admin.Users');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [mcpServerList, setMcpServerList] = useState<FormValues[]>([]);
  const [fetchStatus, setFetchStatus] = useState(true);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();

  useEffect(() => {
    const fetchMcpServerList = async (): Promise<void> => {
      const mcpServerList = await getMcpServerList();
      setMcpServerList(mcpServerList);
      setFetchStatus(false)
    };
    fetchMcpServerList();
  }, []);

  const showAddMcpServerModal = () => {
    setIsModalOpen(true);
  };

  const handleOk = () => {
    form.submit();
  };

  const handleEditOk = () => {
    editForm.submit();
  };

  const handleCancel = () => {
    form.resetFields();
    setIsModalOpen(false);
  };

  const handleEditUserModalCancel: () => void = () => {
    editForm.resetFields();
    setIsEditModalOpen(false);
  };

  const onFinish = async (values: FormValues) => {
    setConfirmLoading(true);
    const result = await addMcpServer({
      ...values,
      description: values.description || undefined,
    });
    if (result.success) {
      setConfirmLoading(false);
      setIsModalOpen(false);
      const mcpServerList = await getMcpServerList();
      setMcpServerList(mcpServerList);
      message.success("添加成功");
      form.resetFields();
    } else {
      message.error(result.message);
      setConfirmLoading(false);
    }
  };

  const onEditFinish = async (values: FormValues) => {
    setConfirmLoading(true);
    const result = await updateMcpServer(values.name, values);
    if (result.success) {
      setConfirmLoading(false);
      setIsEditModalOpen(false);
      const mcpServerList = await getMcpServerList();
      setMcpServerList(mcpServerList);
      message.success("更新成功");
      editForm.resetFields();
    } else {
      message.error(result.message);
      setConfirmLoading(false);
    }
  };

  const handleEditMcpServer = async (mcpInfo: FormValues) => {
    editForm.setFieldsValue({
      'name': mcpInfo.name,
      'description': mcpInfo.description,
      'baseUrl': mcpInfo.baseUrl,
      'isActive': mcpInfo.isActive,
    })
    setIsEditModalOpen(true);
  }

  const handleDeleteMcpServer = async (name: string) => {
    if (confirm('确认要删除吗')) {
      const result = await deleteMcpServer(name);
      if (result.success) {
        const mcpServerList = await getMcpServerList();
        setMcpServerList(mcpServerList);
        message.success('删除成功');
      } else {
        message.error(result.message)
      }
    }
  }
  return (
    <div className='container max-w-4xl mb-6 px-4 md:px-0 pt-6'>
      <div className='h-4 w-full mb-10'>
        <h2 className="text-xl font-bold mb-4 mt-6">MCP 服务器</h2>
      </div>
      <div className='w-full mb-6 flex flex-row justify-between items-center'>
        <Button type='primary' onClick={showAddMcpServerModal}>添加服务器</Button>
      </div>
      {fetchStatus ? <><Skeleton active /></> :
        <><div className="overflow-hidden rounded-lg border border-slate-300">
          <table className='border-collapse w-full'>
            <thead>
              <tr className="bg-slate-100">
                <th className='border-b border-r border-slate-300 p-2'>名称</th>
                <th className='border-b border-r border-slate-300 p-2'>描述</th>
                <th className='border-b border-r border-slate-300 p-2 w-16'>类型</th>
                <th className='border-b border-r border-slate-300 p-2 w-28'>状态</th>
                <th className='border-b border-slate-300 p-2 w-32'>{t('action')}</th>
              </tr>
            </thead>
            <tbody>
              {mcpServerList.map((mcpServer, index) => (
                <tr key={mcpServer.name} className="hover:bg-slate-50">
                  <td className='border-t border-r text-sm border-slate-300 p-2'>{mcpServer.name}</td>
                  <td className='border-t border-r text-sm border-slate-300 p-2'>{mcpServer.description}</td>
                  <td className='border-t border-r text-sm border-slate-300 w-16 text-center'><Tag style={{ margin: 0 }}>SSE</Tag></td>
                  <td className='border-t border-r text-sm border-slate-300 p-2 text-center'>{mcpServer.isActive ?
                    <div className='flex flex-row items-center justify-center'>
                      <div className='w-2 h-2 bg-green-500 rounded-full'></div>
                      <span className='ml-2 text-sm'>已启用</span>
                    </div> :
                    <div className='flex flex-row items-center justify-center'>
                      <div className='w-2 h-2 bg-gray-400 rounded-full'></div>
                      <span className='ml-2 text-sm'>未启用</span>
                    </div>
                  }</td>
                  <td className='border-t text-center text-sm w-32 border-slate-300 p-2'>
                    <Button
                      size='small'
                      className='text-sm'
                      type='link'
                      onClick={() => {
                        handleEditMcpServer(mcpServer)
                      }}
                    >{t('edit')}</Button>
                    <Divider type="vertical" />
                    <Button
                      size='small'
                      className='text-sm'
                      type='link'
                      onClick={() => {
                        handleDeleteMcpServer(mcpServer.name)
                      }}
                    >{t('delete')}</Button>
                  </td>

                </tr>
              ))}
            </tbody>
          </table>
        </div>
          <div className='h-8'></div>
        </>
      }
      <Modal
        title="添加 MCP 服务器"
        open={isModalOpen}
        onOk={handleOk}
        onCancel={handleCancel}
        confirmLoading={confirmLoading}
      >
        <Form
          layout="vertical"
          form={form}
          onFinish={onFinish}
          validateTrigger='onBlur'

        >
          <Form.Item label={<span className='font-medium'>名称</span>} name='name'
            validateTrigger='onBlur'
            rules={[{ required: true, message: '此项为必填' }]}>
            <Input type='text' />
          </Form.Item>
          <Form.Item label={<span className='font-medium'>描述</span>} name='description'>
            <Input.TextArea rows={2} />
          </Form.Item>

          <Form.Item label={<span className='font-medium'>URL</span>}
            name='baseUrl'
            extra="仅支持 SSE 方式"
            validateTrigger='onBlur'
            rules={[{ required: true, message: '此项为必填' }]}>
            <Input type='url' />
          </Form.Item>
          <Form.Item label={<span className='font-medium'>启用</span>} name='isActive'>
            <Switch defaultChecked={false} value={false} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="编辑 MCP 服务器"
        open={isEditModalOpen}
        onOk={handleEditOk}
        onCancel={handleEditUserModalCancel}
        confirmLoading={confirmLoading}
      >
        <Form
          layout="vertical"
          form={editForm}
          onFinish={onEditFinish}
          validateTrigger='onBlur'
        >
          <Form.Item label={<span className='font-medium'>名称</span>} name='name'>
            <Input type='text' disabled />
          </Form.Item>
          <Form.Item label={<span className='font-medium'>描述</span>} name='description'>
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item label={<span className='font-medium'>URL</span>}
            name='baseUrl'
            extra="仅支持 SSE 方式"
            validateTrigger='onBlur'
            rules={[{ required: true, message: '此项为必填' }]}>
            <Input type='url' />
          </Form.Item>
          <Form.Item label={<span className='font-medium'>启用</span>} name='isActive'>
            <Switch defaultChecked={false} value={false} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default McpPage;