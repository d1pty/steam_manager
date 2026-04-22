// components/SelectedItemsModal.jsx
import React from 'react';
import { Modal, Button, Typography } from 'antd';

const { Text } = Typography;

const SelectedItemsModal = ({ visible, items, onClose }) => {
  return (
    <Modal
      open={visible}
      title="Выбранные предметы"
      onCancel={onClose}
      footer={[
        <Button key="close" onClick={onClose}>Закрыть</Button>
      ]}
    >
      {items.length > 0 ? (
        <ul>
          {items.map((item, index) => (
            <li key={index}>{item.name || item}</li>
          ))}
        </ul>
      ) : (
        <Text type="secondary">Нет выбранных предметов</Text>
      )}
    </Modal>
  );
};

export default SelectedItemsModal;
