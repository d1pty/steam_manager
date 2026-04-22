import React, { useState } from 'react';
import { Row } from 'antd';
import AccountCard from './AccountCard';
import AddAccountForm from './AddAccountForm';
import AccountModal from './AccountModal';

const AccountPage = ({ accounts, setAccounts }) => {
  const [selectedAccount, setSelectedAccount] = useState(null);

  const handleAccountClick = (account) => {
    setSelectedAccount(account);
  };

  const handleCloseModal = () => {
    setSelectedAccount(null);
  };

  const handleDeleteAccount = async (accountId) => {
    try {
      const response = await fetch('http://localhost:3001/api/delete-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ accountId }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log(data.message);

        const updatedAccounts = Object.keys(data.accounts).map(key => ({
          id: key,
          ...data.accounts[key],
        }));

        setAccounts(updatedAccounts);
      } else {
        console.error('Ошибка при удалении аккаунта');
      }
    } catch (error) {
      console.error('Ошибка при запросе на сервер:', error);
    }

    handleCloseModal();
  };

  return (
    <>
      <AddAccountForm />

      <Row gutter={[16, 16]}>
        {accounts.map(account => (
          <AccountCard
            key={account.id}
            account={account}
            onClick={() => handleAccountClick(account)}
          />
        ))}
      </Row>

      <AccountModal
        visible={!!selectedAccount}
        account={accounts.find(a => a.id === selectedAccount?.id)} // всегда берем актуальные данные
        onClose={handleCloseModal}
        onDelete={handleDeleteAccount}
      />
    </>
  );
};

export default AccountPage;
