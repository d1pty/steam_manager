import React, { useState } from 'react';
import { Row, Typography } from 'antd';
import TradeCard from '../TradePage/TradeCard';
import AccountInventory from './AccountInventory';

const { Title } = Typography;

const MarketPage = ({ accounts }) => {
  const [selectedAccount, setSelectedAccount] = useState(null);

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

  return (
    <AccountInventory
      account={selectedAccount}
      onBack={() => setSelectedAccount(null)}
    />
  );
};

export default MarketPage;
