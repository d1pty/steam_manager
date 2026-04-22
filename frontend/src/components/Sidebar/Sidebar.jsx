import React from 'react';
import { Layout, Menu } from 'antd';
import { UserOutlined, SwapOutlined, BarChartOutlined } from '@ant-design/icons';

const { Sider } = Layout;

const Sidebar = ({ selectedTab, onTabChange, selectedStatus, onStatusChange }) => {
  const tabItems = [
    {
      key: 'accounts',
      icon: <UserOutlined />,
      label: 'Аккаунты',
    },
    {
      key: 'trade',
      icon: <SwapOutlined />,
      label: 'Трейд',
    },
    {
      key: 'stats',
      icon: <BarChartOutlined />,
      label: 'Статистика',
    },
  ];

  const statusItems = [
    {
      key: 'online',
      label: 'Онлайн',
    },
    {
      key: 'offline',
      label: 'Оффлайн',
    },
    {
      key: 'all',
      label: 'Все',
    },
  ];

  return (
    <Sider
      width={200}
      style={{
        background: '#fff',
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        position: 'sticky',
        top: 0,
      }}
    >
      <Menu
        mode="inline"
        selectedKeys={[selectedTab]}
        onClick={(e) => onTabChange(e.key)}
        items={tabItems}
        style={{ flex: 1, overflowY: 'auto', borderRight: 0 }}
      />

      <Menu
        mode="inline"
        selectedKeys={[selectedStatus]}
        onClick={(e) => onStatusChange(e.key)}
        items={statusItems}
        style={{ borderTop: '1px solid #f0f0f0' }}
      />
    </Sider>
  );
};

export default Sidebar;
