import React, { useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import { BarChart3, TrendingUp, PieChart, ScatterChart } from 'lucide-react';

// Register all necessary Chart.js modules
Chart.register(...registerables);

export default function ChartRenderer({ chartConfig }) {
  const canvasRef = useRef(null);
  const chartInstanceRef = useRef(null);

  const { type, title, x_label, y_label, x, y } = chartConfig;

  useEffect(() => {
    if (!canvasRef.current || !x || !y) return;

    const ctx = canvasRef.current.getContext('2d');
    
    // Destroy previous chart instance if it exists
    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
    }

    // Determine normalized chart type (mapping backend chart types to Chart.js types)
    let chartType = type ? type.toLowerCase() : 'bar';
    if (chartType === 'none') chartType = 'bar';

    // Premium Color System
    let backgroundColor;
    let borderColor;
    let options = {};

    if (chartType === 'pie') {
      backgroundColor = [
        'rgba(99, 102, 241, 0.75)',  // Indigo
        'rgba(139, 92, 246, 0.75)',  // Violet
        'rgba(192, 132, 252, 0.75)', // Light Purple
        'rgba(236, 72, 153, 0.75)',  // Pink
        'rgba(59, 130, 246, 0.75)',  // Blue
        'rgba(16, 185, 129, 0.75)',  // Teal/Green
        'rgba(245, 158, 11, 0.75)',  // Amber
      ];
      borderColor = [
        '#6366f1',
        '#8b5cf6',
        '#c084fc',
        '#ec4899',
        '#3b82f6',
        '#10b981',
        '#f59e0b',
      ];
      
      options = {
        plugins: {
          legend: {
            position: 'right',
            labels: {
              color: '#94a3b8',
              font: { family: 'var(--font-sans)', size: 11 }
            }
          }
        }
      };
    } else {
      // Create Indigo-to-Violet linear gradient for single datasets (Bar, Line, Scatter)
      const gradient = ctx.createLinearGradient(0, 0, 0, 250);
      gradient.addColorStop(0, 'rgba(139, 92, 246, 0.75)'); // Violet
      gradient.addColorStop(1, 'rgba(99, 102, 241, 0.25)'); // Indigo fading out

      backgroundColor = chartType === 'line' ? 'rgba(99, 102, 241, 0.15)' : gradient;
      borderColor = '#8b5cf6';

      options = {
        scales: {
          x: {
            grid: {
              color: 'rgba(255, 255, 255, 0.04)',
              drawBorder: false,
            },
            ticks: {
              color: '#94a3b8',
              font: { family: 'var(--font-sans)', size: 10 }
            },
            title: {
              display: true,
              text: x_label || '',
              color: '#64748b',
              font: { family: 'var(--font-sans)', size: 11, weight: 'bold' }
            }
          },
          y: {
            grid: {
              color: 'rgba(255, 255, 255, 0.04)',
              drawBorder: false,
            },
            ticks: {
              color: '#94a3b8',
              font: { family: 'var(--font-sans)', size: 10 }
            },
            title: {
              display: true,
              text: y_label || '',
              color: '#64748b',
              font: { family: 'var(--font-sans)', size: 11, weight: 'bold' }
            }
          }
        },
        plugins: {
          legend: {
            display: false // We already have a title
          }
        }
      };
    }

    // Common Configuration Options
    const commonOptions = {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 1000,
        easing: 'easeOutQuart'
      },
      plugins: {
        tooltip: {
          backgroundColor: '#0f172a',
          titleColor: '#ffffff',
          bodyColor: '#e2e8f0',
          borderColor: 'rgba(99, 102, 241, 0.2)',
          borderWidth: 1,
          padding: 10,
          bodyFont: { family: 'var(--font-sans)' },
          titleFont: { family: 'var(--font-sans)', weight: 'bold' }
        },
        ...options.plugins
      },
      ...options
    };

    // Instantiate Chart.js Chart
    chartInstanceRef.current = new Chart(ctx, {
      type: chartType === 'scatter' ? 'scatter' : chartType,
      data: {
        labels: x,
        datasets: [{
          label: y_label || 'Value',
          data: chartType === 'scatter' 
            ? x.map((xVal, idx) => ({ x: xVal, y: y[idx] })) 
            : y,
          backgroundColor,
          borderColor,
          borderWidth: chartType === 'line' ? 2 : 1,
          fill: chartType === 'line',
          tension: chartType === 'line' ? 0.35 : 0,
          pointBackgroundColor: '#8b5cf6',
          pointBorderColor: '#ffffff',
          pointHoverRadius: 6,
          borderRadius: chartType === 'bar' ? 4 : 0, // rounded bars
        }]
      },
      options: commonOptions
    });

    // Cleanup on unmount
    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
      }
    };
  }, [type, x, y, x_label, y_label]);

  const renderIcon = () => {
    switch (type?.toLowerCase()) {
      case 'line':
        return <TrendingUp size={16} style={{ color: 'var(--secondary-accent)' }} />;
      case 'pie':
        return <PieChart size={16} style={{ color: 'var(--secondary-accent)' }} />;
      case 'scatter':
        return <ScatterChart size={16} style={{ color: 'var(--secondary-accent)' }} />;
      default:
        return <BarChart3 size={16} style={{ color: 'var(--secondary-accent)' }} />;
    }
  };

  return (
    <div className="chart-container-card">
      <div className="chart-title-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {renderIcon()}
          <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#fff' }}>
            {title || 'Query Visualization'}
          </span>
        </div>
        <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>
          {type || 'Chart'}
        </span>
      </div>
      <div className="chart-canvas-wrapper">
        <canvas ref={canvasRef}></canvas>
      </div>
    </div>
  );
}
