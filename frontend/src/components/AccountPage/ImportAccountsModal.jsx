import React, { useState } from 'react';
import { Modal, Upload, Input, message, Form } from 'antd';
import { InboxOutlined } from '@ant-design/icons';

const { Dragger } = Upload;
const { TextArea } = Input;

const ImportAccountsModal = ({ visible, onClose }) => {
  const [fileList, setFileList] = useState([]);
  const [accsText, setAccsText] = useState('');

  const readFileContent = file =>
    new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.onerror = () => { message.error(`Не удалось прочитать файл: ${file.name}`); resolve(null); };
      reader.readAsText(file);
    });

  const handleUpload = () => {
    if (!accsText.trim() && fileList.length === 0) {
      message.error('Добавьте текстовые аккаунты или загрузите хотя бы один .maFile');
      return;
    }

    onClose && onClose();
    setAccsText('');
    setFileList([]);

    (async () => {
      const accounts = [];
      const maFiles = [];

      accsText.split('\n').forEach(line => {
        const [username, password] = line.trim().split(/[:; ]/); // разделитель может быть :, ; или пробел
        if (username && password) accounts.push({ username, password });
      });

      for (const file of fileList) {
        const content = await readFileContent(file.originFileObj);
        if (content !== null) maFiles.push(content);
      }

      try {
        const response = await fetch('http://localhost:3001/api/import-accounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accounts, maFiles }),
        });
        const result = await response.json();

        if (response.ok) {
          message.success('Импорт запущен.');
        } else {
          message.error(result.error || 'Ошибка при импорте аккаунтов');
        }
      } catch (err) {
        console.error(err);
        message.error('Ошибка подключения к серверу');
      }
    })();
  };

  return (
    <Modal
      title="Импорт аккаунтов"
      open={visible}
      onCancel={onClose}
      onOk={handleUpload}
      okText="Импортировать"
      cancelText="Отмена"
    >
      <Form layout="vertical">
        <Form.Item label="Логины и пароли в формате login:password">
          <TextArea
            rows={5}
            placeholder="login1:password1
login2:password2"
            value={accsText}
            onChange={e => setAccsText(e.target.value)}
          />
        </Form.Item>

        <Form.Item label="Загрузить .maFile файлы">
          <Dragger
            multiple
            fileList={fileList}
            customRequest={({ file, onSuccess }) => {
              setTimeout(() => onSuccess(null, file), 0);
            }}
            beforeUpload={file => {
              const ok = file.name.toLowerCase().endsWith('.mafile');
              if (!ok) {
                message.error('Можно загружать только .maFile');
                return Upload.LIST_IGNORE;
              }
              return true;
            }}
            onChange={({ fileList: newList }) => setFileList(newList)}
            accept=".maFile"
          >
            <p className="ant-upload-drag-icon"><InboxOutlined /></p>
            <p className="ant-upload-text">Перетащите .maFile или кликните</p>
          </Dragger>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default ImportAccountsModal;
