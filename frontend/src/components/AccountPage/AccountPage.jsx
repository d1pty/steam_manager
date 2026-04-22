import React, { useState } from 'react';
import { Row, Col, Button, Space, Typography } from 'antd';
import { UploadOutlined, DownloadOutlined } from '@ant-design/icons';
import AccountCard from './AccountCard';
import AddAccountForm from './AddAccountForm';
import AccountModal from './AccountModal';
import ImportAccountsModal from './ImportAccountsModal';

const { Text } = Typography;

const AccountPage = ({ accounts, setAccounts }) => {
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [importModalVisible, setImportModalVisible] = useState(false);

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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId }),
      });

      if (response.ok) {
        setAccounts(prevAccounts => prevAccounts.filter(acc => acc.id !== accountId));
        if (selectedAccount?.id === accountId) {
          setSelectedAccount(null);
        }
      } else {
        console.error('Ошибка при удалении аккаунта');
      }
    } catch (error) {
      console.error('Ошибка при запросе на сервер:', error);
    }

    handleCloseModal();
  };

  const handleExport = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/export-accounts', {
        method: 'GET',
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'accounts.zip');
        document.body.appendChild(link);
        link.click();
        link.remove();
      } else {
        console.error('Ошибка при экспорте аккаунтов');
      }
    } catch (error) {
      console.error('Ошибка при запросе на сервер:', error);
    }
  };

  const openImportModal = () => {
    setImportModalVisible(true);
  };

  const closeImportModal = () => {
    setImportModalVisible(false);
  };

  const refreshAccounts = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/get-accounts');
      if (response.ok) {
        const data = await response.json();
        setAccounts(data.accounts);
      }
    } catch (error) {
      console.error('Ошибка при обновлении аккаунтов:', error);
    }
  };

  return (
    <>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <AddAccountForm />
        </Col>

        <Col>
          <Space>
            <Text strong>Всего аккаунтов: {accounts.length}</Text>
            <Button icon={<DownloadOutlined />} onClick={handleExport}>
              Экспорт
            </Button>
            <Button type="primary" icon={<UploadOutlined />} onClick={openImportModal}>
              Импорт
            </Button>
          </Space>
        </Col>
      </Row>

      <ImportAccountsModal
        visible={importModalVisible}
        onClose={closeImportModal}
        refreshAccounts={refreshAccounts}
      />

      <Row gutter={[16, 16]}>
        {accounts
          .filter(account => account && account.id && account.username)
          .map(account => (
            <AccountCard
              key={account.id}
              account={account}
              onClick={() => handleAccountClick(account)}
            />
          ))}
      </Row>

      <AccountModal
        visible={!!selectedAccount}
        account={accounts.find(a => a.id === selectedAccount?.id)}
        onClose={handleCloseModal}
        onDelete={handleDeleteAccount}
      />
    </>
  );
};

export default AccountPage;
