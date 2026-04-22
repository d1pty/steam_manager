// src/components/AccountInventory.jsx

import React, { useState, useEffect } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  TimeScale
} from 'chart.js';
import 'chartjs-adapter-date-fns';

import SelectedItemsModal from './SelectedItemsModal';
import {
  Tabs,
  Row,
  Col,
  Card,
  InputNumber,
  Button,
  Typography,
  Spin,
  message,
} from 'antd';

const { Title, Text } = Typography;

// Регистрируем Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  TimeScale,
  Tooltip,
  Legend
);

const AccountInventory = ({ account, onBack }) => {
  const [inventories, setInventories] = useState([]);
  const [tab, setTab] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const [listingPrices, setListingPrices] = useState({});
  const [marketPrices, setMarketPrices] = useState({});
  const [priceLoading, setPriceLoading] = useState(false);

  const [priceHistory, setPriceHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [selectedItem, setSelectedItem] = useState(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);

  // 1) Доступные инвентаря
  const fetchAvailableInventories = async () => {
    try {
      const res = await fetch(
        `http://localhost:3001/api/account/${account.id}/inventories`
      );
      if (!res.ok) throw new Error('Ошибка получения инвентарей');
      const data = await res.json();
      setInventories(data.inventories);
      if (data.inventories.length) setTab(data.inventories[0].key);
    } catch (err) {
      console.error(err);
      message.error('Не удалось загрузить инвентарии');
    }
  };

  // 2) Сам инвентарь
  const fetchInventory = async (inventoryKey) => {
    const config = inventories.find(i => i.key === inventoryKey);
    if (!config) return;

    setLoading(true);
    try {
      const url = `http://localhost:3001/api/inventory/${account.id}` +
        `?appId=${config.appId}&contextId=${config.contextId}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch inventory');
      const data = await response.json();
      setItems(data.items || []);
      setSelectedItem(null);
      setSelectedItems([]);
      setSelectionMode(false);
    } catch (err) {
      console.error(err);
      message.error('Не удалось загрузить инвентарь');
    } finally {
      setLoading(false);
    }
  };

  // 3) Текущая цена при выборе
  useEffect(() => {
    if (!selectedItem) return;
    const id = selectedItem.id;
    if (marketPrices[id] || priceLoading) return;
    const cfg = inventories.find(i => i.key === tab);
    if (!cfg) return;

    setPriceLoading(true);
    fetch(
      `http://localhost:3001/api/inventory/${account.id}/price?` +
      `appId=${cfg.appId}` +
      `&market_hash_name=${encodeURIComponent(selectedItem.market_hash_name)}`
    )
      .then(res => res.json())
      .then(data => {
        if (data.price?.lowest_price) {
          setMarketPrices(prev => ({ ...prev, [id]: data.price.lowest_price }));
        } else {
          message.warning('Не удалось получить цену');
        }
      })
      .catch(err => {
        console.error(err);
        message.error('Ошибка при получении цены');
      })
      .finally(() => setPriceLoading(false));
  }, [selectedItem, account.id, tab, inventories, marketPrices, priceLoading]);

  // 4) История цен при выборе — теперь body.history = [{ t, y }, …]
  useEffect(() => {
    if (!selectedItem) return;
    const cfg = inventories.find(i => i.key === tab);
    if (!cfg) return;

    setHistoryLoading(true);
    fetch(
      `http://localhost:3001/api/inventory/${account.id}/history?` +
      `appId=${cfg.appId}` +
      `&market_hash_name=${encodeURIComponent(selectedItem.market_hash_name)}`
    )
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data.history)) {
          const parsed = data.history
            .map(({ t, y }) => ({
              x: new Date(t),
              y
            }));
          setPriceHistory(parsed);
        } else {
          setPriceHistory([]);
          message.warning('Нет данных истории');
        }
      })
      .catch(err => {
        console.error(err);
        message.error('Ошибка загрузки истории');
      })
      .finally(() => setHistoryLoading(false));
  }, [selectedItem, account.id, tab, inventories]);

  useEffect(() => {
    fetchAvailableInventories();
  }, []);
  useEffect(() => {
    if (!tab) return;
    fetchInventory(tab);
  }, [tab, inventories]);

  const handleListItem = async (item) => {
    try {
      const response = await fetch('http://localhost:3001/api/list-item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: account.id,
          item,
          price: listingPrices[item.id] || 0
        })
      });
      if (!response.ok) throw new Error();
      message.success('Лот выставлен');
    } catch {
      message.error('Ошибка при выставлении лота');
    }
  };

  const toggleSelectItem = key => {
    setSelectedItems(prev =>
      prev.includes(key)
        ? prev.filter(k => k !== key)
        : [...prev, key]
    );
  };

  const handleToggleSelectAll = () => {
    setSelectionMode(true);
    setSelectedItems(items.map(i => i.id));
  };

  // Настройки графика
  const chartData = {
    datasets: [{
      label: 'Цена, ₽',
      data: priceHistory,
      fill: false,
      tension: 0.1,
    }]
  };
  const chartOptions = {
    scales: {
      x: {
        type: 'time',
        time: { unit: 'day', tooltipFormat: 'dd MMM yyyy' },
        title: { display: true, text: 'Дата' }
      },
      y: {
        beginAtZero: false,
        title: { display: true, text: 'Цена, ₽' }
      }
    },
    plugins: { legend: { display: false } }
  };

  return (
    <>
      <Button onClick={onBack} style={{ marginBottom: 16 }}>
        ← Назад к списку аккаунтов
      </Button>
      <Title level={4} style={{ marginBottom: 8 }}>
        Инвентарь: {account.username || account.id}
      </Title>

      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          {inventories.length > 0 ? (
            <Tabs
              activeKey={tab}
              onChange={setTab}
              items={inventories.map(({ key, label }) => ({ label, key }))}
            />
          ) : (
            <Text type="secondary">Нет доступных инвентарей</Text>
          )}
        </Col>
        <Col>
          {selectedItems.length > 0 && (
            <Button type="primary" onClick={() => setModalVisible(true)}>
              Продать выбранные
            </Button>
          )}
        </Col>
      </Row>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin size="large" />
        </div>
      ) : (
        <Row gutter={[24, 24]}>
          <Col span={18}>
            <Row gutter={[16, 16]}>
              {items.map(item => {
                const key = item.id;
                const isSel = selectedItems.includes(key);
                return (
                  <Col key={key} xs={6} sm={4} md={3}>
                    <Card
                      hoverable
                      onClick={() =>
                        selectionMode
                          ? toggleSelectItem(key)
                          : setSelectedItem(item)
                      }
                      style={{
                        padding: 4,
                        textAlign: 'center',
                        border: isSel ? '2px solid #1890ff' : undefined
                      }}
                    >
                      <img
                        src={`https://steamcommunity-a.akamaihd.net/economy/image/${item.icon_url}`}
                        alt={item.name}
                        style={{ width: '100%', maxHeight: 100, objectFit: 'contain' }}
                      />
                    </Card>
                  </Col>
                );
              })}
            </Row>
          </Col>

          <Col span={6}>
            <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
              {!selectionMode ? (
                <Button onClick={() => setSelectionMode(true)}>Выбрать</Button>
              ) : (
                <Button onClick={() => {
                  setSelectionMode(false);
                  setSelectedItems([]);
                }}>Отмена</Button>
              )}
              <Button onClick={handleToggleSelectAll}>Выбрать все</Button>
            </div>

            {!selectionMode && selectedItem && (
              <Card title={selectedItem.name} variant="outlined" style={{ borderRadius: 8 }}>
                <div style={{ textAlign: 'center', marginBottom: 16 }}>
                  <img
                    src={
                      selectedItem.icon_url
                        ? `https://steamcommunity-a.akamaihd.net/economy/image/${selectedItem.icon_url}`
                        : 'https://via.placeholder.com/224x261?text=No+Image'
                    }
                    alt={selectedItem.name}
                    style={{ maxWidth: '100%', maxHeight: 200, objectFit: 'contain' }}
                  />
                </div>

                <div style={{ marginBottom: 12 }}>
                  {priceLoading ? (
                    <Spin size="small" />
                  ) : marketPrices[selectedItem.id] ? (
                    <Text>Текущая цена: {marketPrices[selectedItem.id]}</Text>
                  ) : (
                    <Text type="secondary">Цена не загружена</Text>
                  )}
                </div>

                <Text type="secondary">Укажите свою цену:</Text>
                <InputNumber
                  min={0}
                  style={{ width: '100%', marginBottom: 12 }}
                  placeholder="Цена"
                  value={listingPrices[selectedItem.id]}
                  onChange={val =>
                    setListingPrices(prev => ({ ...prev, [selectedItem.id]: val }))
                  }
                />
                <Button
                  type="primary"
                  block
                  onClick={() => handleListItem(selectedItem)}
                  disabled={listingPrices[selectedItem.id] == null}
                >
                  Продать
                </Button>

                <div style={{ marginTop: 24 }}>
                  <Text strong>История цен:</Text>
                  {historyLoading ? (
                    <div style={{ textAlign: 'center', padding: 16 }}>
                      <Spin size="small" />
                    </div>
                  ) : priceHistory.length ? (
                    <Line data={chartData} options={chartOptions} />
                  ) : (
                    <Text type="secondary">График недоступен</Text>
                  )}
                </div>
              </Card>
            )}

            {selectionMode && selectedItems.length > 0 && (
              <Card title="Выбрано предметов" variant="outlined" style={{ borderRadius: 8 }}>
                <Text>Количество: {selectedItems.length}</Text>
              </Card>
            )}
          </Col>
        </Row>
      )}

      <SelectedItemsModal
        visible={modalVisible}
        items={selectedItems
          .map(key => items.find(item => item.id === key))
          .filter(Boolean)}
        onClose={() => setModalVisible(false)}
      />
    </>
  );
};

export default AccountInventory;
