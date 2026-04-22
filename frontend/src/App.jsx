import React, { useEffect, useState } from 'react';
import { Layout } from 'antd';
import axios from 'axios';
import Sidebar from './components/Sidebar/Sidebar';
import AccountPage from './components/AccountPage/AccountPage';
import TradePage from './components/TradePage/TradePage';
import StatsPage from './components/StatsPage/StatsPage';

const { Content } = Layout;

const App = () => {
  const [accounts, setAccounts] = useState([]);
  const [selectedTab, setSelectedTab] = useState('accounts');
  const [selectedStatus, setSelectedStatus] = useState('all');

  useEffect(() => {
    const fetchData = async () => {
      const response = await axios.get('http://localhost:3001/api/status');
      const data = Object.keys(response.data).map(key => ({
        id: key,
        ...response.data[key],
      }));
      setAccounts(data);
    };

    fetchData();

    const ws = new WebSocket('ws://localhost:3001');
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      const updatedAccounts = Object.keys(data).map(key => ({
        id: key,
        ...data[key],
      }));
      setAccounts(updatedAccounts);
    };

    return () => {
      ws.close();
    };
  }, []);

  const filterAccounts = () => {
    if (selectedStatus === 'online') {
      return accounts.filter(a => a.status === 'Вход выполнен');
    }
    if (selectedStatus === 'offline') {
      return accounts.filter(a => a.status === 'Ожидание входа');
    }
    return accounts;
  };

  const handleSendTrade = async ({ link, selected }) => {
    try {
      await axios.post('http://localhost:3001/api/send-trade', {
        accounts: selected,
        tradeUrl: link,
      });
      alert('Отправка началась');
    } catch (error) {
      console.error('Ошибка при отправке предметов', error);
      alert('Ошибка при отправке');
    }
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sidebar
        selectedTab={selectedTab}
        onTabChange={setSelectedTab}
        selectedStatus={selectedStatus}
        onStatusChange={setSelectedStatus}
      />
      <Layout style={{ padding: '0 24px 24px' }}>
        <Content style={{ padding: 24, margin: 0, minHeight: 280 }}>
          {selectedTab === 'accounts' && (
            <AccountPage accounts={filterAccounts()} setAccounts={setAccounts} />
          )}
          {selectedTab === 'trade' && (
            <TradePage accounts={filterAccounts()} onSendTrade={handleSendTrade} />
          )}
          {selectedTab === 'stats' && (
            <StatsPage />
          )}
        </Content>
      </Layout>
    </Layout>
  );
};

export default App;
