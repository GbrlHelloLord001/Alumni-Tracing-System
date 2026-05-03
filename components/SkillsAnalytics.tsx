
import React from 'react';
import { Award } from 'lucide-react';

interface SkillsAnalyticsProps {
    autoAI?: boolean;
}

const SkillsAnalytics: React.FC<SkillsAnalyticsProps> = ({ autoAI = false }) => {
  return (
    <div className="bg-white p-12 rounded-3xl border border-gray-100 text-center animate-fade-in">
        <div className="w-20 h-20 bg-violet-50 rounded-full flex items-center justify-center mx-auto mb-6 text-violet-500">
            <Award size={40} />
        </div>
        <h3 className="text-2xl font-bold text-gray-800 mb-2">Skills & Attributes</h3>
        <p className="text-gray-500 max-w-md mx-auto">
            Aggregation of institutional graduate attributes and 21st-century skills proficiency ratings.
        </p>
        {autoAI && (
            <div className="mt-4 text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full inline-block">
                Auto-Interpretation Active
            </div>
        )}
        <div className="mt-8 px-4 py-2 bg-gray-100 text-gray-500 text-xs font-bold uppercase tracking-wider rounded-full inline-block">
            Coming Soon
        </div>
    </div>
  );
};

export default SkillsAnalytics;
