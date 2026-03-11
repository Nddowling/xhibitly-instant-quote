import React from 'react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const COLORS = ['#e2231a', '#1d4ed8', '#16a34a', '#d97706', '#7c3aed', '#db2777', '#0891b2', '#65a30d'];

export default function ReportChart({ report, results }) {
  if (!results?.rows?.length || !report.chart_type || report.chart_type === 'none') return null;

  const data = results.rows.slice(0, 50);
  const xField = report.chart_x_field || report.selected_fields?.[0]?.field;
  const yField = report.chart_y_field
    ? (report.chart_y_aggregate ? `${report.chart_y_field}_${report.chart_y_aggregate}` : report.chart_y_field)
    : report.selected_fields?.[1]?.field;

  if (!xField || !yField) return <p className="text-xs text-slate-400 p-4">Configure chart axes to display chart</p>;

  if (report.chart_type === 'pie' || report.chart_type === 'donut') {
    return (
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie data={data} dataKey={yField} nameKey={xField} cx="50%" cy="50%"
            innerRadius={report.chart_type === 'donut' ? 60 : 0} outerRadius={100} label>
            {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (report.chart_type === 'line') {
    return (
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey={xField} tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey={yField} stroke="#e2231a" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  // bar / funnel / default
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey={xField} tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip />
        <Legend />
        <Bar dataKey={yField} fill="#e2231a" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}