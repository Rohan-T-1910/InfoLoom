import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  PointElement,
  LineElement,
  ArcElement,
} from 'chart.js';

// Register core Chart.js modules for tree-shaking
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  PointElement,
  LineElement,
  ArcElement
);

// Apply custom global dark theme styling to Chart.js
ChartJS.defaults.color = '#94a3b8';
ChartJS.defaults.borderColor = 'rgba(255, 255, 255, 0.08)';
ChartJS.defaults.font.family = "'Plus Jakarta Sans', sans-serif";
