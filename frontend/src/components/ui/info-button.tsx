'use client';

import { useState } from 'react';

interface InfoButtonProps {
  tooltip: string;
}

export function InfoButton({ tooltip }: InfoButtonProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="relative inline-block ml-1">
      <button
        type="button"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={() => setShowTooltip(!showTooltip)}
        className="inline-flex items-center justify-center w-4 h-4 text-xs font-bold text-green-600 border border-green-600 rounded-full hover:bg-green-50 focus:outline-none"
      >
        i
      </button>
      {showTooltip && (
        <div className="absolute z-50 w-64 p-3 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg shadow-lg left-0 top-6">
          {tooltip}
          <div className="absolute w-2 h-2 bg-white border-l border-t border-gray-300 transform rotate-45 -top-1 left-2"></div>
        </div>
      )}
    </div>
  );
}
