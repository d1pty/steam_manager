import React, { useState, useEffect, useRef } from 'react';
import {
  Modal, Row, Col, Card, InputNumber, Button, Typography, Spin, message
} from 'antd';
import { CloseCircleOutlined, ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import PriceHistoryChart from './PriceHistoryChart';

const { Text } = Typography;
const FEE_RATE = 0.15;

const SelectedItemsModal = ({ visible, items, account, onRemoveItem, onClose, autoConfirm, statsEnabled }) => {
  const [selectedItem, setSelectedItem] = useState(null);
  const [marketPrices, setMarketPrices] = useState({});
  const [priceLoading, setPriceLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [priceHistory, setPriceHistory] = useState([]);
  const [sellerPrices, setSellerPrices] = useState({});
  const [listingPrices, setListingPrices] = useState({});
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc' или 'desc'
  const cancelRef = useRef(false);

  const handleClose = () => {
    cancelRef.current = true;
    onClose();
  };

  useEffect(() => {
    if (visible) {
      cancelRef.current = false;
    }
  }, [visible]);

  // Сортируем items по цене без комиссии
  const sortedItems = React.useMemo(() => {
    const itemsWithPrice = items.map(item => {
      const priceStr = marketPrices[item.id];
      let priceWithoutFee = 0;
      if (priceStr) {
        const match = priceStr.match(/[\d.,]+/);
        if (match) {
          const price = parseFloat(match[0].replace(',', '.'));
          priceWithoutFee = price / (1 + FEE_RATE);
        }
      }
      return { ...item, priceWithoutFee };
    });
    return itemsWithPrice.sort((a, b) =>
      sortOrder === 'asc' ? a.priceWithoutFee - b.priceWithoutFee : b.priceWithoutFee - a.priceWithoutFee
    );
  }, [items, marketPrices, sortOrder]);

  useEffect(() => {
    const first = sortedItems[0] || null;
    setSelectedItem(first);
    setMarketPrices(prev => prev); 
    setPriceHistory([]);
    setSellerPrices({});
    setListingPrices({});

    if (first) fetchHistoryFor(first);
    sortedItems.forEach(item => fetchPriceFor(item));
  }, [items, account.id, sortOrder]);

  useEffect(() => {
    if (!selectedItem) {
      onClose();
      return;
    }
    if (!marketPrices[selectedItem.id]?.match(/[\d.,]+/)) {
      fetchPriceFor(selectedItem);
    }
    fetchHistoryFor(selectedItem);
  }, [selectedItem]);

  const fetchPriceFor = async (item) => {
    setPriceLoading(true);
    try {
      const res = await fetch(
        `http://localhost:3001/api/inventory/${account.id}/price?` +
        `appId=${item.appId}&market_hash_name=${encodeURIComponent(item.market_hash_name)}`
      );
      const data = await res.json();
      const price = data?.price?.lowest_price;
      if (price && price.match(/[\d.,]+/)) {
        setMarketPrices(prev => ({ ...prev, [item.id]: price }));

        const priceWithFee = parseFloat(price.match(/[\d.,]+/)[0].replace(',', '.'));
        const seller = +(priceWithFee / (1 + FEE_RATE)).toFixed(2);
        setSellerPrices(prev => ({ ...prev, [item.id]: seller }));
        setListingPrices(prev => ({ ...prev, [item.id]: priceWithFee }));
      } else {
        setTimeout(() => fetchPriceFor(item), 5000);
      }
    } catch {
      message.error(`Ошибка при получении цены для ${item.name}`);
      setTimeout(() => fetchPriceFor(item), 5000);
    } finally {
      setPriceLoading(false);
    }
  };

  const fetchHistoryFor = async (item) => {
    setHistoryLoading(true);
    try {
      const res = await fetch(
        `http://localhost:3001/api/inventory/${account.id}/history?` +
        `appId=${item.appId}&market_hash_name=${encodeURIComponent(item.market_hash_name)}`
      );
      const data = await res.json();
      if (Array.isArray(data.history)) {
        setPriceHistory(data.history.map(({ t, y }) => ({ x: new Date(t), y })));
      } else {
        setPriceHistory([]);
        message.warning('Нет данных истории');
      }
    } catch {
      message.error('Ошибка загрузки истории');
    } finally {
      setHistoryLoading(false);
    }
  };

  const handlequickList = async (item, priceOverride) => {
    if (!selectedItem) return;
    try {
      const res = await fetch('http://localhost:3001/api/list-item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: account.id,
          item,
          price: priceOverride,
          autoConfirm,
          statsEnabled
        })
      });
      if (!res.ok) throw new Error();
      message.success('Лот выставлен');
      onRemoveItem(selectedItem.id);
      setSelectedItem(prev => {
        const nextIndex = sortedItems.findIndex(i => i.id === prev.id) + 1;
        return sortedItems[nextIndex] || null;
      });
    } catch {
      message.error('Ошибка при выставлении лота');
    }
  };

  // Подсчёт общего количества и суммы без комиссии
  const totalCount = items.length;

  const totalWithoutFee = items.reduce((sum, item) => {
    const priceStr = marketPrices[item.id];
    if (!priceStr) return sum;
    const match = priceStr.match(/[\d.,]+/);
    if (!match) return sum;
    const price = parseFloat(match[0].replace(',', '.'));
    const priceWithoutFee = price / (1 + FEE_RATE);
    return sum + priceWithoutFee;
  }, 0);

  return (
    <Modal
      open={visible}
      onCancel={handleClose}
      footer={null}
      width={900}
      style={{ body: { padding: 20 } }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
          gap: 16,
          flexWrap: 'wrap'
        }}
      >
        <Button
          size="small"
          type="text"
          onClick={() => setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'))}
          style={{ display: 'flex', alignItems: 'center', gap: 4 }}
        >
          Сортировать {sortOrder === 'asc' ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
        </Button>
        <Text type="secondary">Цена: {(totalWithoutFee * (1 + FEE_RATE)).toFixed(2)} ₽</Text>
        <Text type="secondary">Без комиссии: {totalWithoutFee.toFixed(2)} ₽</Text>
        <div style={{ marginRight: 48 }}>
          <Text strong>Всего предметов: {totalCount}</Text>
        </div>
      </div>
      <Row gutter={0}>
        <Col
          span={6}
          style={{
            maxWidth: '18vh',
            overflowY: 'auto',
            padding: '0 16px 16px',
            paddingTop: 0,
            borderRight: '1px solid #f0f0f0',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center'
          }}
        >
          <Button
            type="primary"
            size="small"
            block
            style={{
              backgroundColor: '#52c41a',
              borderColor: '#52c41a',
              marginBottom: '12px'
            }}
            onClick={async () => {
              for (const item of sortedItems) {
                if (cancelRef.current) break;

                const marketPriceStr = marketPrices[item.id];
                if (!marketPriceStr) {
                  message.warning(`Не найдена рыночная цена для ${item.name}`);
                  continue;
                }

                const match = marketPriceStr.match(/[\d.,]+/);
                if (!match) {
                  message.warning(`Не удалось разобрать цену для ${item.name}`);
                  continue;
                }

                const priceWithFee = parseFloat(match[0].replace(',', '.'));
                const sellerPrice = +(priceWithFee / (1 + FEE_RATE)).toFixed(2);

                await handlequickList(item, sellerPrice);
                onRemoveItem(item.id);
                await new Promise(r => setTimeout(r, 1000));
              }

              setSelectedItem(null);
            }}
          >
            Быстрая продажа
          </Button>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
            {sortedItems.map(item => (
              <div
                key={item.id}
                onClick={() => setSelectedItem(item)}
                style={{
                  cursor: 'pointer',
                  position: 'relative',
                  width: 80,
                  height: 80,
                  borderRadius: 4,
                  overflow: 'hidden',
                  background: selectedItem?.id === item.id ? '#e6f7ff' : '#fff',
                  border: selectedItem?.id === item.id ? '2px solid #1890ff' : '1px solid #f0f0f0',
                }}
              >
                <CloseCircleOutlined
                  onClick={e => { e.stopPropagation(); onRemoveItem(item.id); }}
                  style={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    fontSize: 14,
                    color: 'rgba(255,255,255,0.85)',
                    background: 'rgba(0,0,0,0.45)',
                    borderRadius: '50%',
                    zIndex: 2,
                  }}
                />
                <img
                  src={`https://steamcommunity-a.akamaihd.net/economy/image/${item.icon_url}`}
                  alt={item.name}
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
                <div
                  style={{
                    position: 'absolute', bottom: 0, left: 0, width: '100%', padding: '2px 4px',
                    fontSize: 12, textAlign: 'center',
                    background: marketPrices[item.id] ? 'rgba(0,0,0,0.5)' : 'transparent',
                    color: '#fff',
                  }}
                >{marketPrices[item.id] ?? ''}</div>
              </div>
            ))}
          </div>
        </Col>

        <Col span={18} style={{ padding: 24 }}>
          {selectedItem && (
            <Card style={{ borderRadius: 8 }}>
              <Text strong style={{ fontSize: 16 }}>{selectedItem.name}</Text>
              <div style={{ textAlign: 'center', margin: '16px 0' }}>
                <img
                  src={`https://steamcommunity-a.akamaihd.net/economy/image/${selectedItem.icon_url}`}
                  alt={selectedItem.name}
                  style={{ maxWidth: '100%', maxHeight: 200, objectFit: 'contain' }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                {priceLoading ? <Spin /> : marketPrices[selectedItem.id]
                  ? <Text>Текущая цена: {marketPrices[selectedItem.id]}</Text>
                  : <Text type="secondary">Цена не загружена</Text>
                }
              </div>
              <div style={{ marginTop: 32 }}>
                <Text strong>История цен:</Text>
                <PriceHistoryChart data={priceHistory} loading={historyLoading} />
              </div>

              <Row gutter={16} style={{ marginBottom: 16 }}>
                <Col span={12}>
                  <Text type="secondary">Вы получите:</Text>
                  <InputNumber
                    min={0}
                    style={{ width: '100%' }}
                    placeholder="Сумма"
                    value={sellerPrices[selectedItem.id]}
                    onChange={val => {
                      const sell = val || 0;
                      setSellerPrices(prev => ({ ...prev, [selectedItem.id]: sell }));
                      setListingPrices(prev => ({
                        ...prev,
                        [selectedItem.id]: +(sell * (1 + FEE_RATE)).toFixed(2),
                      }));
                    }}
                  />
                </Col>
                <Col span={12}>
                  <Text type="secondary">Покупатель заплатит:</Text>
                  <InputNumber
                    min={0}
                    style={{ width: '100%' }}
                    placeholder="Цена"
                    value={listingPrices[selectedItem.id]}
                    onChange={val => {
                      const price = val || 0;
                      setListingPrices(prev => ({ ...prev, [selectedItem.id]: price }));
                      setSellerPrices(prev => ({
                        ...prev,
                        [selectedItem.id]: +(price / (1 + FEE_RATE)).toFixed(2),
                      }));
                    }}
                  />
                </Col>
              </Row>

              <Button
                type="primary"
                block
                onClick={() => {
                  handlequickList(selectedItem, sellerPrices[selectedItem.id]);
                }}
                disabled={listingPrices[selectedItem.id] == null}
              >
                Продать
              </Button>
            </Card>
          )}
        </Col>
      </Row>
    </Modal>
  );
};

export default SelectedItemsModal;
