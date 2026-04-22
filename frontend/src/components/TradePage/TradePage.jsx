import React, { useState } from 'react';
import { Row, Input, Button, Space, Typography } from 'antd';
import TradeCard from './TradeCard';

const { Link, Text } = Typography;

const TradePage = ({ accounts, onSendTrade }) => {
  const [selected, setSelected] = useState([]);
  const [link, setLink] = useState('');

  const toggleAccount = (id) => {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleSend = () => {
    onSendTrade({ link, selected });
  };

  const handleSelectAll = () => {
    if (selected.length === accounts.length) {
      setSelected([]); // снять выделение
    } else {
      setSelected(accounts.map(acc => acc.id)); // выбрать все
    }
  };

  return (
    <>
      <Space direction="vertical" style={{ width: '100%' }}>
        <Space style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Input
            placeholder="Введите ссылку на обмен"
            value={link}
            onChange={e => setLink(e.target.value)}
            style={{ flex: 1 }}
          />
          <Button type="primary" onClick={handleSend} disabled={!selected.length || !link}>
            Отправить предметы
          </Button>
        </Space>

        <Space style={{ justifyContent: 'space-between', width: '100%' }}>
          <Link
            href="https://steamcommunity.com/my/tradeoffers/privacy#trade_offer_access_url"
            target="_blank"
            rel="noopener noreferrer"
          >
            Получить трейд-ссылку
          </Link>

          <Space>
            <Text type="secondary">
              Выбрано: {selected.length} из {accounts.length}
            </Text>
            <Button onClick={handleSelectAll}>
              {selected.length === accounts.length ? 'Снять выделение' : 'Выбрать все'}
            </Button>
          </Space>
        </Space>
      </Space>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        {accounts.map(account => (
          <TradeCard
            key={account.id}
            account={account}
            selected={selected.includes(account.id)}
            onSelect={() => toggleAccount(account.id)}
          />
        ))}
      </Row>
    </>
  );
};

export default TradePage;
