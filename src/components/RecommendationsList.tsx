/**
 * RecommendationsList Component
 * Displays optimization recommendations with actions
 */

import React, { useState } from 'react';
import { Recommendation } from '../types/cost';

export interface RecommendationsListProps {
  recommendations: Recommendation[];
  onApply?: (recommendation: Recommendation) => Promise<void>;
}

const severityIcons: { [key: string]: string } = {
  high: '🔴',
  medium: '🟡',
  low: '🟢',
};

const severityColors: { [key: string]: string } = {
  high: 'bg-red-50 border-red-200',
  medium: 'bg-yellow-50 border-yellow-200',
  low: 'bg-green-50 border-green-200',
};

export function RecommendationsList({
  recommendations,
  onApply,
}: RecommendationsListProps): JSX.Element {
  const [loading, setLoading] = useState<string | null>(null);

  const handleApply = async (rec: Recommendation) => {
    setLoading(rec.type);
    try {
      if (onApply) {
        await onApply(rec);
      } else if (rec.action) {
        await rec.action();
      }
    } catch (error) {
      console.error('Error applying recommendation:', error);
    } finally {
      setLoading(null);
    }
  };

  if (!recommendations || recommendations.length === 0) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
        <p className="text-green-700 font-medium">
          ✅ All systems optimized! No recommendations at this time.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {recommendations.map((rec) => (
        <div
          key={rec.type}
          className={`border rounded-lg p-4 ${severityColors[rec.severity]} transition-all`}
        >
          <div className="flex items-start gap-4">
            <span className="text-2xl">{severityIcons[rec.severity]}</span>

            <div className="flex-1">
              <h4 className="font-bold mb-1 capitalize">
                {rec.type.replace(/_/g, ' ')}
              </h4>
              <p className="text-sm mb-2 opacity-90">{rec.description}</p>
              <p className="text-xs font-mono">
                💰 Potential savings: ${rec.potentialSavings.toFixed(4)}/day
              </p>
            </div>

            <button
              onClick={() => handleApply(rec)}
              disabled={loading === rec.type}
              className="px-3 py-1 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white rounded font-medium text-sm transition-colors whitespace-nowrap"
            >
              {loading === rec.type ? '⏳ Applying...' : 'Apply'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default RecommendationsList;
