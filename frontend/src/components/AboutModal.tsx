'use client';

import Image from 'next/image';
import { useState } from 'react';
import Link from 'next/link';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AboutModal({ isOpen, onClose }: AboutModalProps) {
  const [showReportForm, setShowReportForm] = useState(false);
  const [showSupportForm, setShowSupportForm] = useState(false);
  const [reportSubject, setReportSubject] = useState('');
  const [reportMessage, setReportMessage] = useState('');
  const [supportSubject, setSupportSubject] = useState('');
  const [supportMessage, setSupportMessage] = useState('');

  if (!isOpen) return null;

  const handleReportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const mailtoLink = `mailto:support@oblongix.com?subject=${encodeURIComponent('Issue Report: ' + reportSubject)}&body=${encodeURIComponent(reportMessage)}`;
    window.location.href = mailtoLink;
    setReportSubject('');
    setReportMessage('');
    setShowReportForm(false);
  };

  const handleSupportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const mailtoLink = `mailto:support@oblongix.com?subject=${encodeURIComponent('Support Request: ' + supportSubject)}&body=${encodeURIComponent(supportMessage)}`;
    window.location.href = mailtoLink;
    setSupportSubject('');
    setSupportMessage('');
    setShowSupportForm(false);
  };

  // Main About View
  if (!showReportForm && !showSupportForm) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white">
            <h2 className="text-xl font-semibold text-gray-900">About Meeting Simulator</h2>
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
              {/* App Info with Logo */}
              <div className="text-center">
                <div className="w-20 h-20 flex items-center justify-center mx-auto mb-4">
                  <Image src="/logo.svg" alt="Meeting Simulator Logo" width={80} height={80} />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Meeting Simulator</h3>
                <p className="text-sm text-gray-600 mt-1">Version 1.0.0</p>
              </div>

              {/* Description */}
              <div className="border-t border-gray-200 pt-6">
                <p className="text-sm text-gray-600 leading-relaxed">
                  Meeting Simulator is an AI-powered platform that helps you simulate and analyze 
                  meeting scenarios with customizable AI agents. Practice difficult conversations, 
                  test different approaches, and improve your meeting outcomes before the real thing.
                </p>
              </div>

              {/* Features */}
              <div className="border-t border-gray-200 pt-6">
                <h4 className="text-sm font-semibold text-gray-900 mb-3">Key Features</h4>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2 text-sm text-gray-600">
                    <span className="text-green-600 mt-0.5">✓</span>
                    <span>AI-powered meeting simulations with realistic agent behaviors</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm text-gray-600">
                    <span className="text-green-600 mt-0.5">✓</span>
                    <span>Customizable agent profiles with behavioral traits and decision criteria</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm text-gray-600">
                    <span className="text-green-600 mt-0.5">✓</span>
                    <span>Real-time streaming meeting conversations</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm text-gray-600">
                    <span className="text-green-600 mt-0.5">✓</span>
                    <span>Automatic meeting minutes generation and archival</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm text-gray-600">
                    <span className="text-green-600 mt-0.5">✓</span>
                    <span>Team collaboration with secure meeting sharing</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm text-gray-600">
                    <span className="text-green-600 mt-0.5">✓</span>
                    <span>Organization-level administration and role-based access control</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm text-gray-600">
                    <span className="text-green-600 mt-0.5">✓</span>
                    <span>Context-aware simulations with per-agent and meeting-level context</span>
                  </li>
                </ul>
              </div>

              {/* Links */}
              <div className="border-t border-gray-200 pt-6">
                <div className="flex flex-col gap-2">
                  <Link 
                    href="/meeting-process"
                    onClick={onClose}
                    className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-2"
                  >
                    <span>📖</span>
                    <span>Documentation</span>
                  </Link>
                  <button 
                    onClick={() => setShowReportForm(true)}
                    className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-2 text-left"
                  >
                    <span>🐛</span>
                    <span>Report an Issue</span>
                  </button>
                  <button 
                    onClick={() => setShowSupportForm(true)}
                    className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-2 text-left"
                  >
                    <span>💬</span>
                    <span>Contact Support</span>
                  </button>
                </div>
              </div>

              {/* Copyright */}
              <div className="border-t border-gray-200 pt-6 text-center">
                <p className="text-xs text-gray-500">
                  © 2025 Oblongix Ltd. All Rights Reserved.
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 sticky bottom-0">
            <button
              onClick={onClose}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Report Issue Form
  if (showReportForm) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Report an Issue</h2>
            <button
              onClick={() => setShowReportForm(false)}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
            >
              ×
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleReportSubmit} className="px-6 py-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subject *
                </label>
                <input
                  type="text"
                  value={reportSubject}
                  onChange={(e) => setReportSubject(e.target.value)}
                  required
                  placeholder="Brief description of the issue"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description *
                </label>
                <textarea
                  value={reportMessage}
                  onChange={(e) => setReportMessage(e.target.value)}
                  required
                  rows={6}
                  placeholder="Please describe the issue in detail, including steps to reproduce..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <p className="text-xs text-gray-500">
                This will open your email client to send the issue report to support@oblongix.com
              </p>
            </div>

            {/* Buttons */}
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => {
                  setReportSubject('');
                  setReportMessage('');
                  setShowReportForm(false);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
              >
                Send
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // Contact Support Form
  if (showSupportForm) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Contact Support</h2>
            <button
              onClick={() => setShowSupportForm(false)}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
            >
              ×
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSupportSubmit} className="px-6 py-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subject *
                </label>
                <input
                  type="text"
                  value={supportSubject}
                  onChange={(e) => setSupportSubject(e.target.value)}
                  required
                  placeholder="What can we help you with?"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Message *
                </label>
                <textarea
                  value={supportMessage}
                  onChange={(e) => setSupportMessage(e.target.value)}
                  required
                  rows={6}
                  placeholder="Please describe your question or request..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <p className="text-xs text-gray-500">
                This will open your email client to send your message to support@oblongix.com
              </p>
            </div>

            {/* Buttons */}
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => {
                  setSupportSubject('');
                  setSupportMessage('');
                  setShowSupportForm(false);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
              >
                Send
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return null;
}
