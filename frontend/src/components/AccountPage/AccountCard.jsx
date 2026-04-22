import React from 'react';
import { Card, Avatar, Tag } from 'antd';
import { UserOutlined } from '@ant-design/icons';

const AccountCard = ({ account, onClick }) => (
  <div style={{ width: '20%' }} onClick={onClick}>
    <Card hoverable style={{ width: '100%' }}>
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

export default AccountCard;
