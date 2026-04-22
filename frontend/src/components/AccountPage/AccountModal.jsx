import React, { useEffect, useState, useCallback } from 'react';
import {
  Modal,
  Button,
  Avatar,
  Tag,
  Tooltip,
  message,
  Progress,
} from 'antd';
import {
  UserOutlined,
  PoweroffOutlined,
  ReloadOutlined,
  DeleteOutlined,
  CloseOutlined,
  CheckOutlined,
  StopOutlined,
} from '@ant-design/icons';

const AccountModal = ({ visible, account, onClose, onDelete }) => {
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [secondsRemaining, setSecondsRemaining] = useState(null);
  const [pendingOffers, setPendingOffers] = useState([]);

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
    try {
      const response = await fetch(`http://localhost:3001/api/pending-confirmations?accountId=${accountId}`);
      const data = await response.json();
      setPendingOffers(data.confirmations || []);
    } catch (error) {
      console.error('Ошибка при загрузке подтверждений:', error);
    }
  }, []);

  useEffect(() => {
    if (!account?.id) return;
    fetchConfirmations(account.id);
  }, [account, fetchConfirmations]);

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
        message.error(`Не удалось ${accept ? 'принять' : 'отменить'} оффер`);
        return;
      }

      message.success(`Оффер ${accept ? 'принят' : 'отменён'}`);
      await fetchConfirmations(account.id);
    } catch (err) {
      console.error('Ошибка сети:', err);
      message.error('Сетевая ошибка');
    }
  };

  if (!account) return null;

  const isDisabled = account.status === 'Отключен';

  return (
    <Modal
      open={visible}
      title="Информация об аккаунте"
      onCancel={onClose}
      footer={[
        isDisabled ? (
          <Tooltip title="Включить аккаунт" key="enable">
            <Button
              type="primary"
              icon={<ReloadOutlined />}
              onClick={handleEnable}
            >
              Включить
            </Button>
          </Tooltip>
        ) : (
          <Tooltip title="Отключить аккаунт" key="disable">
            <Button
              type="primary"
              icon={<PoweroffOutlined />}
              danger
              onClick={handleDisable}
            >
              Выключить
            </Button>
          </Tooltip>
        ),
        <Tooltip title="Удалить аккаунт" key="delete">
          <Button
            type="primary"
            icon={<DeleteOutlined />}
            danger
            onClick={() => onDelete(account.id)}
          >
            Удалить
          </Button>
        </Tooltip>,
        <Button key="close" icon={<CloseOutlined />} onClick={onClose}>
          Закрыть
        </Button>,
      ]}
    >
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <Avatar
          size={64}
          src={account.avatar || 'http://localhost:3001/images/defaultAvatar.jpg'}
          icon={<UserOutlined />}
        />
        <div style={{ marginLeft: 16 }}>
          <strong>{account.username}</strong>
          <div>
            <Tag
              color={
                account.status === 'Вход выполнен'
                  ? 'green'
                  : account.status === 'Отключен'
                    ? 'volcano'
                    : 'red'
              }
            >
              {account.status}
            </Tag>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <strong>Текущий 2FA код:</strong>
        <div
          onClick={handleCopy2FACode}
          style={{
            cursor: 'pointer',
            fontSize: 16,
            padding: '8px',
            backgroundColor: '#f0f0f0',
            borderRadius: '4px',
            textAlign: 'center',
            marginTop: 4,
          }}
        >
          {twoFactorCode || 'Загрузка...'}
        </div>

        {secondsRemaining !== null && (
          <div style={{ marginTop: 10 }}>
            <Progress
              percent={(secondsRemaining / 30) * 100}
              status="active"
              showInfo={false}
              strokeColor="#52c41a"
            />
            <div style={{ textAlign: 'center', fontSize: 12, marginTop: 5 }}>
              Обновление через {Number(secondsRemaining).toFixed(1)} сек.
            </div>
          </div>
        )}
      </div>

      <div style={{ marginTop: 24 }}>
        <strong>Ожидают подтверждения:</strong>
        {pendingOffers.length === 0 ? (
          <div style={{ marginTop: 8, fontStyle: 'italic' }}>
            Нет ожидающих подтверждения офферов
          </div>
        ) : (
          pendingOffers.map(offer => (
            <div
              key={offer.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                marginTop: 12,
                padding: 8,
                border: '1px solid #f0f0f0',
                borderRadius: 4,
                gap: 12,
              }}
            >
              <Avatar shape="square" size={48} src={offer.icon} />

              <div style={{ flex: 1 }}>
                <div><strong>{offer.title}</strong></div>
                <div><strong>{offer.sending}</strong></div>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <Button
                  type="primary"
                  size="small"
                  icon={<CheckOutlined />}
                  onClick={() => handleRespondToOffer(offer.id, true)}
                >
                  Принять
                </Button>
                <Button
                  type="default"
                  size="small"
                  danger
                  icon={<StopOutlined />}
                  onClick={() => handleRespondToOffer(offer.id, false)}
                >
                  Отменить
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </Modal>
  );
};

export default AccountModal;
