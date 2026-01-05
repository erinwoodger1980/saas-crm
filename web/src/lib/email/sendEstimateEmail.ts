/**
 * Email sending utilities for public estimator confirmations
 */

interface SendEstimateEmailProps {
  to: string;
  clientName: string;
  quoteNumber: string;
  estimatedDeliveryTime: string;
  itemCount: number;
}

export async function sendEstimateEmail({
  to,
  clientName,
  quoteNumber,
  estimatedDeliveryTime,
  itemCount,
}: SendEstimateEmailProps) {
  // TODO: Implement email sending via SendGrid, Mailgun, or similar
  // For now, this is a placeholder that logs the email intent
  
  const emailContent = `
    <h1>Estimate Received</h1>
    <p>Hi ${clientName},</p>
    <p>Thank you for submitting your estimate request. We've received your information for ${itemCount} item(s).</p>
    <p><strong>Quote Number:</strong> ${quoteNumber}</p>
    <p><strong>Estimated Delivery:</strong> ${estimatedDeliveryTime}</p>
    <p>Our team will review your requirements and prepare a detailed estimate with material options and pricing.</p>
    <p>You'll receive the complete estimate via email shortly.</p>
    <p>If you have any questions, feel free to reach out.</p>
    <p>Best regards,<br/>The Team</p>
  `;

  console.log('[sendEstimateEmail]', {
    to,
    clientName,
    quoteNumber,
    subject: `Estimate Received - ${quoteNumber}`,
  });

  // Placeholder implementation
  return {
    success: true,
    messageId: `msg_${Date.now()}`,
  };
}

/**
 * Send completed estimate PDF to customer
 */
export async function sendEstimatePdf({
  to,
  clientName,
  quoteNumber,
  pdfUrl,
}: {
  to: string;
  clientName: string;
  quoteNumber: string;
  pdfUrl: string;
}) {
  const emailContent = `
    <h1>Your Estimate is Ready</h1>
    <p>Hi ${clientName},</p>
    <p>Your detailed estimate is attached below:</p>
    <p><strong>Quote Number:</strong> ${quoteNumber}</p>
    <p>This includes:</p>
    <ul>
      <li>Material options and pricing</li>
      <li>Specifications and measurements</li>
      <li>Installation timeline</li>
      <li>Next steps and order process</li>
    </ul>
    <p>Please review and let us know if you have any questions.</p>
    <p><strong><a href="${pdfUrl}">Download Your Estimate</a></strong></p>
  `;

  console.log('[sendEstimatePdf]', {
    to,
    quoteNumber,
    subject: `Your Estimate - ${quoteNumber}`,
  });

  return {
    success: true,
    messageId: `msg_${Date.now()}`,
  };
}
