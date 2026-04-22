import React from 'react';
import { Card, Avatar, Tag } from 'antd';
import { UserOutlined } from '@ant-design/icons';

const TradeCard = ({ account, selected, onSelect }) => (
  <div style={{ width: '20%' }}>
    <Card
      hoverable
      onClick={onSelect}
      style={{
        width: '100%',
        border: selected ? '2px solid #1890ff' : '1px solid #f0f0f0',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <Avatar
          size={32}
          src={
            <img
              src={account.avatar || 'http://localhost:3001/images/defaultAvatar.jpg'}
              alt="avatar"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          }
          icon={<UserOutlined />}
        />
        <div style={{ marginLeft: 16 }}>
          <strong>{account.username}</strong>
          <div>
            <Tag color={account.status === 'Вход выполнен' ? 'green' : 'red'}>
              {account.status}
            </Tag>
          </div>
        </div>
      </div>
    </Card>
  </div>
);

export default TradeCard;
