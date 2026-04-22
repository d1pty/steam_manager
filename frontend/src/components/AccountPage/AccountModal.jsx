import React, { useEffect, useState } from 'react';
import { Modal, Button, Avatar, Tag, Tooltip, message, Progress } from 'antd';
import {
  UserOutlined,
  PoweroffOutlined,
  ReloadOutlined,
  DeleteOutlined,
  CloseOutlined,
} from '@ant-design/icons';

const AccountModal = ({ visible, account, onClose, onDelete }) => {
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [secondsRemaining, setSecondsRemaining] = useState(null);

  const fetchTwoFactorCode = async (accountId) => {
    if (!accountId) {
      console.error('Нет valid accountId. Запрос не будет отправлен.');
      return; // Прерываем выполнение, если accountId пустой или undefined
    }
    try {
      const response = await fetch(`http://localhost:3001/api/get-2fa-code?accountId=${accountId}`);
      const data = await response.json();
      if (data.twoFactorCode && data.timeRemaining !== undefined) {
        setTwoFactorCode(data.twoFactorCode);
        setSecondsRemaining(data.timeRemaining);
      }
    } catch (error) {
      console.error('Ошибка при получении 2FA кода:', error);
    }
  };

  useEffect(() => {
    if (!account || !account.id) return; // Добавляем проверку для отсутствующего account или account.id
  
    const updateState = () => {
      const now = Date.now();
      const seconds = 30 - Math.floor(now / 1000) % 30;
      const fractional = 1 - (now % 1000) / 1000;
      setSecondsRemaining((seconds - 1 + fractional).toFixed(1));
    };
  
    const fetchAndSync = async () => {
      if (account.id) {
        await fetchTwoFactorCode(account.id); // Отправляем запрос только если account.id существует
        updateState();
      }
    };
  
    fetchAndSync(); // первая загрузка кода
  
    const intervalId = setInterval(() => {
      const now = Date.now();
      const seconds = 30 - Math.floor(now / 1000) % 30;
      const fractional = 1 - (now % 1000) / 1000;
      setSecondsRemaining((seconds - 1 + fractional).toFixed(1));
  
      if (seconds === 30 && account?.id) {
        fetchTwoFactorCode(account.id); // Также проверяем перед запросом
      }
    }, 100); // каждые 100 мс — для плавности
  
    return () => clearInterval(intervalId);
  }, [account, visible]); // Возобновляем выполнение, только если account и его id существуют

  const handleDisable = async () => {
    try {
      await fetch('http://localhost:3001/api/disable-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: account.id }),
      });
    } catch (error) {
      console.error('Ошибка при отключении аккаунта:', error);
    }
  };

  const handleEnable = async () => {
    try {
      await fetch('http://localhost:3001/api/enable-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: account.id }),
      });
    } catch (error) {
      console.error('Ошибка при включении аккаунта:', error);
    }
  };

  const handleCopy2FACode = () => {
    navigator.clipboard.writeText(twoFactorCode)
      .then(() => message.success('2FA код скопирован в буфер обмена'))
      .catch(() => message.error('Ошибка при копировании 2FA кода'));
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
        </Button>
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
        <strong>Текущий 2FA код: </strong>
        <div
          onClick={handleCopy2FACode}
          style={{
            cursor: 'pointer',
            fontSize: 16,
            padding: '8px',
            backgroundColor: '#f0f0f0',
            borderRadius: '4px',
            display: 'inline-block',
            width: '100%',
            textAlign: 'center',
          }}
        >
          {twoFactorCode || 'Загрузка...'}
        </div>

        <div style={{ marginTop: 10 }}>
          {secondsRemaining !== null && (
            <>
              <Progress
                percent={(secondsRemaining / 30) * 100}
                status="active"
                showInfo={false}
                strokeColor="#52c41a"
              />
              <div style={{ textAlign: 'center', fontSize: 12, marginTop: 5 }}>
                Обновление через {Number(secondsRemaining).toFixed(1)} сек.
              </div>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default AccountModal;
