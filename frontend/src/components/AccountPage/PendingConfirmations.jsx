import React, { useCallback, useEffect } from 'react';
import { Card, Avatar, Button, Empty, Skeleton, message } from 'antd';
import { CheckOutlined, StopOutlined } from '@ant-design/icons';

const PREFIXES_TITLE = [
    'Предложение обмена -',
    'Market Listing - ',
];
const PREFIXES_SENDING = [
    'Предмет, который вы отдадите:',
    'Selling for',
];

function stripPrefix(text, prefixes) {
    let result = text;
    prefixes.forEach((prefix) => {
        const re = new RegExp(`^\\s*${prefix}\\s*`, 'i');
        result = result.replace(re, '');
    });
    return result;
}

export default function PendingConfirmations({
    accountId,
    fetchConfirmations,
    pendingOffers,
    loadingConfirmations,
}) {
    // Fetch list on mount or account change
    useEffect(() => {
        if (accountId) fetchConfirmations(accountId);
    }, [accountId, fetchConfirmations]);

    // Handle single offer response
    const handleRespondToOffer = async (confirmationId, accept) => {
        try {
            const res = await fetch('http://localhost:3001/api/respond-confirmation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ accountId, confirmationId, accept }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                message.error(`Не удалось ${accept ? 'принять' : 'отменить'}`);
                return;
            }
            await fetchConfirmations(accountId);
        } catch (err) {
            console.error('Ошибка сети:', err);
            message.error('Сетевая ошибка');
        }
    };

    // Handle bulk accept/reject
    const handleBulkResponse = async (accept) => {
        if (!pendingOffers.length) return;
        for (const offer of pendingOffers) {
            // eslint-disable-next-line no-await-in-loop
            await handleRespondToOffer(offer.id, accept);
        }
    };

    if (loadingConfirmations) {
        return <Skeleton active paragraph={{ rows: 3 }} />;
    }

    if (!pendingOffers.length) {
        return <Empty description="Нет ожидающих подтверждения/отклонения" />;
    }

    return (
        <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
                <strong>Ожидают подтверждения:</strong>
                <div style={{ display: 'flex', gap: 8 }}>
                    <Button
                        style={{ backgroundColor: '#ff4d4f', borderColor: '#ff4d4f', color: '#fff' }}
                        size="small"
                        onClick={() => handleBulkResponse(false)}
                    >Отклонить всё</Button>
                    <Button
                        style={{ backgroundColor: '#4caf50', borderColor: '#4caf50', color: '#fff' }}
                        size="small"
                        onClick={() => handleBulkResponse(true)}
                    >Принять всё</Button>
                </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16, marginTop: 8 }}>
                {pendingOffers.map((offer) => {
                    const cleanTitle = stripPrefix(offer.title, PREFIXES_TITLE);
                    const cleanSending = stripPrefix(stripPrefix(offer.sending, PREFIXES_SENDING), []);
                    return (
                        <Card key={offer.id} size="small" style={{ backgroundColor: '#f5f5f5' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
                                <Avatar size={48} shape="square" src={offer.icon} />
                                <div>
                                    <div><strong>{cleanTitle}</strong></div>
                                    <div>{cleanSending}</div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <Button
                                    style={{ flex: 1, backgroundColor: '#ff4d4f', borderColor: '#ff4d4f', color: '#fff' }}
                                    size="large"
                                    icon={<StopOutlined />}
                                    onClick={() => handleRespondToOffer(offer.id, false)}
                                />
                                <Button
                                    style={{ flex: 1, backgroundColor: '#4caf50', borderColor: '#4caf50', color: '#fff' }}
                                    size="large"
                                    icon={<CheckOutlined />}
                                    onClick={() => handleRespondToOffer(offer.id, true)}
                                />
                            </div>
                        </Card>
                    );
                })}
            </div>
        </>
    );
}
