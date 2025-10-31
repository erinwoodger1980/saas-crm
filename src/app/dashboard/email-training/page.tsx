// Email training workflow page
'use client';

export default function EmailTrainingPage() {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-white p-6">
        <h1 className="text-2xl font-bold text-slate-900 mb-4">
          🤖 Email-to-ML Training
        </h1>
        <p className="text-slate-600 mb-6">
          Automatically discover client quotes in your email, parse them, and train your pricing AI models.
        </p>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-blue-900 mb-2">How it works:</h3>
          <ol className="list-decimal list-inside text-sm text-blue-800 space-y-1">
            <li>Connect your Gmail or Microsoft 365 email account</li>
            <li>Search for emails with PDF quote attachments</li>
            <li>Parse quotes to extract project details and pricing</li>
            <li>Save training data to continuously improve AI pricing models</li>
          </ol>
        </div>
        
        <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center">
          <div className="max-w-sm mx-auto">
            <div className="mb-4">
              <svg className="mx-auto h-12 w-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 7.89a2 2 0 002.83 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-slate-900 mb-2">
              Open Training Interface
            </h3>
            <p className="text-slate-500 mb-4">
              Use the dedicated training interface to configure and run the email workflow.
            </p>
            <button 
              onClick={() => window.open('/ml/email_training_ui.html', '_blank')}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Open Training UI
              <svg className="ml-2 -mr-1 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </button>
          </div>
        </div>
        
        <div className="mt-8">
          <h3 className="text-lg font-medium text-slate-900 mb-3">
            Training Status
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-slate-900">0</div>
              <div className="text-sm text-slate-600">Training Records</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-slate-900">—</div>
              <div className="text-sm text-slate-600">Last Training</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-slate-900">—</div>
              <div className="text-sm text-slate-600">Model Accuracy</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}