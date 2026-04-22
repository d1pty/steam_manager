import React, { useEffect, useState } from 'react';
import { Card, Table, DatePicker, Button, Spin, Alert } from 'antd';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
} from 'recharts';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;
const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7f50', '#00C49F', '#FFBB28', '#0088FE', '#A020F0'];

const StatsPage = () => {
  const [data, setData] = useState([]);
  const [weeklyData, setWeeklyData] = useState([]);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [dateRange, setDateRange] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch item distribution
  useEffect(() => {
    const [startDate, endDate] = dateRange || [];
    let url = 'http://localhost:3001/api/item-distribution';
    if (startDate && endDate) {
      url += `?startDate=${startDate.format('YYYY-MM-DD')}&endDate=${endDate.format('YYYY-MM-DD')}`;
    }
    fetch(url)
      .then(res => res.json())
      .then(data => setData(data))
      .catch(err => console.error('Ошибка при загрузке статистики:', err));
  }, [dateRange]);

  // Fetch raw drops, compute weekly stats
  useEffect(() => {
    setLoading(true);
    fetch('http://localhost:3001/api/average-weekly-price')
      .then(res => res.json())
      .then(raw => {
        const parsed = raw.map(({ price, sent_at, item_name }) => ({
          price: parseFloat(price.toString().replace(',', '.').trim()),
          date: dayjs(sent_at),
          name: item_name,
        }));
        const revenue = parsed.reduce((sum, d) => sum + d.price, 0);
        setTotalRevenue(parseFloat(revenue.toFixed(2)));

        if (!parsed.length) return setWeeklyData([]);
        let maxDate = parsed[0].date;
        parsed.forEach(d => { if (d.date.isAfter(maxDate)) maxDate = d.date; });

        const firstWeekStart = dayjs('2025-01-08');
        const weeks = [];
        let start = firstWeekStart;
        while (start.isBefore(maxDate) || start.isSame(maxDate, 'day')) {
          const end = start.add(7, 'day');
          const inWeek = parsed.filter(d => (d.date.isSame(start) || d.date.isAfter(start)) && d.date.isBefore(end));
          if (inWeek.length) {
            const casePrices = inWeek
              .filter(d => d.name.toLowerCase().includes('case') || d.name.toLowerCase().includes('capsule'))
              .map(d => d.price)
              .sort((a, b) => a - b);
            const otherPrices = inWeek
              .filter(d => !d.name.toLowerCase().includes('case') && !d.name.toLowerCase().includes('capsule'))
              .map(d => d.price)
              .sort((a, b) => a - b);
            const medianCalc = arr => {
              if (!arr.length) return 0;
              const mid = Math.floor(arr.length / 2);
              return arr.length % 2 !== 0 ? arr[mid] : parseFloat(((arr[mid - 1] + arr[mid]) / 2).toFixed(2));
            };
            const medianCase = medianCalc(casePrices);
            const medianOther = medianCalc(otherPrices);
            const sumAll = inWeek.reduce((s, d) => s + d.price, 0);
            const accountsCount = inWeek.length / 2;
            const avgPrice = parseFloat((sumAll / accountsCount).toFixed(2));
            weeks.push({ week: `${start.format('DD.MM')}–${end.format('DD.MM')}`, avgPrice, medianCase, medianOther });
          }
          start = end;
        }
        setWeeklyData(weeks);
      })
      .catch(err => setError(err.toString()))
      .finally(() => setLoading(false));
  }, []);

  // Process case distribution
  const caseItems = data.filter(item => {
    const lower = item.name.toLowerCase();
    return lower.includes('case') || lower.includes('capsule');
  });
  const totalCases = caseItems.reduce((sum, item) => sum + item.value, 0);
  const groupedCases = [];
  let rareCount = 0;
  caseItems.forEach(item => {
    const percent = (item.value / totalCases) * 100;
    if (percent < 2) rareCount += item.value;
    else groupedCases.push(item);
  });
  if (rareCount > 0) groupedCases.push({ name: 'Редкие кейсы', value: rareCount });

  const columns = [
    { title: 'Название предмета', dataIndex: 'name', key: 'name' },
    { title: 'Количество', dataIndex: 'value', key: 'value', sorter: (a, b) => a.value - b.value },
  ];

  return (
    <div style={{ display: 'grid', gap: 24, padding: 24, background: '#fafafa' }}>
      <Card title="Распределение кейсов">
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 300, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <ResponsiveContainer width="100%" height={400}>
              <PieChart>
                <Pie
                  data={groupedCases}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={150}
                  isAnimationActive={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                >
                  {groupedCases.map((entry, idx) => (
                    <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ marginTop: 16, display: 'flex', gap: 8, width: '80%' }}>
              <RangePicker
                value={dateRange}
                onChange={dates => setDateRange(dates)}
                style={{ flex: 1 }}
              />
              <Button onClick={() => setDateRange([])}>Сбросить</Button>
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 300 }}>
            <Table
              dataSource={caseItems.map(item => ({ ...item, percent: ((item.value / totalCases) * 100).toFixed(1) }))
                .sort((a, b) => b.value - a.value)}
              columns={columns}
              rowKey="name"
              pagination={false}
              size="small"
            />
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
              <div>Сумма кейсов: {totalCases}</div>
              <div>Итоговый заработок: {totalRevenue} ₽</div>
            </div>
          </div>
        </div>
      </Card>

      <Card title="Средняя стоимость дропа">
        {loading ? (
          <Spin />
        ) : error ? (
          <Alert type="error" message={error} />
        ) : (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={weeklyData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="week" />
              <YAxis label={{ value: '₽', angle: -90, position: 'insideLeft' }} />
              <RechartsTooltip formatter={value => `${value} ₽`} />
              <Legend />
              <Line
                type="monotone"
                dataKey="avgPrice"
                name="Средняя стоимость дропа"
                stroke={COLORS[0]}
                activeDot={{ r: 8 }}
              />
              <Line
                type="monotone"
                dataKey="medianCase"
                name="Медиана кейсов"
                stroke={COLORS[1]}
                strokeDasharray="5 5"
                activeDot={{ r: 6 }}
              />
              <Line
                type="monotone"
                dataKey="medianOther"
                name="Медиана ширпотреба"
                stroke={COLORS[2]}
                strokeDasharray="2 2"
                activeDot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>
    </div>
  );
};

export default StatsPage;
