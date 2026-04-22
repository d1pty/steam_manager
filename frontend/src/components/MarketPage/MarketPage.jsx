// components/MarketPage/MarketPage.jsx
import React, { useState, useEffect } from 'react';
import { Tabs, Row, Col, Card, InputNumber, Button, Typography, Spin, message } from 'antd';
import TradeCard from '../TradePage/TradeCard';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

// Конфигурации инвентарей
const inventoryConfigs = {
  csgo: { appId: 730, contextId: 2, label: 'CS:GO' },
  dota2: { appId: 570, contextId: 2, label: 'Dota 2' },
  steam: { appId: 753, contextId: 6, label: 'Steam Items' }
};

const MarketPage = ({ accounts }) => {
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [tab, setTab] = useState('csgo');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [listingPrices, setListingPrices] = useState({});

  // Fetch inventory via fetch
  const fetchInventory = async (inventoryKey, botId) => {
    setLoading(true);
    const { appId, contextId } = inventoryConfigs[inventoryKey];
    try {
      const url = `http://localhost:3001/api/inventory/${botId}?appId=${appId}&contextId=${contextId}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch inventory');
      const data = await response.json();
      setItems(data.items || []);
    } catch (err) {
      console.error(err);
      message.error('Не удалось загрузить инвентарь');
    } finally {
      setLoading(false);
    }
  };

  // Handle listing an item
  const handleListItem = async (item) => {
    try {
      const response = await fetch('http://localhost:3001/api/list-item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: selectedAccount.id,
          item,
          price: listingPrices[item.assetid] || 0
        })
      });
      if (!response.ok) throw new Error('Failed to list item');
      message.success('Лот выставлен на продажу');
    } catch (err) {
      console.error(err);
      message.error('Ошибка при выставлении лота');
    }
  };

  // On account select or tab change, reload inventory
  useEffect(() => {
    if (selectedAccount) {
      fetchInventory(tab, selectedAccount.id);
    }
  }, [selectedAccount, tab]);

  // If no account selected, show account list
  if (!selectedAccount) {
    return (
      <>
        <Title level={3}>Выберите аккаунт для торговли</Title>
        <Row gutter={[16, 16]} wrap>
          {accounts.map(acc => (
            <TradeCard
              key={acc.id}
              account={acc}
              selected={false}
              onSelect={() => setSelectedAccount(acc)}
            />
          ))}
        </Row>
      </>
    );
  }

  // Otherwise show inventory tabs and items
  return (
    <>
      <Button onClick={() => setSelectedAccount(null)} style={{ marginBottom: 16 }}>
        ← Назад к списку аккаунтов
      </Button>

      <Title level={4} style={{ marginBottom: 8 }}>
        Инвентарь: {selectedAccount.username || selectedAccount.id}
      </Title>

      <Tabs activeKey={tab} onChange={setTab} style={{ marginBottom: 16 }}>
        {Object.entries(inventoryConfigs).map(([key, cfg]) => (
          <TabPane tab={cfg.label} key={key} />
        ))}
      </Tabs>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}><Spin size="large" /></div>
      ) : (
        <Row gutter={[24, 24]}>
          {items.map(item => {
            const iconUrl = item.icon_url
              ? `https://steamcommunity-a.akamaihd.net/economy/image/${item.icon_url}`
              : null;
            return (
              <Col key={item.assetid} xs={24} sm={12} md={8} lg={6} xl={4}>
                <Card
                  hoverable
                  style={{
                    borderRadius: 8,
                    overflow: 'hidden',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%'
                  }}
                >
                  <div style={{ flex: 'auto', textAlign: 'center', padding: 8 }}>
                    <img
                      src={iconUrl}
                      alt={item.name}
                      style={{ maxWidth: '100%', maxHeight: 200, objectFit: 'contain' }}
                      onError={e => { e.currentTarget.src = 'https://via.placeholder.com/224x261?text=No+Image'; }}
                    />
                  </div>
                  <div style={{ padding: '0 12px 12px' }}>
                    <Text strong ellipsis={{ tooltip: item.name }}>{item.name}</Text>
                    <div style={{ marginTop: 4, marginBottom: 8 }}>
                      <Text type="secondary">Цена: —</Text>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <InputNumber
                        min={0}
                        placeholder="Укажите цену"
                        style={{ flex: 1 }}
                        value={listingPrices[item.assetid]}
                        onChange={value => setListingPrices(prev => ({ ...prev, [item.assetid]: value }))}
                      />
                      <Button
                        type="primary"
                        onClick={() => handleListItem(item)}
                        disabled={listingPrices[item.assetid] == null}
                      >
                        Продать
                      </Button>
                    </div>
                  </div>
                </Card>
              </Col>
            );
          })}
        </Row>
      )}
    </>
  );
};

export default MarketPage;