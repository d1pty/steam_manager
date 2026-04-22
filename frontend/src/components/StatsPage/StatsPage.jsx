import React, { useEffect, useState } from 'react';
import { Card } from 'antd';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const StatsPage = () => {
  const [stats, setStats] = useState([]);

  useEffect(() => {
    fetch('http://localhost:3001/api/item-stats')
      .then(res => res.json())
      .then(data => setStats(data))
      .catch(err => console.error('Ошибка при загрузке статистики:', err));
  }, []);

  return (
    <Card title="Статистика по предметам">
      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={stats}>
          <XAxis dataKey="itemName" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="count" fill="#1890ff" />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
};

export default StatsPage;
