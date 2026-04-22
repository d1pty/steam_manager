import React, { useEffect, useState, useCallback } from 'react';
import {Modal,Button,Avatar,Tag,Tooltip,message,Progress,} from 'antd';
import {UserOutlined,PoweroffOutlined,DeleteOutlined,} from '@ant-design/icons';
import PendingConfirmations from './PendingConfirmations';


export default function AccountModal({ visible, account, onClose, onDelete }) {
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [secondsRemaining, setSecondsRemaining] = useState(null);
  const [pendingOffers, setPendingOffers] = useState([]);
  const [loadingConfirmations, setLoadingConfirmations] = useState(false);

  const fetchTwoFactorCode = async (accountId) => {
    try {
      const response = await fetch(
        `http://localhost:3001/api/get-2fa-code?accountId=${accountId}`
      );
      const data = await response.json();
      if (data.twoFactorCode && data.timeRemaining !== undefined) {
        setTwoFactorCode(data.twoFactorCode);
        setSecondsRemaining(data.timeRemaining);
      }
    } catch (error) {
      console.error('Ошибка при получении 2FA кода:', error);
    }
  };

  const fetchConfirmations = useCallback(async (accountId) => {
    setLoadingConfirmations(true);
    try {
      const response = await fetch(
        `http://localhost:3001/api/pending-confirmations?accountId=${accountId}`
      );
      const data = await response.json();
      setPendingOffers(data.confirmations || []);
    } catch (error) {
      console.error('Ошибка при загрузке подтверждений:', error);
    } finally {
      setLoadingConfirmations(false);
    }
  }, []);

  useEffect(() => {
    if (account?.id && visible) {
      fetchConfirmations(account.id);
    }
  }, [account, visible, fetchConfirmations]);

  useEffect(() => {
    if (!account?.id || !visible) return;

    const updateTimer = () => {
      const now = Date.now();
      const seconds = 30 - Math.floor(now / 1000) % 30;
      const fractional = 1 - (now % 1000) / 1000;
      setSecondsRemaining((seconds - 1 + fractional).toFixed(1));
    };

    fetchTwoFactorCode(account.id).then(updateTimer);
    const intervalId = setInterval(() => {
      updateTimer();
      if (Math.floor(Date.now() / 1000) % 30 === 0) {
        fetchTwoFactorCode(account.id);
      }
    }, 100);

    return () => clearInterval(intervalId);
  }, [account, visible]);

  const handleDisable = async () => {
    try {
      await fetch('http://localhost:3001/api/disable-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: account.id }),
      });
      message.success('Аккаунт выключен');
    } catch (error) {
      console.error(error);
      message.error('Ошибка при выключении');
    }
  };

  const handleEnable = async () => {
    try {
      await fetch('http://localhost:3001/api/enable-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: account.id }),
      });
      message.success('Аккаунт включён');
    } catch (error) {
      console.error(error);
      message.error('Ошибка при включении');
    }
  };

  const handleCopy2FACode = () => {
    navigator.clipboard
      .writeText(twoFactorCode)
      .then(() => message.success('2FA код скопирован'))
      .catch(() => message.error('Ошибка копирования'));
  };

  if (!account) return null;
  const isDisabled = account.status === 'Выключен';

  return (
    <Modal open={visible} title="Информация об аккаунте" onCancel={onClose} footer={null}>

      {/* Блок 1 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Avatar size={64} src={account.avatar || 'http://localhost:3001/images/defaultAvatar.jpg'} icon={<UserOutlined />} />
          <div>
            <div><strong style={{ fontSize: 18 }}>{account.username}</strong></div>
            <Tag style={{ marginTop: 4 }} color={account.status === 'Вход выполнен' ? 'green' : isDisabled ? 'volcano' : 'red'}>
              {account.status}
            </Tag>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Tooltip title={isDisabled ? 'Включить аккаунт' : 'Выключить аккаунт'}>
            <Button type="text" shape="circle" size="large" icon={<PoweroffOutlined style={{ fontSize: 20, color: isDisabled ? '#52c41a' : '#faad14' }} />} onClick={isDisabled ? handleEnable : handleDisable} />
          </Tooltip>
          <Tooltip title="Удалить аккаунт">
            <Button type="text" shape="circle" size="large" danger icon={<DeleteOutlined style={{ fontSize: 20 }} />} onClick={() => onDelete(account.id)} />
          </Tooltip>
        </div>
      </div>

      {/* Блок 2 */}
      <div style={{ marginBottom: 24 }}>
        <strong>Текущий 2FA код:</strong>
        <div onClick={handleCopy2FACode} style={{ cursor: 'pointer', fontSize: 16, padding: '8px', backgroundColor: '#f0f0f0', borderRadius: '4px', textAlign: 'center', marginTop: 4 }}>
          {twoFactorCode || 'Загрузка...'}
        </div>
        {secondsRemaining !== null && (
          <div style={{ marginTop: 10 }}>
            <Progress percent={(secondsRemaining / 30) * 100} status="active" showInfo={false} strokeColor="#52c41a" />
          </div>
        )}
      </div>

      {/* Блок 3 */}
      <div>
        <PendingConfirmations
          accountId={account.id}
          fetchConfirmations={fetchConfirmations}
          pendingOffers={pendingOffers}
          loadingConfirmations={loadingConfirmations}
       />
      </div>
    </Modal>
  );
}