'use client';

interface BillingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function BillingModal({ isOpen, onClose }: BillingModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Billing & Subscription</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          <div className="space-y-6">
            {/* Current Plan */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Professional Plan</h3>
                  <p className="text-sm text-gray-600 mt-1">Unlimited meetings and agents</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-blue-600">$49</p>
                  <p className="text-sm text-gray-600">per month</p>
                </div>
              </div>
              <div className="mt-4 flex gap-3">
                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
                  Manage Plan
                </button>
                <button className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium">
                  Cancel Subscription
                </button>
              </div>
            </div>

            {/* Payment Method */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Payment Method</h3>
              <div className="border border-gray-200 rounded-lg p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-8 bg-gradient-to-r from-blue-600 to-blue-400 rounded flex items-center justify-center">
                    <span className="text-white text-xs font-bold">VISA</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">•••• •••• •••• 4242</p>
                    <p className="text-xs text-gray-500">Expires 12/2025</p>
                  </div>
                </div>
                <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                  Update
                </button>
              </div>
            </div>

            {/* Billing History */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Billing History</h3>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Invoice</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    <tr>
                      <td className="px-4 py-3 text-sm text-gray-900">Dec 1, 2025</td>
                      <td className="px-4 py-3 text-sm text-gray-600">Professional Plan - Monthly</td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right">$49.00</td>
                      <td className="px-4 py-3 text-right">
                        <button className="text-sm text-blue-600 hover:text-blue-700">Download</button>
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-sm text-gray-900">Nov 1, 2025</td>
                      <td className="px-4 py-3 text-sm text-gray-600">Professional Plan - Monthly</td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right">$49.00</td>
                      <td className="px-4 py-3 text-right">
                        <button className="text-sm text-blue-600 hover:text-blue-700">Download</button>
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-sm text-gray-900">Oct 1, 2025</td>
                      <td className="px-4 py-3 text-sm text-gray-600">Professional Plan - Monthly</td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right">$49.00</td>
                      <td className="px-4 py-3 text-right">
                        <button className="text-sm text-blue-600 hover:text-blue-700">Download</button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Usage Stats */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Current Usage</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-gray-900">24</p>
                  <p className="text-xs text-gray-600 mt-1">Meetings</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-gray-900">12</p>
                  <p className="text-xs text-gray-600 mt-1">AI Agents</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-gray-900">5</p>
                  <p className="text-xs text-gray-600 mt-1">Team Members</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
