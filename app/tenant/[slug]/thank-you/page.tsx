import Link from 'next/link';

export default function ThankYouPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
      <div className="max-w-md p-8 bg-white border rounded shadow text-center">
        <h1 className="text-2xl font-bold mb-2">Thank You!</h1>
        <p className="mb-4">We&apos;ll be in touch shortly about your project.</p>
        <Link href="/" className="text-blue-600 underline">Back to Home</Link>
      </div>
    </div>
  );
}
