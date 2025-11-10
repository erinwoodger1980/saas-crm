import Link from 'next/link';

export default function ThankYouPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white">
      <h1 className="text-3xl font-bold mb-4">Thanks — we’ll be in touch shortly!</h1>
      <Link href="/" className="text-blue-600 underline">Back to home</Link>
    </div>
  );
}export default function ThankYouPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
      <div className="max-w-md p-8 bg-white border rounded shadow text-center">
        <h1 className="text-2xl font-bold mb-2">Thank You!</h1>
        <p className="mb-4">We’ll be in touch shortly about your project.</p>
        <a href="/" className="text-blue-600 underline">Back to Home</a>
      </div>
    </div>
  );
}
