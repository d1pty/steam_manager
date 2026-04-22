import React from 'react';
import { Layout, Menu, Badge } from 'antd';
import {
  UserOutlined,
  SwapOutlined,
  BarChartOutlined,
  ShoppingCartOutlined,
  PoweroffOutlined,
  WifiOutlined,
  DisconnectOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';

const { Sider } = Layout;

const Sidebar = ({
  selectedTab,
  onTabChange,
  selectedStatus,
  onStatusChange,
  statusCounts = {},
}) => {
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
      key: 'market',
      icon: <ShoppingCartOutlined />,
      label: 'Торговля',
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
      icon: <WifiOutlined style={{ color: '#52c41a' }} />,
      text: 'В сети',
      count: statusCounts.online || 0,
    },
    {
      key: 'offline',
      icon: <DisconnectOutlined style={{ color: '#faad14' }} />,
      text: 'Не в сети',
      count: statusCounts.offline || 0,
    },
    {
      key: 'disabled',
      icon: <PoweroffOutlined style={{ color: '#f5222d' }} />,
      text: 'Выключен',
      count: statusCounts.disabled || 0,
    },
    {
      key: 'all',
      icon: <AppstoreOutlined />,
      text: 'Все',
      count: statusCounts.all || 0,
    },
  ];

  return (
    <Sider
      width={220}
      style={{
        background: '#fff',
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        position: 'sticky',
        top: 0,
        boxShadow: '2px 0 8px rgba(0, 0, 0, 0.1)',
      }}
    >
      <div style={{ flexGrow: 1 }}>
        <Menu
          mode="inline"
          selectedKeys={[selectedTab]}
          onClick={(e) => onTabChange(e.key)}
          items={tabItems}
          style={{ borderRight: 0 }}
        />
      </div>

      <div style={{ flexShrink: 0, paddingBottom: 12 }}>
        <Menu
          mode="inline"
          selectedKeys={[selectedStatus]}
          onClick={(e) => onStatusChange(e.key)}
          items={statusItems.map((item) => ({
            key: item.key,
            label: (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>
                  {item.icon}
                  <span style={{ marginLeft: 8 }}>{item.text}</span>
                </span>
                <Badge count={item.count} showZero style={{ backgroundColor: '#1890ff' }} />
              </div>
            ),
          }))}
          style={{ borderTop: '1px solid #f0f0f0' }}
        />
      </div>
    </Sider>
  );
};

export default Sidebar;
