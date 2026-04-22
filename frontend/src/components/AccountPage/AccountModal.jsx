import React, { useEffect, useState, useCallback } from 'react';
import {
  Modal,
  Button,
  Avatar,
  Tag,
  Tooltip,
  message,
  Progress,
  Card,
  Empty,
  Skeleton,
} from 'antd';
import {
  UserOutlined,
  PoweroffOutlined,
  DeleteOutlined,
  CheckOutlined,
  StopOutlined,
} from '@ant-design/icons';

const PREFIXES_TITLE = [
  'Предложение обмена -',
  'Предложение на торговой площадке -',
];
const PREFIXES_SENDING = [
  'Предмет, который вы отдадите:',
  'Продается за',
];

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
      message.success('Аккаунт отключён');
    } catch (error) {
      console.error(error);
      message.error('Ошибка при отключении');
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

  const handleRespondToOffer = async (confirmationId, accept) => {
    try {
      const res = await fetch('http://localhost:3001/api/respond-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: account.id, confirmationId, accept }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        message.error(`Не удалось ${accept ? 'принять' : 'отменить'}`);
        return;
      }
      await fetchConfirmations(account.id);
    } catch (err) {
      console.error('Ошибка сети:', err);
      message.error('Сетевая ошибка');
    }
  };

  if (!account) return null;
  const isDisabled = account.status === 'Отключен';

  const stripPrefix = (text, prefixes) => {
    let result = text;
    prefixes.forEach(prefix => {
      const re = new RegExp(`^\\s*${prefix}\\s*`, 'i');
      result = result.replace(re, '');
    });
    return result;
  };

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
          <Tooltip title={isDisabled ? 'Включить аккаунт' : 'Отключить аккаунт'}>
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
        <strong>Ожидают подтверждения:</strong>
        {loadingConfirmations ? (
          <Skeleton active paragraph={{ rows: 3 }} />
        ) : pendingOffers.length === 0 ? (
          <Empty description="Нет ожидающих подтверждения/отклонения" />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16, marginTop: 12 }}>
            {pendingOffers.map((offer) => {
              const cleanTitle = stripPrefix(offer.title, PREFIXES_TITLE);
              const cleanSending = stripPrefix(stripPrefix(offer.sending, PREFIXES_SENDING), []);
              return (
                <Card key={offer.id} size="small" style={{ backgroundColor: '#f5f5f5' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
                    <Avatar size={48} shape="square" src={offer.icon} />
                    <div>
                      <div><strong>{cleanTitle}</strong></div>
                      <div>{cleanSending}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Button
                      style={{ flex: 1, backgroundColor: '#4caf50', borderColor: '#4caf50', color: '#fff' }}
                      size="large"
                      icon={<CheckOutlined />}
                      onClick={() => handleRespondToOffer(offer.id, true)}
                    />
                    <Button
                      style={{ flex: 1, backgroundColor: '#ff4d4f', borderColor: '#ff4d4f', color: '#fff' }}
                      size="large"
                      icon={<StopOutlined />}
                      onClick={() => handleRespondToOffer(offer.id, false)}
                    />
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}