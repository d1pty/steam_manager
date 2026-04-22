import React, { useState } from 'react';
import { Form, Input, Button, Upload, message, Modal } from 'antd';
import { UploadOutlined, PlusOutlined } from '@ant-design/icons';

const AddAccountForm = ({ onSuccess }) => {
    const [form] = Form.useForm();
    const [mafileContent, setMafileContent] = useState(null);
    const [fileList, setFileList] = useState([]);
    const [modalVisible, setModalVisible] = useState(false);

    // Обработка загрузки файла
    const handleFileChange = (file) => {
        const reader = new FileReader();
        reader.onload = e => {
            setMafileContent(e.target.result);
            message.success('maFile загружен!');
        };
        reader.readAsText(file);
        setFileList([file]);
        return false; // не загружаем файл на сервер
    };

    // Удаление файла
    const handleRemove = () => {
        setMafileContent(null);
        setFileList([]);
    };

    // Отправка формы
    const handleSubmit = async (values) => {
        if (!mafileContent) {
            message.error('Загрузите maFile');
            return;
        }

        const payload = {
            username: values.username,
            password: values.password,
            maFileContent: mafileContent,
        };

        try {
            const response = await fetch('http://localhost:3001/api/add-account', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const data = await response.json();

            if (response.ok) {
                message.success('Аккаунт добавлен!');
                form.resetFields();
                setMafileContent(null);
                setFileList([]);
                setModalVisible(false);
                if (onSuccess) onSuccess();
            } else {
                message.error(data.error || 'Ошибка при добавлении аккаунта');
            }
        } catch (err) {
            console.error(err);
            message.error('Ошибка подключения к серверу');
        }
    };

    return (
        <>
            <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                    setModalVisible(true);
                    setMafileContent(null);
                    setFileList([]);
                    form.resetFields();
                }}
                style={{ marginBottom: 16 }}
            >
                Добавить аккаунт
            </Button>

            <Modal
                title="Добавление аккаунта"
                open={modalVisible}
                onCancel={() => setModalVisible(false)}
                footer={null}
            >
                <Form form={form} layout="vertical" onFinish={handleSubmit}>
                    <Form.Item name="username" label="Логин" rules={[{ required: true }]}>
                        <Input />
                    </Form.Item>

                    <Form.Item name="password" label="Пароль" rules={[{ required: true }]}>
                        <Input.Password />
                    </Form.Item>

                    <Form.Item label="maFile (.maFile)">
                        <Upload
                            beforeUpload={handleFileChange}
                            accept=".maFile"
                            maxCount={1}
                            fileList={fileList}
                            onRemove={handleRemove}
                        >
                            <Button icon={<UploadOutlined />}>Загрузить maFile</Button>
                        </Upload>
                    </Form.Item>

                    <Form.Item>
                        <Button type="primary" htmlType="submit">
                            Добавить
                        </Button>
                    </Form.Item>
                </Form>
            </Modal>
        </>
    );
};

export default AddAccountForm;
