import React from 'react';

interface CostAnalyticsProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CostAnalytics: React.FC<CostAnalyticsProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-lg w-full max-w-4xl max-h-[80vh] overflow-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">💰 Cost Analytics Dashboard</h2>
          <button onClick={onClose} className="text-2xl text-gray-400 hover:text-white">✕</button>
        </div>
        
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-cyan-900/50 rounded p-4">
              <p className="text-sm text-cyan-300">Total Cost</p>
              <p className="text-2xl font-bold text-white">$0.0200</p>
            </div>
            <div className="bg-cyan-900/50 rounded p-4">
              <p className="text-sm text-cyan-300">Hermes</p>
              <p className="text-2xl font-bold text-white">$0.0125</p>
            </div>
            <div className="bg-purple-900/50 rounded p-4">
              <p className="text-sm text-purple-300">ORBIT</p>
              <p className="text-2xl font-bold text-white">$0.0075</p>
            </div>
            <div className="bg-yellow-900/50 rounded p-4">
              <p className="text-sm text-yellow-300">Status</p>
              <p className="text-lg font-bold text-green-400">✓ Active</p>
            </div>
          </div>

          <div className="bg-gray-800 rounded p-4">
            <h3 className="text-lg font-bold text-white mb-4">Agent Performance</h3>
            <table className="w-full text-sm text-gray-300">
              <thead className="border-b border-gray-700">
                <tr>
                  <th className="text-left py-2">Agent</th>
                  <th className="text-right py-2">Total Cost</th>
                  <th className="text-right py-2">Requests</th>
                  <th className="text-right py-2">Avg Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                <tr>
                  <td className="py-2">HERMES</td>
                  <td className="text-right text-green-400">$0.0125</td>
                  <td className="text-right">24</td>
                  <td className="text-right">$0.000521</td>
                </tr>
                <tr>
                  <td className="py-2">ORBIT</td>
                  <td className="text-right text-green-400">$0.0075</td>
                  <td className="text-right">18</td>
                  <td className="text-right">$0.000417</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="bg-blue-900/20 border border-blue-700 rounded p-4">
            <p className="text-sm text-blue-300">📊 Detailed charts and analytics will be available after backend connection is established.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
