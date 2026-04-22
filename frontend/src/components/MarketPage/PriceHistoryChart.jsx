import React from 'react';
import { Spin, Typography } from 'antd';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  TimeScale,
  Tooltip,
  Legend
} from 'chart.js';
import 'chartjs-adapter-date-fns';

const { Text } = Typography;

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  TimeScale,
  Tooltip,
  Legend
);

const SOFT_DARK = '#333';
const GRID_COLOR = 'rgba(51,51,51,0.1)';

const PriceHistoryChart = ({ data: priceHistory, loading }) => {
  const chartData = {
    datasets: [{
      label: 'Цена, ₽',
      data: priceHistory,
      fill: false,
      tension: 0.1,
      borderColor: SOFT_DARK,
      borderWidth: 2,
      pointBackgroundColor: SOFT_DARK,
      pointRadius: 1,
      pointHoverRadius: 4
    }]
  };

  const chartOptions = {
    responsive: true,
    scales: {
      x: {
        type: 'time',
        time: { unit: 'day', tooltipFormat: 'dd MMM yyyy' },
        title: { display: true, text: 'Дата', color: SOFT_DARK },
        ticks: { color: SOFT_DARK },
        grid: { color: GRID_COLOR }
      },
      y: {
        beginAtZero: false,
        title: { display: true, text: 'Цена, ₽', color: SOFT_DARK },
        ticks: { color: SOFT_DARK },
        grid: { color: GRID_COLOR }
      }
    },
    plugins: {
      legend: { display: false },
      tooltip: { enabled: true }
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 16 }}>
        <Spin size="small" />
      </div>
    );
  }

  if (!priceHistory.length) {
    return <Text type="secondary">График недоступен</Text>;
  }

  return <Line data={chartData} options={chartOptions} />;
};

export default PriceHistoryChart;